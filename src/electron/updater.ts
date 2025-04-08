import fs from "fs";
import path from "path";
import { IS_PORTABLE } from "./util";
import { spawn } from "child_process";
import { app, BrowserWindow, dialog, shell } from "electron";
import fetch from "electron-fetch";
import * as crossZip from "cross-zip";
import logger from "electron-log";
import * as electronDl from "electron-dl";
import { exec as execSudo } from "@vscode/sudo-prompt";
import { AppUpdateChannel } from "@common/types/ipc";
import * as semver from "semver";

declare const DOWNLOAD_PROGRESS_WEBPACK_ENTRY: string;

const argReleaseUrl = process.argv.find((e) => e.startsWith("--release-url="))?.split("=")[1];
const argReleasePage = process.argv.find((e) => e.startsWith("--release-page="))?.split("=")[1];

const REPO = "mienaiyami/yomikiru";

const ANNOUNCEMENTS_URL = `https://raw.githubusercontent.com/${REPO}/master/announcements.txt`;
const ANNOUNCEMENTS_DISCUSSION_URL = `https://github.com/${REPO}/discussions/categories/announcements`;
const RELEASES_URL = argReleaseUrl || `https://api.github.com/repos/${REPO}/releases`;
const RELEASES_PAGE = argReleasePage || `https://github.com/${REPO}/releases`;
const DOWNLOAD_LINK = `${RELEASES_PAGE}/download`;

const checkForAnnouncements = async () => {
    try {
        const raw = await fetch(ANNOUNCEMENTS_URL)
            .then((data) => data.text())
            .then((data) => data.split("\n").filter((e) => e !== ""));
        const existingPath = path.join(app.getPath("userData"), "announcements.txt");
        if (!fs.existsSync(existingPath)) {
            fs.writeFileSync(existingPath, "");
        }
        const existing = fs
            .readFileSync(path.join(app.getPath("userData"), "announcements.txt"), "utf-8")
            .split("\n")
            .filter((e) => e !== "");
        const newAnnouncements = raw.filter((e) => !existing.includes(e));
        fs.writeFileSync(existingPath, raw.join("\n"));
        if (newAnnouncements.length === 1)
            dialog
                .showMessageBox({
                    type: "info",
                    title: "New Announcement",
                    message: "There's a new announcement. Check it out!",
                    detail: newAnnouncements[0],
                    buttons: ["Show", "Dismiss"],
                    cancelId: 1,
                })
                .then((res) => {
                    if (res.response === 0) shell.openExternal(newAnnouncements[0]);
                });
        else if (newAnnouncements.length > 1)
            dialog
                .showMessageBox({
                    type: "info",
                    title: "New Announcements",
                    message: "There are new announcements. Check them out!",
                    detail: newAnnouncements.join("\n"),
                    buttons: ["Open Each", "Open Announcement Page", "Dismiss"],
                    cancelId: 2,
                })
                .then((res) => {
                    if (res.response === 0) newAnnouncements.forEach((e) => shell.openExternal(e));
                    else if (res.response === 1) shell.openExternal(ANNOUNCEMENTS_DISCUSSION_URL);
                });
    } catch (error) {
        logger.error("checkForAnnouncements:", error);
    }
};

/**
 * Check for updates and handle version comparison properly using semver
 * @param windowId id of window in which message box should be shown
 * @param skipPatch skip patch updates for stable channel (e.g. 1.2.x to 1.2.y)
 * @param promptAfterCheck show message box if current version is same as latest version
 * @param autoDownload automatically download updates if available
 * @param channel update channel to check (stable or beta)
 */
