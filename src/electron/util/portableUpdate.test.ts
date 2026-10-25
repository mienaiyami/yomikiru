import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    PORTABLE_APPLY_SCRIPT,
    type PortableApplyRequest,
    portableApplyArgs,
    portableStageIssue,
    portableStagingDir,
    takePortableUpdateFailure,
} from "./portableUpdate";

describe("portable update", () => {
    const dirs: string[] = [];

    afterEach(() => {
        for (const dir of dirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        dirs.length = 0;
    });

    /** Host temp directory removed in afterEach. */
    const tempDir = (): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-portable-update-"));
        dirs.push(dir);
        return dir;
    };

    /**
     * Staged portable tree. A directory stands in for app.asar so Node can read the manifest.
     */
    const writeStagedTree = (
        stagedRoot: string,
        options: { exe?: boolean; asar?: boolean; version?: string | null },
    ): void => {
        fs.mkdirSync(stagedRoot, { recursive: true });
        if (options.exe !== false) fs.writeFileSync(path.join(stagedRoot, "Yomikiru.exe"), "");
        if (options.asar === false) return;
        const asarDir = path.join(stagedRoot, "resources", "app.asar");
        fs.mkdirSync(asarDir, { recursive: true });
        if (options.version === null) return;
        fs.writeFileSync(
            path.join(asarDir, "package.json"),
            JSON.stringify({ version: options.version ?? "2.0.0" }),
        );
    };

    it("accepts a staged tree whose manifest matches the offered version", () => {
        const stagedRoot = path.join(tempDir(), "staging");
        writeStagedTree(stagedRoot, { version: "2.4.0" });
        expect(portableStageIssue(stagedRoot, "Yomikiru.exe", "2.4.0")).toBeNull();
    });

    it("rejects a staged tree that is missing the executable, the asar, or the offered version", () => {
        const root = tempDir();
        const missingExe = path.join(root, "missing-exe");
        writeStagedTree(missingExe, { exe: false });
        expect(portableStageIssue(missingExe, "Yomikiru.exe", "2.0.0")).toBe("missing-exe");

        const missingAsar = path.join(root, "missing-asar");
        writeStagedTree(missingAsar, { asar: false });
        expect(portableStageIssue(missingAsar, "Yomikiru.exe", "2.0.0")).toBe("missing-asar");

        const unreadable = path.join(root, "unreadable");
        writeStagedTree(unreadable, { version: null });
        expect(portableStageIssue(unreadable, "Yomikiru.exe", "2.0.0")).toBe("unreadable-version");

        const mismatch = path.join(root, "mismatch");
        writeStagedTree(mismatch, { version: "1.0.0" });
        expect(portableStageIssue(mismatch, "Yomikiru.exe", "2.0.0")).toBe("version-mismatch");
    });

    it("returns a failure note and removes the update directory", () => {
        const installDir = tempDir();
        const updateDir = path.join(installDir, "update");
        fs.mkdirSync(portableStagingDir(installDir), { recursive: true });
        fs.writeFileSync(path.join(updateDir, "failed.txt"), "\uFEFFswap failed\n");
        expect(takePortableUpdateFailure(installDir)).toBe("swap failed");
        expect(fs.existsSync(updateDir)).toBe(false);
    });

    it("removes a leftover update directory when there is no failure note", () => {
        const installDir = tempDir();
        const stagingDir = portableStagingDir(installDir);
        fs.mkdirSync(stagingDir, { recursive: true });
        fs.writeFileSync(path.join(stagingDir, "Yomikiru.exe"), "");
        expect(takePortableUpdateFailure(installDir)).toBeNull();
        expect(fs.existsSync(path.join(installDir, "update"))).toBe(false);
    });

    it("passes install paths as arguments", () => {
        const installDir = path.join("apps", "o'brien Yomikiru");
        const request: PortableApplyRequest = {
            installDir,
            exePath: path.join(installDir, "Yomikiru.exe"),
            logFilePath: path.join(installDir, "userdata", "logs", "portable-update.log"),
        };
        const scriptPath = path.join(installDir, "update", "apply.ps1");
        const args = portableApplyArgs(scriptPath, request);
        expect(args).toContain("-File");
        expect(args).toContain(scriptPath);
        expect(args).toContain(installDir);
        expect(args.some((arg) => arg.includes("-Command"))).toBe(false);
        expect(PORTABLE_APPLY_SCRIPT).toContain('"userdata"');
        expect(PORTABLE_APPLY_SCRIPT).toContain('"update"');
        expect(PORTABLE_APPLY_SCRIPT).toContain("move failed:");
    });

    it("parses as a PowerShell script on Windows", async ({ skip }) => {
        if (process.platform !== "win32") skip();
        const scriptPath = path.join(tempDir(), "apply.ps1");
        fs.writeFileSync(scriptPath, PORTABLE_APPLY_SCRIPT, "utf8");
        const parseCommand = [
            "$errors = $null",
            "[void][System.Management.Automation.Language.Parser]::ParseFile($env:APPLY_SCRIPT_PATH, [ref]$null, [ref]$errors)",
            "if ($errors -and $errors.Count -gt 0) { $errors | ForEach-Object { Write-Output $_.ToString() }; exit 1 }",
            "exit 0",
        ].join("; ");
        const output = await new Promise<{ code: number | null; stderr: string; stdout: string }>(
            (resolve, reject) => {
                const child = spawn(
                    "powershell.exe",
                    ["-NoProfile", "-NonInteractive", "-Command", parseCommand],
                    {
                        windowsHide: true,
                        env: { ...process.env, APPLY_SCRIPT_PATH: scriptPath },
                    },
                );
                let stdout = "";
                let stderr = "";
                child.stdout.on("data", (chunk: Buffer) => {
                    stdout += chunk.toString();
                });
                child.stderr.on("data", (chunk: Buffer) => {
                    stderr += chunk.toString();
                });
                child.once("error", reject);
                child.once("close", (code) => resolve({ code, stderr, stdout }));
            },
        );
        expect(output.code).toBe(0);
        expect(output.stdout).toBe("");
        expect(output.stderr).toBe("");
    });
});
