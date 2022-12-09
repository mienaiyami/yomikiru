import fs from "fs";
import path from "path";
import IS_PORTABLE from "./IS_PORTABLE";
import { spawn, spawnSync } from "child_process";
import { app, BrowserWindow, dialog } from "electron";
import fetch from "electron-fetch";
import crossZip from "cross-zip";
import logger from "electron-log";

/**
 * prevent deletion of these files in "Portable" version of app on installing new update.
 * add new settings/store file to this.
 */
const fileToKeep = [
    "bookmarks.json",
    "history.json",
    "settings.json",
    "themes.json",
    "shortcuts.json",
    "logs",
    "main.log",
    "renderer.log",
];

const downloadLink = "https://github.com/mienaiyami/react-ts-offline-manga-reader/releases/download/v";
/**
 *
 * @param windowId id of window in which message box should be shown
 * @param promptAfterCheck (false by default) Show message box if current version is same as latest version.
 */
const checkForUpdate = async (windowId: number, promptAfterCheck = false) => {
    const rawdata = await fetch(
        "https://raw.githubusercontent.com/mienaiyami/react-ts-offline-manga-reader/master/package.json"
    ).then((data) => data.json());
    const latestVersion: number[] = await rawdata.version.split(".").map((e: string) => parseInt(e));
    logger.log("checking for update...");
    const currentAppVersion = app
        .getVersion()
        .split(".")
        .map((e) => parseInt(e));
    logger.log("Latest version ", latestVersion.join("."));
    logger.log("Current version ", currentAppVersion.join("."));

    if (
        latestVersion[0] > currentAppVersion[0] ||
        (latestVersion[0] === currentAppVersion[0] && latestVersion[1] > currentAppVersion[1]) ||
        (latestVersion[0] === currentAppVersion[0] &&
            latestVersion[1] === currentAppVersion[1] &&
            latestVersion[2] > currentAppVersion[2])
    ) {
        dialog
            .showMessageBox(BrowserWindow.fromId(windowId ?? 1)!, {
                type: "info",
                title: "New Version Available",
                message: `New Version Available.\nCurrent Version:\t${currentAppVersion.join(
                    "."
                )}\nLatest Version:\t${latestVersion.join(".")}
                `,
                buttons: ["Download Now", "Download and show Changelog", "Download Later"],
                cancelId: 2,
            })
            .then((response) => {
                if (response.response === 0) downloadUpdates(latestVersion.join("."), windowId);
                if (response.response === 1) {
                    downloadUpdates(latestVersion.join("."), windowId);
                    // shell.openExternal("https://github.com/mienaiyami/react-ts-offline-manga-reader/releases");

                    const newWindow = new BrowserWindow({
                        width: 1200,
                        height: 800,
                        minWidth: 940,
                        minHeight: 560,
                        backgroundColor: "#272727",
                    });
                    newWindow.loadURL("https://github.com/mienaiyami/react-ts-offline-manga-reader/releases");
                    newWindow.setMenuBarVisibility(false);
                }
            });
        return;
    }
    logger.log("Running latest version.");
    if (promptAfterCheck) {
        dialog.showMessageBox(BrowserWindow.fromId(windowId ?? 1)!, {
            type: "info",
            title: "Manga Reader",
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
    logger.log("Downloading updates...");
    const tempPath = path.join(
        app.getPath("temp"),
        "manga reader updates " + new Date().toLocaleString("en-UK", { hour12: true })
    );
    if (fs.existsSync(tempPath)) spawnSync("powershell.exe", [`rm "${tempPath}" -r -force`]);
    fs.mkdirSync(tempPath);
    logger.log(tempPath);
    const downloadError = (dl: string) => {
        dialog.showMessageBox(BrowserWindow.fromId(windowId ?? 1)!, {
            type: "error",
            title: "Download Error",
            message: "File did not download.\n" + dl,
        });
    };
    const promptInstall = () => {
        dialog
            .showMessageBox(BrowserWindow.fromId(windowId ?? 1)!, {
                type: "info",
                title: "Updates downloaded",
                message: "Updates downloaded.",
                buttons: ["Install Now", "Install on Close"],
                cancelId: 1,
            })
            .then((res) => {
                if (res.response === 0) {
                    logger.log("Selected option to install now.");
                    app.quit();
                } else {
                    logger.log("Selected option to install on close.");
                }
            });
    };
    if (IS_PORTABLE) {
        const dl = downloadLink + latestVersion + "/" + `Manga.Reader-win32-${latestVersion}-Portable.zip`;
        const filePath = path.join(tempPath, "updates.zip");
        const extractPath = path.join(tempPath, "updates");
        if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath);
        const ps = spawn("powershell.exe", [`iwr -outf "${filePath}" "${dl}"`]);

        const updateHandler = () => {
            if (fs.existsSync(filePath)) {
                logger.log("portable.zip downloaded.");
                crossZip.unzip(filePath, extractPath, (err) => {
                    if (err) return logger.error(err);
                    logger.log("Successfully extracted at " + extractPath);
                    const appPath = path.join(app.getAppPath(), "../../");
                    logger.log("Moving files to ", appPath);
                    const appDirName = path.join(app.getPath("exe"), "../");
                    app.on("before-quit", () => {
                        logger.log("Installing updates...");
                        spawn(
                            "start",
                            [
                                `powershell.exe Start-Sleep -Seconds 5.0 ; Remove-Item -Recurse -Force '${appDirName}\\*' -Exclude ${fileToKeep.join(
                                    ","
                                )} ; ; Move-Item -Path '${extractPath}\\*' -Destination '${appDirName}'`,
                            ],
                            { shell: true }
                        ).on("exit", process.exit);
                        logger.log("Quitting app...");
                    });

                    logger.log("Preparing to install updates...");
                    promptInstall();
                });
            } else {
                logger.error("File did not download.");
                downloadError(dl);
            }
        };
        ps.on("error", (err) => logger.error(err));
        ps.stderr.on("data", (e) => {
            logger.error("ps stderr: ", e.toString());
            logger.error("File did not download.");
            ps.off("close", updateHandler);
            ps.stderr.removeAllListeners();
            downloadError(dl);
        });
        ps.stdout.on("data", (e) => logger.log("ps stdout: ", e.toString()));
        ps.on("close", updateHandler);
    } else {
        const dl = downloadLink + latestVersion + "/" + `Manga.Reader-${latestVersion}-Setup.exe`;
        const filePath = path.join(tempPath, `Manga.Reader-${latestVersion}-Setup.exe`);
        const ps = spawn("powershell.exe", [`iwr -outf "${filePath}" "${dl}"`]);

        const updateHandler = () => {
            if (fs.existsSync(filePath)) {
                logger.log(`Manga.Reader-${latestVersion}-Setup.exe downloaded.`);
                app.on("before-quit", () => {
                    logger.log("Installing updates...");
                    logger.log(`powershell.exe Start-Sleep -Seconds 5.0 ;Start-Process '${filePath}'`);
                    spawn("start", [`powershell.exe Start-Sleep -Seconds 5.0 ; Start-Process '${filePath}'`], {
                        shell: true,
                    }).on("exit", process.exit);
                    logger.log("Quitting app...");
                });
                logger.log("Preparing to install updates...");
                promptInstall();
            } else {
                logger.error("File did not download.");
                downloadError(dl);
            }
        };

        ps.on("error", (err) => logger.error(err));
        ps.stderr.on("data", (e) => {
            logger.error("ps stderr: ", e.toString());
            logger.error("File did not download.");
            ps.off("close", updateHandler);
            ps.stderr.removeAllListeners();
            downloadError(dl);
        });
        ps.stdout.on("data", (e) => logger.log("ps stdout: ", e.toString()));
        ps.on("close", updateHandler);
    }
};
export default checkForUpdate;
