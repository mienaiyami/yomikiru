import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMainLogger } from "@electron/util/logger";

const logger = createMainLogger("util/portableUpdate");

/**
 * Waits until processes running from the install directory exit, then stops any that remain.
 * Matches by executable path so another portable copy is left alone.
 * Renames the current install aside, renames the staged build in, and puts the old entries back on failure.
 * Backup delete and relaunch sit outside that failure path so they cannot undo a finished swap.
 */
export const PORTABLE_APPLY_SCRIPT = String.raw`
param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$ExePath,
    [Parameter(Mandatory = $true)][string]$LogFile
)

$ErrorActionPreference = "Stop"
# bounded so a stuck helper cannot block the swap indefinitely
$waitSec = 20
$moveAttempts = 5

$installRoot = $InstallDir.TrimEnd('\')
$updateDir = Join-Path $installRoot "update"
$stagingDir = Join-Path $updateDir "staging"
$backupDir = Join-Path $updateDir "backup"
$failedPath = Join-Path $updateDir "failed.txt"
$preserved = @("userdata", "update")
$movedToBackup = New-Object System.Collections.Generic.List[string]
$movedIn = New-Object System.Collections.Generic.List[string]

function Write-ApplyLog([string]$Message) {
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    try {
        $logDir = Split-Path -Parent $LogFile
        if ($logDir -and -not (Test-Path -LiteralPath $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8
    } catch {
        # a log failure must not abort the swap
    }
}

function Get-InstallProcesses() {
    $prefix = $installRoot + "\"
    return @(Get-CimInstance -ClassName Win32_Process | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
    })
}

function Move-Entry([string]$From, [string]$To) {
    for ($attempt = 1; $attempt -le $moveAttempts; $attempt++) {
        try {
            Move-Item -LiteralPath $From -Destination $To
            return
        } catch {
            if ($attempt -ge $moveAttempts) {
                throw ("move failed: {0} -> {1}: {2}" -f $From, $To, $_.Exception.Message)
            }
            Start-Sleep -Milliseconds 500
        }
    }
}

function Move-Children([string]$FromDir, [string]$ToDir, $Moved) {
    $entries = @(Get-ChildItem -LiteralPath $FromDir -Force | Where-Object { $preserved -notcontains $_.Name })
    foreach ($entry in $entries) {
        Move-Entry $entry.FullName (Join-Path $ToDir $entry.Name)
        [void]$Moved.Add($entry.Name)
    }
}

function Move-Back([string]$From, [string]$To) {
    if (-not (Test-Path -LiteralPath $From)) { return }
    try {
        if (Test-Path -LiteralPath $To) { Remove-Item -LiteralPath $To -Recurse -Force }
        Move-Entry $From $To
    } catch {
        Write-ApplyLog ("rollback failed for {0}: {1}" -f $From, $_.Exception.Message)
    }
}

function Start-Install() {
    try {
        # cmd start so the app is not a child of this console and does not keep the window open
        $launch = '/d /c start "" "{0}"' -f $ExePath
        Start-Process -FilePath "cmd.exe" -ArgumentList $launch -WindowStyle Hidden
    } catch {
        Write-ApplyLog $_.Exception.Message
    }
}

try {
    Write-ApplyLog "portable update apply started"
    Start-Sleep -Seconds 2
    if (Test-Path -LiteralPath $failedPath) { Remove-Item -LiteralPath $failedPath -Force }
    $stagedExe = Join-Path $stagingDir (Split-Path -Leaf $ExePath)
    if (-not (Test-Path -LiteralPath $stagedExe)) { throw "staged build is missing $stagedExe" }

    Write-ApplyLog "waiting for the app to exit"
    $deadline = (Get-Date).AddSeconds($waitSec)
    while ($true) {
        $running = @(Get-InstallProcesses)
        if ($running.Count -eq 0) { break }
        if ((Get-Date) -ge $deadline) {
            Write-ApplyLog "stopping processes still running from this install"
            foreach ($proc in $running) { Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue }
            Start-Sleep -Seconds 2
            break
        }
        Start-Sleep -Milliseconds 200
    }

    Write-ApplyLog "moving the current app aside"
    if (Test-Path -LiteralPath $backupDir) { Remove-Item -LiteralPath $backupDir -Recurse -Force }
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Move-Children $installRoot $backupDir $movedToBackup
    Write-ApplyLog "moving the new build in"
    Move-Children $stagingDir $installRoot $movedIn
} catch {
    $detail = $_.Exception.Message
    Write-ApplyLog ("portable update apply failed: {0}" -f $detail)
    foreach ($name in $movedIn) { Move-Back (Join-Path $installRoot $name) (Join-Path $stagingDir $name) }
    foreach ($name in $movedToBackup) { Move-Back (Join-Path $backupDir $name) (Join-Path $installRoot $name) }
    Set-Content -LiteralPath $failedPath -Value $detail -Encoding utf8
    # staging holds the new app.asar; remove it before relaunch so the next process never opens it
    try {
        if (Test-Path -LiteralPath $stagingDir) {
            Remove-Item -LiteralPath $stagingDir -Recurse -Force
            Write-ApplyLog "removed the staged build"
        }
    } catch {
        Write-ApplyLog ("could not remove the staged build: {0}" -f $_.Exception.Message)
    }
    Start-Sleep -Seconds 2
    Start-Install
    exit 1
}

try { Remove-Item -LiteralPath $backupDir -Recurse -Force } catch { Write-ApplyLog $_.Exception.Message }
Write-ApplyLog "portable update apply succeeded"
Start-Sleep -Seconds 2
Write-ApplyLog "opening the app"
Start-Install
exit 0
`.trim();

