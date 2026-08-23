import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HttpStatusError, http, isHttpUrlLineList, shouldReplaceTextSnapshot, splitTextLines } from "@common/http";
import type { AppUpdateChannel } from "@common/types/ipc";
import { mainT } from "@electron/i18n/mainI18n";
import { exec as execSudo } from "@vscode/sudo-prompt";
import { app, BrowserWindow, dialog, shell } from "electron";
import * as electronDl from "electron-dl";
import * as semver from "semver";
import { IS_PORTABLE, isArchLinux, sleep } from "./util";
import { archiveService } from "./util/archive";
import { createMainLogger } from "./util/logger";

const logger = createMainLogger("updater");

declare const DOWNLOAD_PROGRESS_WEBPACK_ENTRY: string;

const argReleaseUrl = process.argv.find((e) => e.startsWith("--release-url="))?.split("=")[1];
const argReleasePage = process.argv.find((e) => e.startsWith("--release-page="))?.split("=")[1];

const REPO = "mienaiyami/yomikiru";

const ANNOUNCEMENTS_URL = `https://raw.githubusercontent.com/${REPO}/master/announcements.txt` as const;
const ANNOUNCEMENTS_DISCUSSION_URL = `https://github.com/${REPO}/discussions/categories/announcements` as const;
const RELEASES_URL = argReleaseUrl || (`https://api.github.com/repos/${REPO}/releases` as const);
const RELEASES_PAGE = argReleasePage || (`https://github.com/${REPO}/releases` as const);
const DOWNLOAD_LINK = `${RELEASES_PAGE}/download` as const;

type ArtifactMetadata = {
    name: string;
    platform: string;
    arch: string;
    type: string;
};

/** Narrows unknown JSON array elements to {@link ArtifactMetadata}. */
const isArtifactMetadata = (value: unknown): value is ArtifactMetadata => {
    if (typeof value !== "object" || value === null) return false;
    const rec = value as Record<string, unknown>;
    return (
        typeof rec.name === "string" &&
        typeof rec.platform === "string" &&
        typeof rec.arch === "string" &&
        typeof rec.type === "string"
    );
};

/**
 * Fetches artifacts.json from the release and returns the download URL for the current platform/arch.
 * @param version release tag (e.g. "v2.3.8")
 * @returns download URL or null if no matching artifact
 */
const getArtifactDownloadUrl = async (version: string): Promise<string | null> => {
    try {
        const url = version.startsWith("v") ? version : `v${version}`;
        const artifactsUrl = `${DOWNLOAD_LINK}/${url}/artifacts.json`;
        const artifacts = await http.getJson(artifactsUrl);
        const catalog = Array.isArray(artifacts) ? artifacts.filter(isArtifactMetadata) : [];
        if (catalog.length === 0) {
            logger.warn(`Update: artifacts.json missing or empty for ${artifactsUrl}`);
            return null;
        }
        const platform = process.platform as string;
        const arch = process.arch === "ia32" ? "ia32" : process.arch === "x64" ? "x64" : process.arch;
        const wantPortable = platform === "win32" && IS_PORTABLE;
        const wantType = wantPortable ? "portable" : platform === "win32" ? "installer" : "package";

        let match: ArtifactMetadata | null = null;
        if (platform === "win32") {
            match = catalog.find((a) => a.platform === "win32" && a.type === wantType && a.arch === arch) ?? null;
        } else if (platform === "linux") {
            if (isArchLinux()) {
                match = catalog.find((a) => a.platform === "linux" && a.name.endsWith(".pkg.tar.zst")) ?? null;
            } else {
                match = catalog.find((a) => a.platform === "linux" && a.name.endsWith(".deb")) ?? null;
            }
        }

        if (!match) {
            logger.warn("Update: no build artifact for this OS/install type", { platform, arch, wantType });
            return null;
        }
        return `${DOWNLOAD_LINK}/${url}/${match.name}`;
    } catch (error) {
        if (error instanceof HttpStatusError) {
            logger.warn("Update: artifacts.json HTTP error", {
                status: error.status,
                statusText: error.statusText,
                url: error.url,
            });
            return null;
        }
        logger.error("Update: could not resolve download URL from artifacts.json", error);
        return null;
    }
};

/**
 * Downloads announcements.txt and shows a dialog only for URLs not already stored locally.
 * Failed HTTP responses throw from {@link http} and must not persist; error HTML would
 * overwrite the seen list and re-alert on every later successful request.
 */