const checkForUpdate = async (
    windowId: number,
    skipPatch = false,
    promptAfterCheck = false,
    autoDownload = false,
    channel: AppUpdateChannel,
): Promise<void> => {
    checkForAnnouncements();

    try {
        const rawdata = await fetch(RELEASES_URL).then((data) => data.json());

        if (!Array.isArray(rawdata) || rawdata.length === 0) {
            logger.log("No releases found or invalid response");
            if (promptAfterCheck) {
                showNoReleasesMessage(windowId, channel);
            }
            return;
        }

        const currentVersion = app.getVersion();
        logger.log("Current version:", currentVersion);

        const releases = rawdata
            .filter((release: any) => {
                const hasValidTagName =
                    typeof release.tag_name === "string" && semver.clean(release.tag_name, { loose: true });
                if (!hasValidTagName) return false;

                if (channel === "stable") {
                    return !release.prerelease;
                } else if (channel === "beta") {
                    // include all releases, the highest version will be selected later
                    return true;
                }
                return false;
            })
            .sort((a: any, b: any) => {
                const versionA = semver.clean(a.tag_name, { loose: true }) || "";
                const versionB = semver.clean(b.tag_name, { loose: true }) || "";
                return semver.rcompare(versionA, versionB);
            });

        if (releases.length === 0) {
            logger.log(`No ${channel} releases found.`);
            if (promptAfterCheck) {
                showNoReleasesMessage(windowId, channel);
            }
            return;
        }

        const latestRelease = releases[0];
        const latestVersion = semver.clean(latestRelease.tag_name, { loose: true }) || "";

        logger.log(`Latest ${channel} version:`, latestVersion);

        const versionDiff = semver.diff(currentVersion, latestVersion);
        const isNewer = semver.gt(latestVersion, currentVersion);

        if (skipPatch && channel === "stable" && versionDiff === "patch") {
            logger.log(`${versionDiff} update available, skipping due to settings.`);
            return;
        }

        if (isNewer) {
            if (autoDownload) {
                downloadUpdates(latestVersion, windowId, true);
            } else {
                showUpdateAvailableMessage(windowId, currentVersion, latestVersion, versionDiff);
            }
            return;
        }

        logger.log("Running latest version.");
        if (promptAfterCheck) {
            const window = BrowserWindow.fromId(windowId ?? 1)!;
            dialog.showMessageBox(window, {
                type: "info",
                title: "Yomikiru",
                message: "Running latest version",
                buttons: [],
            });
        }
    } catch (error) {
        logger.error("Error checking for updates:", error);
        if (promptAfterCheck) {
            const window = BrowserWindow.fromId(windowId ?? 1)!;
            dialog.showMessageBox(window, {
                type: "error",
                title: "Update Check Failed",
                message: "Failed to check for updates.",
                detail: error instanceof Error ? error.message : String(error),
            });
        }
    }
};

/**
 * Show message when no releases are found
 */
const showNoReleasesMessage = (windowId: number, channel: string) => {
    const window = BrowserWindow.fromId(windowId ?? 1)!;
    dialog.showMessageBox(window, {
        type: "info",
        title: "Yomikiru",
        message: `No ${channel} releases available.`,
        buttons: [],
    });
};

const showUpdateAvailableMessage = (
    windowId: number,
    currentVersion: string,
    latestVersion: string,
    versionDiff: string | null,
) => {
    const window = BrowserWindow.fromId(windowId ?? 1)!;

    const skipPatchHint =
        versionDiff === "patch"
            ? `To skip check for patch updates, enable "skip patch update" in settings.\nYou can also enable "auto download".`
            : "";

    dialog
        .showMessageBox(window, {
            type: "info",
            title: "New Version Available",
            message: `Current Version : ${currentVersion}\n` + `Latest Version   : ${latestVersion}`,
            detail: skipPatchHint,
            buttons: ["Download Now", "Download and show Changelog", "Show Changelog", "Download Later"],
            cancelId: 3,
        })
        .then((response) => {
            if (response.response === 0) downloadUpdates(latestVersion, windowId);
            if (response.response === 1) {
                downloadUpdates(latestVersion, windowId);
                shell.openExternal(RELEASES_PAGE);
            }
            if (response.response === 2) {
                shell.openExternal(RELEASES_PAGE);
            }
        });
};

/**
 * Download and prepare updates for installation
 * @param latestVersion latest version ex. "2.3.8"
 * @param windowId id of window in which message box should be shown
 * @param silent if true, don't show download progress window
 */
