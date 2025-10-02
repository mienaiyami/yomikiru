import fs from "node:fs/promises";
import { ipc } from "@electron/ipc/utils";
import * as remote from "@electron/remote/main";
import { app, BrowserWindow, dialog, shell } from "electron";
import { getWindowFromWebContents, log } from ".";
import { MainSettings } from "./mainSettings";

declare const HOME_WEBPACK_ENTRY: string;
declare const HOME_PRELOAD_WEBPACK_ENTRY: string;

export class WindowManager {
    private static windows: (BrowserWindow | null)[] = [];
    private static deleteDirsOnClose: (string | null)[] = [];
    private static isFirstWindow = true;
    /**
     * for checking if window opened and loaded App without crashing
     */
    private static errorCheckTimeout: NodeJS.Timeout | null = null;

    static {
        if (process.platform === "win32") {
            WindowManager.setupWindowsTasks();
        }

        WindowManager.errorCheckTimeout = setTimeout(() => {
            dialog
                .showMessageBox({
                    type: "info",
                    message:
                        "If you are seeing blank window then check the github page for new version or create an issue if no new version is available.",
                    buttons: ["Ok", "Home Page"],
                })
                .then((e) => {
                    if (e.response === 1) shell.openExternal("https://github.com/mienaiyami/yomikiru");
                });
        }, 1000 * 10);
    }
    private constructor() {
        console.error("This class should not be instantiated.");
    }

    // taskbar right click option
    private static setupWindowsTasks() {
        app.setUserTasks([
            {
                program: process.execPath,
                arguments: "--new-window",
                iconPath: process.execPath,
                iconIndex: 0,
                title: "New Window",
                description: "Create a new window",
            },
        ]);
    }
    /**
     * Create main reader window.
     * @param link (optional) open given link/location in manga reader after loading window.
     */
    static createWindow(link?: string): BrowserWindow {
        const newWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 853,
            minHeight: 480,
            frame: false,
            backgroundColor: "#000000",
            show: false,
            titleBarStyle: process.platform === "win32" ? "hidden" : "default",
            titleBarOverlay: {
                color: "#2e2e2e",
                symbolColor: "#ffffff",
                height: 40,
            },
            webPreferences: {
                nodeIntegration: true,
                webSecurity: app.isPackaged,
                safeDialogs: true,
                preload: HOME_PRELOAD_WEBPACK_ENTRY,
            },
        });

        WindowManager.windows.push(newWindow);
        WindowManager.deleteDirsOnClose.push(null);

        WindowManager.setupWindow(newWindow, link);
        return newWindow;
    }

    private static setupWindow(window: BrowserWindow, link?: string) {
        window.loadURL(HOME_WEBPACK_ENTRY);
        window.setMenuBarVisibility(false);
        remote.enable(window.webContents);

        window.webContents.once("dom-ready", () => {
            // maximize also unhide window
            window.maximize();
            if (WindowManager.isFirstWindow) {
                ipc.send(window.webContents, "window:statusCheck");
                WindowManager.isFirstWindow = false;
            }
            if (link)
                ipc.send(window.webContents, "reader:loadLink", {
                    link,
                });
            WindowManager.handleWindowClose(window);
            window.webContents.on("render-process-gone", (detail) => {
                log.error("Render process gone:", detail);
                dialog
                    .showMessageBox({
                        type: "error",
                        message:
                            "App crashed. Please check the github page for new version or create an issue if no new version is available.",
                        buttons: ["Ok", "Home Page"],
                    })
                    .then((e) => {
                        if (e.response === 1) shell.openExternal("https://github.com/mienaiyami/yomikiru");
                    });
            });
        });

        window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    }

    static async handleWindowClose(window: BrowserWindow): Promise<void> {
        const currentWindowIndex = WindowManager.windows.findIndex((w) => w && w.id === window.id);

        const closeEvent = async (e: Electron.Event) => {
            e.preventDefault();
            let res = 1;
            if (MainSettings.getSettings().askBeforeClosing) {
                res = dialog.showMessageBoxSync(window, {
                    message: "Close this window?",
                    title: "Yomikiru",
                    buttons: ["No", "Yes"],
                    type: "question",
                });
            }
            if (res === 0) return;

            // it also destroys current window.
            // window closes before receiving message to save history, so it is needed
            ipc.send(window.webContents, "reader:recordPage");
            //backup in case window is stuck
            setTimeout(() => {
                if (!window.isDestroyed()) {
                    log.log("No response from window. Force closing app.");
                    window.destroy();
                }
            }, 5000);

            await WindowManager.cleanupTempDir(currentWindowIndex);
        };

        const onClosed = () => {
            WindowManager.windows[currentWindowIndex] = null;
            WindowManager.deleteDirsOnClose[currentWindowIndex] = null;
            if (WindowManager.windows.filter((w) => w !== null).length === 0) {
                app.quit();
            }
        };

        window.removeAllListeners("closed");
        window.removeAllListeners("close");
        window.on("closed", onClosed);
        window.on("close", closeEvent);
    }

    private static async cleanupTempDir(windowIndex: number) {
        const dirToDlt = WindowManager.deleteDirsOnClose[windowIndex];
        if (!dirToDlt) return;

        try {
            await fs.access(dirToDlt);
            await fs.rm(dirToDlt, { recursive: true });
        } catch (reason) {
            log.error("Could not delete temp files:", reason);
        }
    }
    static addDirToDelete(window: Electron.WebContents | number, dir: string): void {
        try {
            const index = WindowManager.windows.findIndex(
                (w) => w && w.id === (typeof window === "number" ? window : getWindowFromWebContents(window).id),
            );
            if (index > -1) {
                WindowManager.deleteDirsOnClose[index] = dir;
            }
        } catch (error) {
            log.error("Could not add dir to delete:", error);
        }
    }

    static destroyWindow(window: BrowserWindow): void {
        if (!window.isDestroyed()) {
            window.destroy();
        }
    }

    static getAllWindows(): BrowserWindow[] {
        return WindowManager.windows.filter((w): w is BrowserWindow => w !== null);
    }
    static registerListeners(): void {
        ipc.on("window:openLinkInNewWindow", (_, link) => {
            WindowManager.createWindow(link);
        });
        ipc.on("window:addDirToDelete", (e, dir) => {
            WindowManager.addDirToDelete(e.sender, dir);
        });
        ipc.on("window:destroy", (e) => {
            WindowManager.destroyWindow(getWindowFromWebContents(e.sender));
        });
        ipc.on("window:statusCheck:response", () => {
            if (WindowManager.errorCheckTimeout) {
                clearTimeout(WindowManager.errorCheckTimeout);
                WindowManager.errorCheckTimeout = null;
            }
        });
    }
}