const checkForAnnouncements = async () => {
    try {
        await sleep(5000);
        const body = await http.getText(ANNOUNCEMENTS_URL);
        const raw = splitTextLines(body);
        const existingPath = path.join(app.getPath("userData"), "announcements.txt");
        if (!fs.existsSync(existingPath)) {
            fs.writeFileSync(existingPath, "");
        }
        const existing = splitTextLines(fs.readFileSync(existingPath, "utf-8"));
        if (!shouldReplaceTextSnapshot(raw, existing)) {
            logger.warn("Announcements: ok response was empty; keeping local seen list");
            return;
        }
        if (!isHttpUrlLineList(raw)) {
            logger.warn("Announcements: remote body is not an http(s) URL list; keeping local seen list", {
                lineCount: raw.length,
            });
            return;
        }
        const newAnnouncements = raw.filter((e) => !existing.includes(e));
        // persist only after a validated 2xx body so a failed check cannot reset seen URLs
        fs.writeFileSync(existingPath, raw.join("\n"));
        const t = mainT;
        if (newAnnouncements.length === 1)
            dialog
                .showMessageBox({
                    type: "info",
                    title: t("updater.newAnnouncementTitle", { ns: "electron" }),
                    message: t("updater.newAnnouncementMessage", { ns: "electron" }),
                    detail: newAnnouncements[0],
                    buttons: [t("buttons.show", { ns: "dialogs" }), t("buttons.dismiss", { ns: "dialogs" })],
                    cancelId: 1,
                })
                .then((res) => {
                    if (res.response === 0) shell.openExternal(newAnnouncements[0]);
                });
        else if (newAnnouncements.length > 1)
            dialog
                .showMessageBox({
                    type: "info",
                    title: t("updater.newAnnouncementsTitle", { ns: "electron" }),
                    message: t("updater.newAnnouncementsMessage", { ns: "electron" }),
                    detail: newAnnouncements.join("\n"),
                    buttons: [
                        t("updater.openEach", { ns: "electron" }),
                        t("updater.openAnnouncementPage", { ns: "electron" }),
                        t("buttons.dismiss", { ns: "dialogs" }),
                    ],
                    cancelId: 2,
                })
                .then((res) => {
                    if (res.response === 0) newAnnouncements.forEach((e) => void shell.openExternal(e));
                    else if (res.response === 1) shell.openExternal(ANNOUNCEMENTS_DISCUSSION_URL);
                });
    } catch (error) {
        logger.error("Announcements: request or parse failed (non-fatal)", error);
    }
};

/** GitHub releases API item fields used for channel filter and semver sort. */
type GithubRelease = {
    tag_name: string;
    prerelease?: boolean;
};

/**
 * Check for updates and handle version comparison properly using semver.
 * Non-ok GitHub responses throw before JSON is treated as a release list.
 * @param windowId id of window in which message box should be shown
 * @param skipPatch skip patch updates for stable channel (e.g. 1.2.x to 1.2.y)
 * @param promptAfterCheck show message box if current version is same as latest version
 * @param autoDownload automatically download updates if available
 * @param channel update channel to check (stable or beta)
 */
