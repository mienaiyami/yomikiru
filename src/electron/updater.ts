import fs from "fs";
import path from "path";
import IS_PORTABLE from "./IS_PORTABLE";
import { spawn } from "child_process";
import { app, BrowserWindow, dialog, shell } from "electron";
import fetch from "electron-fetch";
import crossZip from "cross-zip";
import logger from "electron-log";
import { download, File } from "electron-dl";
import { exec as execSudo } from "@vscode/sudo-prompt";

declare const DOWNLOAD_PROGRESS_WEBPACK_ENTRY: string;

const downloadLink = "https://github.com/mienaiyami/yomikiru/releases/download/v";
/**
 *
 * @param windowId id of window in which message box should be shown
 * @param promptAfterCheck (false by default) Show message box if current version is same as latest version.
 */
const checkForUpdate = async (windowId: number, skipMinor = false, promptAfterCheck = false) => {
    const rawdata = await fetch("https://api.github.com/repos/mienaiyami/yomikiru/releases").then((data) =>
        data.json()
    );
    const latestVersion: number[] = await rawdata
        .find((e: any) => e.tag_name.charAt(0) === "v")
        .tag_name.substr(1)
        .split(".")
        .map((e: string) => parseInt(e));
    logger.log("checking for update...");
    const currentAppVersion = app
        .getVersion()
        .split(".")
        .map((e) => parseInt(e));
    logger.log("Latest version ", latestVersion.join("."));
    logger.log("Current version ", currentAppVersion.join("."));
    if (skipMinor) {
        if (latestVersion[0] === currentAppVersion[0] && latestVersion[1] === currentAppVersion[1]) {
            logger.log("Minor update available, skipping update.");
            return;
        }
    }
    const window = BrowserWindow.fromId(windowId ?? 1)!;
    if (
        latestVersion[0] > currentAppVersion[0] ||
        (latestVersion[0] === currentAppVersion[0] && latestVersion[1] > currentAppVersion[1]) ||
        (latestVersion[0] === currentAppVersion[0] &&
            latestVersion[1] === currentAppVersion[1] &&
            latestVersion[2] > currentAppVersion[2])
    ) {
        dialog
            .showMessageBox(window, {
                type: "info",
                title: "New Version Available",
                message:
                    `Current Version : ${currentAppVersion.join(".")}\n` +
                    `Latest Version   : ${latestVersion.join(".")}` +
                    (latestVersion[0] === currentAppVersion[0] && latestVersion[1] === currentAppVersion[1]
                        ? `\n\nTo skip check for minor updates, enable "skip minor update" in settings`
                        : ""),
                buttons: ["Download Now", "Download and show Changelog", "Show Changelog", "Download Later"],
                cancelId: 3,
            })
            .then((response) => {
                if (response.response === 0) downloadUpdates(latestVersion.join("."), windowId);
                if (response.response === 1) {
                    downloadUpdates(latestVersion.join("."), windowId);
                    shell.openExternal("https://github.com/mienaiyami/yomikiru/releases");
                }
                if (response.response === 2) {
                    shell.openExternal("https://github.com/mienaiyami/yomikiru/releases");
                }
            });
        return;
    }
    logger.log("Running latest version.");
    if (promptAfterCheck) {
        dialog.showMessageBox(window, {
            type: "info",
            title: "Yomikiru",
            message: "Running latest version",
            buttons: [],
        });
    }
};
/**
 *
 * @param latestVersion latest version ex. "2.3.8"
 * @param windowId id of window in which message box should be shown
 */
const downloadUpdates = (latestVersion: string, windowId: number) => {
    const newWindow = new BrowserWindow({
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
    newWindow.loadURL(DOWNLOAD_PROGRESS_WEBPACK_ENTRY);
    newWindow.setMenuBarVisibility(false);
    newWindow.webContents.once("dom-ready", () => {
        newWindow.webContents.send("version", latestVersion);
    });

    const window = BrowserWindow.fromId(windowId ?? 1)!;
    const tempPath = path.join(app.getPath("temp"), "yomikiru updates " + new Date().toDateString());
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true, force: true });
    fs.mkdirSync(tempPath);
    const promptInstall = () => {
        newWindow.close();
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
                    app.quit();
                }
            });
    };
    const downloadFile = (dl: string, webContents: Electron.WebContents, callback: (file: File) => void) => {
        download(window, dl, {
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
                webContents.send("progress", progress);
            },
        }).catch((reason) => {
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
                    ? downloadLink + latestVersion + "/" + `Yomikiru-win32-v${latestVersion}-Portable.zip`
                    : downloadLink + latestVersion + "/" + `Yomikiru-win32-v${latestVersion}-Portable-x64.zip`;
            const extractPath = path.join(tempPath, "updates");
            if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath);

            downloadFile(dl, newWindow.webContents, (file) => {
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
                                    "exe"
                                )}' ; ; "`,
                            { shell: true, cwd: appDirName }
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
                    ? downloadLink + latestVersion + "/" + `Yomikiru-v${latestVersion}-Setup.exe`
                    : downloadLink + latestVersion + "/" + `Yomikiru-v${latestVersion}-Setup-x64.exe`;
            downloadFile(dl, newWindow.webContents, (file) => {
                logger.log(`${file.filename} downloaded.`);
                app.on("quit", () => {
                    logger.log("Installing updates...");
                    spawn(
                        `cmd.exe /c start powershell.exe "Write-Output 'Starting update...' ; Start-Sleep -Seconds 5.0 ; Start-Process '${file.path}'"`,
                        {
                            shell: true,
                        }
                    ).on("exit", process.exit);
                    logger.log("Quitting app...");
                });
                logger.log("Preparing to install updates...");
                promptInstall();
            });
        }
    else if (process.platform === "linux") {
        const dl = downloadLink + latestVersion + "/" + `Yomikiru-v${latestVersion}-amd64.deb`;
        downloadFile(dl, newWindow.webContents, (file) => {
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
                            }
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
                                }
                            );
                        });
                    }
                });
        });
    }
};
export default checkForUpdate;