const downloadUpdates = (latestVersion: string, windowId: number, silent = false) => {
    const newWindow =
        !silent &&
        new BrowserWindow({
            width: 560,
            height: 160,
            resizable: false,
            backgroundColor: "#272727",
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                // enableRemoteModule: true,
                webSecurity: app.isPackaged,
                safeDialogs: true,
            },
            maximizable: false,
        });
    if (newWindow) {
        newWindow.loadURL(DOWNLOAD_PROGRESS_WEBPACK_ENTRY);
        newWindow.setMenuBarVisibility(false);
        newWindow.webContents.once("dom-ready", () => {
            newWindow.webContents.send("version", latestVersion);
        });
    }

    const window = BrowserWindow.fromId(windowId ?? 1)!;
    const tempPath = path.join(app.getPath("temp"), "yomikiru updates " + new Date().toDateString());
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true, force: true });
    fs.mkdirSync(tempPath);
    const promptInstall = () => {
        newWindow && newWindow.close();
        const buttons = ["Install Now", "Install on Quit"];
        if (silent) buttons.push("Install and Show Changelog");
        dialog
            .showMessageBox(window, {
                type: "info",
                title: "Updates downloaded",
                message: "Updates downloaded.",
                buttons,
                cancelId: 1,
            })
            .then((res) => {
                if (res.response === 0) {
                    app.quit();
                }
                if (res.response === 2) {
                    shell.openExternal(RELEASES_PAGE);
                    app.quit();
                }
            });
    };
    const downloadFile = (
        dl: string,
        webContents: Electron.WebContents | false,
        callback: (file: electronDl.File) => void,
    ) => {
        electronDl
            // eslint-disable-next-line import/namespace
            .download(window, dl, {
                directory: tempPath,
                onStarted: () => {
                    logger.log("Downloading updates...");
                    logger.log(dl, `"${tempPath}"`);
                },
                onCancel: () => {
                    logger.log("Download canceled.");
                },
                onCompleted: (file) => callback(file),
                onProgress: (progress) => {
                    webContents && webContents.send("progress", progress);
                },
            })
            .catch((reason) => {
                dialog.showMessageBox(window, {
                    type: "error",
                    title: "Error while downloading",
                    message: reason + "\n\nPlease check the homepage if persist.",
                });
            });
    };

    if (process.platform === "win32")
        if (IS_PORTABLE) {
            const dl =
                process.arch === "ia32"
                    ? `${DOWNLOAD_LINK}/v${latestVersion}/Yomikiru-win32-v${latestVersion}-Portable.zip`
                    : `${DOWNLOAD_LINK}/v${latestVersion}/Yomikiru-win32-v${latestVersion}-Portable-x64.zip`;
            const extractPath = path.join(tempPath, "updates");
            if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath);

            downloadFile(dl, newWindow && newWindow.webContents, (file) => {
                logger.log(`${file.filename} downloaded.`);
                crossZip.unzip(file.path, extractPath, (err) => {
                    if (err) return logger.error(err);
                    logger.log(`Successfully extracted at "${extractPath}"`);
                    const appPath = path.join(app.getAppPath(), "../../");
                    const appDirName = path.join(app.getPath("exe"), "../");
                    app.on("quit", () => {
                        logger.log("Installing updates...");
                        logger.log(`Moving files to "${appPath}"`);
                        spawn(
                            `cmd.exe /c start powershell.exe " Write-Output 'Starting update...' ; Start-Sleep -Seconds 5.0 ;` +
                                ` Get-ChildItem * -Recurse -Force | Where-Object { $_.FullName -notmatch 'userdata'} | Remove-Item -Force -Recurse ;` +
                                ` Write-Output 'Moving extracted files...' ; Start-Sleep -Seconds 1.9;  Move-Item -Path '${extractPath}\\*' -Destination '${appDirName}' ; ` +
                                ` Write-Output 'Updated, launching app.' ; Start-Sleep -Seconds 2.0 ;  explorer '${app.getPath(
                                    "exe",
                                )}' ; ; "`,
                            { shell: true, cwd: appDirName },
                        ).on("exit", process.exit);
                        logger.log("Quitting app...");
                    });
                    logger.log("Preparing to install updates...");
                    promptInstall();
                });
            });
        } else {
            const dl =
                process.arch === "ia32"
                    ? `${DOWNLOAD_LINK}/v${latestVersion}/Yomikiru-v${latestVersion}-Setup.exe`
                    : `${DOWNLOAD_LINK}/v${latestVersion}/Yomikiru-v${latestVersion}-Setup-x64.exe`;
            downloadFile(dl, newWindow && newWindow.webContents, (file) => {
                logger.log(`${file.filename} downloaded.`);
                app.on("quit", () => {
                    logger.log("Installing updates...");
                    spawn(
                        `cmd.exe /c start powershell.exe "Write-Output 'Starting update...' ; Start-Sleep -Seconds 5.0 ; Start-Process '${file.path}'"`,
                        {
                            shell: true,
                        },
                    ).on("exit", process.exit);
                    logger.log("Quitting app...");
                });
                logger.log("Preparing to install updates...");
                promptInstall();
            });
        }
    else if (process.platform === "linux") {
        const dl = `${DOWNLOAD_LINK}/v${latestVersion}/Yomikiru-v${latestVersion}-amd64.deb`;
        downloadFile(dl, newWindow && newWindow.webContents, (file) => {
            logger.log(`${file.filename} downloaded.`);
            dialog
                .showMessageBox(window, {
                    type: "info",
                    title: "Updates downloaded",
                    message: "Updates downloaded.",
                    buttons: ["Install Now", "Install on Quit"],
                    cancelId: 1,
                })
                .then((res) => {
                    if (res.response === 0) {
                        execSudo(
                            `dpkg -i "${file.path}"`,
                            {
                                name: "Yomikiru",
                            },
                            (err) => {
                                if (err) throw err;
                                logger.log("Installing updates...");
                            },
                        );
                    } else {
                        app.on("before-quit", () => {
                            execSudo(
                                `dpkg -i "${file.path}"`,
                                {
                                    name: "Yomikiru",
                                },
                                (err) => {
                                    dialog.showMessageBox({
                                        message: "Installing updates.",
                                        type: "info",
                                        title: "Yomikiru",
                                    });
                                    if (err) throw err;
                                    logger.log("Installing updates...");
                                },
                            );
                        });
                    }
                });
        });
    }
};

export default checkForUpdate;