/** Paths the apply script needs. Passed as arguments, not interpolated into the script. */
export type PortableApplyRequest = {
    installDir: string;
    exePath: string;
    logFilePath: string;
};

/** Update workspace under the install root. The apply script uses this same directory name. */
const portableUpdateDir = (installDir: string): string => path.join(installDir, "update");

/**
 * Electron's stat reports an asar as a directory. noAsar makes this call see the file.
 * It does not unlock an archive this process has already opened.
 */
const withRealFiles = <T>(read: () => T): T => {
    const proc = process as NodeJS.Process & { noAsar?: boolean };
    const asarWasDisabled = proc.noAsar === true;
    proc.noAsar = true;
    try {
        return read();
    } finally {
        proc.noAsar = asarWasDisabled;
    }
};

/** Extract directory for one portable download. It is on the install volume so the swap can rename. */
export const portableStagingDir = (installDir: string): string =>
    path.join(portableUpdateDir(installDir), "staging");

/** Apply-script log under the profile logs directory. */
export const portableUpdateLogPath = (userDataPath: string): string =>
    path.join(userDataPath, "logs", "portable-update.log");

/**
 * Why a staged extract cannot be installed, or null when it is the offered portable build.
 * A real archive is only checked to exist. Reading inside it would keep the file open.
 */
export const portableStageIssue = (
    stagedRoot: string,
    exeFileName: string,
    expectedVersion: string,
): string | null => {
    if (!fs.existsSync(path.join(stagedRoot, exeFileName))) return "missing-exe";
    const asarPath = path.join(stagedRoot, "resources", "app.asar");
    let asarIsDirectory = false;
    try {
        const stat = withRealFiles(() => fs.statSync(asarPath));
        if (stat.isFile()) return null;
        asarIsDirectory = stat.isDirectory();
    } catch {
        return "missing-asar";
    }
    if (!asarIsDirectory) return "missing-asar";
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(path.join(asarPath, "package.json"), "utf8"));
        if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) return "unreadable-version";
        const stagedVersion = parsed.version;
        if (typeof stagedVersion !== "string" || stagedVersion !== expectedVersion) return "version-mismatch";
        return null;
    } catch {
        return "unreadable-version";
    }
};

/**
 * Reads a leftover apply failure note and deletes the update directory.
 * Returns null when the last launch left no note. Safe when the directory is absent.
 */
export const takePortableUpdateFailure = (installDir: string): string | null => {
    const updateDir = portableUpdateDir(installDir);
    const failedPath = path.join(updateDir, "failed.txt");
    let detail: string | null = null;
    try {
        if (fs.existsSync(failedPath)) {
            detail = fs
                .readFileSync(failedPath, "utf8")
                .replace(/^\uFEFF/, "")
                .trim();
        }
    } catch (error) {
        detail = error instanceof Error ? error.message : String(error);
        logger.warn("portable update failure note could not be read", { failedPath }, error);
    }
    try {
        fs.rmSync(updateDir, { recursive: true, force: true });
    } catch (error) {
        logger.warn("portable update directory could not be removed", { updateDir }, error);
    }
    return detail;
};

/**
 * Arguments for the apply script. Each path is its own argument so a quote in a folder name is not re-parsed.
 */
export const portableApplyArgs = (scriptPath: string, request: PortableApplyRequest): string[] => [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-InstallDir",
    request.installDir,
    "-ExePath",
    request.exePath,
    "-LogFile",
    request.logFilePath,
];

/**
 * Writes the apply script and starts it detached so this process can exit and release its files.
 * @throws {Error} When the script file cannot be written
 */
export const spawnPortableApply = (request: PortableApplyRequest): void => {
    const updateDir = portableUpdateDir(request.installDir);
    fs.mkdirSync(updateDir, { recursive: true });
    const scriptPath = path.join(updateDir, "apply.ps1");
    fs.writeFileSync(scriptPath, PORTABLE_APPLY_SCRIPT, "utf8");
    /*
     * cmd /c start opens a real console. Electron is a GUI process, so spawning
     * powershell directly stays invisible. The app can exit while that window runs the swap.
     * cwd is outside the install so this process does not pin the directory it renames.
     */
    const child = spawn(
        "cmd.exe",
        ["/d", "/c", "start", "Yomikiru update", "powershell.exe", ...portableApplyArgs(scriptPath, request)],
        {
            cwd: os.tmpdir(),
            detached: true,
            stdio: "ignore",
            windowsHide: true,
            shell: false,
        },
    );
    child.on("error", (error) => {
        logger.error("portable update apply process failed to start", error);
    });
    child.unref();
};