const checkForUpdate = async (
    windowId: number,
    channel: AppUpdateChannel,
    skipPatch = false,
    promptAfterCheck = false,
    autoDownload = false,
): Promise<void> => {
    checkForAnnouncements();

    try {
        const rawdata = await http.getJson(RELEASES_URL);

        if (!Array.isArray(rawdata) || rawdata.length === 0) {
            logger.log("Update check: GitHub releases API returned no usable releases");
            if (promptAfterCheck) {
                showNoReleasesMessage(windowId, channel);
            }
            return;
        }

        const currentVersion = app.getVersion();
        logger.log(`Update check: installed version ${currentVersion}`);

        const releases = rawdata
            .filter((value: unknown): value is GithubRelease => {
                if (typeof value !== "object" || value === null) return false;
                const release = value as { tag_name?: unknown; prerelease?: unknown };
                if (typeof release.tag_name !== "string" || !semver.clean(release.tag_name, { loose: true })) {
                    return false;
                }
                if (channel === "stable") {
                    return !release.prerelease;
                }
                // beta channel: every tagged release; the highest semver is picked after sort
                if (channel === "beta") {
                    return true;
                }
                return false;
            })
            .sort((a, b) => {
                const versionA = semver.clean(a.tag_name, { loose: true }) || "";
                const versionB = semver.clean(b.tag_name, { loose: true }) || "";
                return semver.rcompare(versionA, versionB);
            });

        if (releases.length === 0) {
            logger.log(`Update check: no ${channel} channel releases after filtering`);
            if (promptAfterCheck) {
                showNoReleasesMessage(windowId, channel);
            }
            return;
        }

        const latestRelease = releases[0];
        const latestVersion = semver.clean(latestRelease.tag_name, { loose: true }) || "";

        logger.log(`Update check: latest ${channel} tag -> ${latestVersion}`);

        const versionDiff = semver.diff(currentVersion, latestVersion);
        const isNewer = semver.gt(latestVersion, currentVersion);

        if (skipPatch && channel === "stable" && versionDiff === "patch") {
            logger.log(`Update: newer ${versionDiff} build available but skipped (skip patch updates enabled)`);
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

        logger.log("Update check: already on latest matching release");
        if (promptAfterCheck) {
            const window = BrowserWindow.fromId(windowId ?? 1)!;
            const t = mainT;
            dialog.showMessageBox(window, {
                type: "info",
                title: t("updater.appTitle", { ns: "electron" }),
                message: t("updater.runningLatest", { ns: "electron" }),
                buttons: [],
            });
        }
    } catch (error) {
        logger.error("Update check: GitHub API or semver comparison failed", error);
        if (promptAfterCheck) {
            const window = BrowserWindow.fromId(windowId ?? 1)!;
            const t = mainT;
            dialog.showMessageBox(window, {
                type: "error",
                title: t("updater.checkFailedTitle", { ns: "electron" }),
                message: t("updater.checkFailedMessage", { ns: "electron" }),
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
    const t = mainT;
    dialog.showMessageBox(window, {
        type: "info",
        title: t("updater.appTitle", { ns: "electron" }),
        message: t("updater.noReleases", { ns: "electron", channel }),
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
    const t = mainT;

    const skipPatchHint = versionDiff === "patch" ? t("updater.skipPatchHint", { ns: "electron" }) : "";

    dialog
        .showMessageBox(window, {
            type: "info",
            title: t("updater.newVersionTitle", { ns: "electron" }),
            message: t("updater.versionCompare", {
                ns: "electron",
                current: currentVersion,
                latest: latestVersion,
            }),
            detail: skipPatchHint,
            buttons: [
                t("updater.downloadNow", { ns: "electron" }),
                t("updater.downloadAndChangelog", { ns: "electron" }),
                t("updater.showChangelog", { ns: "electron" }),
                t("updater.downloadLater", { ns: "electron" }),
            ],
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

    let downloadItem: Electron.DownloadItem | null = null;
    let isClosingDownloadWindowProgrammatically = false;
    if (newWindow) {
        newWindow.loadURL(DOWNLOAD_PROGRESS_WEBPACK_ENTRY);
        newWindow.setMenuBarVisibility(false);
        newWindow.webContents.once("dom-ready", () => {
            newWindow.webContents.send("version", latestVersion);
        });
        newWindow.on("close", () => {
            if (isClosingDownloadWindowProgrammatically) {
                return;
            }
            logger.log("Update download: progress window closed by user; canceling DownloadItem");
            downloadItem?.cancel();
        });
    }

    const window = BrowserWindow.fromId(windowId ?? 1)!;
    const tempPath = path.join(app.getPath("temp"), `yomikiru updates ${new Date().toDateString()}`);
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true, force: true });
    fs.mkdirSync(tempPath);
    let setupInstallOnQuit: (() => void) | null = null;
    let performInstallNow: (() => void) | null = null;

    const promptInstall = () => {
        if (newWindow instanceof BrowserWindow) {
            isClosingDownloadWindowProgrammatically = true;
            newWindow.close();
        }

        const showMainPrompt = () => {
            const t = mainT;
            const buttons = [
                t("updater.installNow", { ns: "electron" }),
                t("updater.installOnQuit", { ns: "electron" }),
            ];
            if (silent) buttons.push(t("updater.installAndChangelog", { ns: "electron" }));
            dialog
                .showMessageBox(window, {
                    type: "info",
                    title: t("updater.downloadedTitle", { ns: "electron" }),
                    message: t("updater.downloadedMessage", { ns: "electron" }),
                    buttons,
                    cancelId: 1,
                })
                .then((res) => {
                    if (res.response === 0) {
                        performInstallNow?.();
                    }
                    if (res.response === 1) {
                        setupInstallOnQuit?.();
                    }
                    if (res.response === 2) {
                        shell.openExternal(RELEASES_PAGE);
                        performInstallNow?.();
                    }
                });
        };

        // https://github.com/mienaiyami/yomikiru/discussions/451#discussioncomment-13778852
        if (process.platform === "win32" && !IS_PORTABLE) {
            const t = mainT;
            dialog
                .showMessageBox(window, {
                    type: "warning",
                    title: t("updater.installNoticeTitle", { ns: "electron" }),
                    message: t("updater.installNoticeMessage", { ns: "electron" }),
                    detail: t("updater.installNoticeDetail", { ns: "electron" }),
                    buttons: [
                        t("updater.tryNormalInstall", { ns: "electron" }),
                        t("updater.installManually", { ns: "electron" }),
                        t("updater.installManuallyChangelog", { ns: "electron" }),
                        t("updater.moreInfo", { ns: "electron" }),
                    ],
                    cancelId: 1,
                })
                .then((res) => {
                    if (res.response === 0) {
                        showMainPrompt();
                    } else if (res.response === 1) {
                        shell.openPath(tempPath);
                    } else if (res.response === 2) {
                        shell.openPath(tempPath);
                        shell.openExternal(RELEASES_PAGE);
                    } else if (res.response === 3) {
                        shell.openExternal(
                            "https://github.com/mienaiyami/yomikiru/discussions/451#discussioncomment-13778852",
                        );
                    }
                });
        } else {
            showMainPrompt();
        }
    };
    const downloadFile = (
        dl: string,
        webContents: Electron.WebContents | false,
        callback: (file: electronDl.File) => void,
    ) => {
        electronDl
            .download(window, dl, {
                directory: tempPath,
                onStarted: (e) => {
                    downloadItem = e;
                    logger.log(`Update download started -> ${dl}`);
                    logger.log(`Update download temp dir: "${tempPath}"`);
                    e.once("done", (_, state) => {
                        if (state !== "completed") {
                            const t = mainT;
                            dialog.showMessageBox(window, {
                                type: "error",
                                title: t("updater.downloadErrorTitle", { ns: "electron" }),
                                message:
                                    state === "cancelled"
                                        ? t("updater.downloadCanceled", { ns: "electron" })
                                        : t("updater.downloadFailed", { ns: "electron" }),
                            });
                        }
                    });
                },
                onCancel: () => {
                    downloadItem = null;
                    logger.log("Update download: canceled by user or system");
                },
                onCompleted: (file) => {
                    downloadItem = null;
                    callback(file);
                },
                onProgress: (progress) => {
                    webContents && !webContents.isDestroyed() && webContents.send("progress", progress);
                },
            })
            .catch((e) => {
                downloadItem = null;
                const t = mainT;
                dialog.showMessageBox(window, {
                    type: "error",
                    title: t("updater.downloadErrorTitle", { ns: "electron" }),
                    message: t("updater.downloadErrorPersist", { ns: "electron", error: String(e) }),
                });
            });
    };

    const webContents = newWindow instanceof BrowserWindow ? newWindow.webContents : false;

    void (async () => {
        const dl = await getArtifactDownloadUrl(latestVersion);
        if (!dl) {
            logger.error(`Update download: no artifact URL for v${latestVersion} (see artifacts.json)`);
            const t = mainT;
            dialog
                .showMessageBox(window, {
                    type: "error",
                    title: t("updater.updateFailedTitle", { ns: "electron" }),
                    message: t("updater.noArtifact", { ns: "electron" }),
                    buttons: [t("updater.openReleases", { ns: "electron" }), t("buttons.ok", { ns: "dialogs" })],
                })
                .then((res) => {
                    if (res.response === 0) shell.openExternal(RELEASES_PAGE);
                });
            return;
        }

        if (process.platform === "win32") {
            if (IS_PORTABLE) {
                const extractPath = path.join(tempPath, "updates");
                if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath);

                downloadFile(dl, webContents, (file) => {
                    logger.log(`Update package saved: ${file.filename}`);
                    void archiveService
                        .extractAll(file.path, extractPath)
                        .then(() => {
                            logger.log(`Portable update: extracted to "${extractPath}"`);
                            const appPath = path.join(app.getAppPath(), "../../");
                            const appDirName = path.join(app.getPath("exe"), "../");
                            setupInstallOnQuit = () => {
                                app.once("quit", () => {
                                    logger.log("Portable update: copying files over install dir (on quit)");
                                    logger.log(`Portable update: target base "${appPath}"`);
                                    spawn(
                                        `cmd.exe /c start powershell.exe " Write-Output 'Starting update...' ; Start-Sleep -Seconds 5.0 ;` +
                                            ` $sourcePath = Join-Path '${extractPath}' '*' ; ` +
                                            ` $destPath = '${appDirName}' ; ` +
                                            ` Get-ChildItem -Path $destPath -Recurse -Force | Where-Object { $_.FullName -notmatch 'userdata'} | Remove-Item -Force -Recurse ; ` +
                                            ` Write-Output 'Moving extracted files...' ; Start-Sleep -Seconds 1.9 ; ` +
                                            ` Copy-Item -Path $sourcePath -Destination $destPath -Force -Recurse ; ` +
                                            ` Write-Output 'Updated, launching app.' ; Start-Sleep -Seconds 2.0 ; ` +
                                            ` & '${app.getPath("exe")}' ; "`,
                                        { shell: true, cwd: appDirName },
                                    ).on("exit", process.exit);
                                    logger.log("Portable update: exiting so PowerShell can replace files");
                                });
                                logger.log("Portable update: will run file copy on next app quit");
                            };
                            performInstallNow = () => {
                                setupInstallOnQuit?.();
                                logger.log("Portable update: quitting now to start install");
                                app.quit();
                            };
                            logger.log("Portable update: package ready; waiting for user install choice");
                            promptInstall();
                        })
                        .catch((err) => logger.error("Portable update: archive extract failed", err));
                });
            } else {
                downloadFile(dl, webContents, (file) => {
                    logger.log(`Installer downloaded: ${file.filename}`);
                    setupInstallOnQuit = () => {
                        app.once("quit", () => {
                            logger.log("Win32 update: launching downloaded installer on quit");
                            spawn(
                                `cmd.exe /c start powershell.exe "Write-Output 'Starting update...' ; Start-Sleep -Seconds 5.0 ; Start-Process '${file.path}'"`,
                                {
                                    shell: true,
                                },
                            ).on("exit", process.exit);
                            logger.log("Win32 update: process exit after spawning installer");
                        });
                        logger.log("Win32 update: installer will run on next quit");
                    };
                    performInstallNow = () => {
                        setupInstallOnQuit?.();
                        logger.log("Win32 update: quitting to run installer now");
                        app.quit();
                    };
                    logger.log("Win32 update: installer ready; waiting for user choice");
                    promptInstall();
                });
            }
        } else if (process.platform === "linux") {
            /**
             * Installs a Linux package via sudo prompt.
             * Note: we avoid throwing inside callbacks to prevent crashing the app.
             */
            const installWithSudo = (command: string): Promise<void> =>
                new Promise((resolve, reject) => {
                    logger.log("Linux update: running package manager via sudo", command);
                    execSudo(command, { name: "Yomikiru" }, (err) => {
                        if (err) {
                            logger.error("Linux update: sudo package install failed", err);
                            reject(err);
                            return;
                        }
                        logger.log("Linux update: package install finished successfully");
                        resolve();
                    });
                });

            const relaunchAndQuit = () => {
                logger.log("Linux update: relaunching application");
                app.relaunch();
                app.quit();
            };

            const showInstallError = (err: unknown) => {
                const t = mainT;
                dialog.showMessageBox(window, {
                    type: "error",
                    title: t("updater.installFailedTitle", { ns: "electron" }),
                    message: t("updater.installFailedMessage", { ns: "electron" }),
                    detail: err instanceof Error ? err.message : String(err),
                    buttons: [t("buttons.ok", { ns: "dialogs" })],
                });
            };

            const afterDownload = (file: { filename: string; path: string }) => {
                logger.log(`Linux update: package saved (${file.filename})`);
                if (newWindow instanceof BrowserWindow) {
                    isClosingDownloadWindowProgrammatically = true;
                    newWindow.close();
                }

                const cmd = isArchLinux() ? `pacman -U --noconfirm "${file.path}"` : `dpkg -i "${file.path}"`;
                setupInstallOnQuit = () => {
                    app.once("before-quit", () => {
                        void installWithSudo(cmd).catch(showInstallError);
                    });
                    logger.log(`Linux update: ${isArchLinux() ? "pacman" : "dpkg"} install scheduled on quit`);
                };
                performInstallNow = () => {
                    void (async () => {
                        try {
                            await installWithSudo(cmd);
                            relaunchAndQuit();
                        } catch (err) {
                            showInstallError(err);
                        }
                    })();
                };

                logger.log("Linux update: package ready; waiting for user install choice");
                promptInstall();
            };

            downloadFile(dl, webContents, afterDownload);
        }
    })();
};

export default checkForUpdate;
