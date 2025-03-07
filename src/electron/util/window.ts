import { app, BrowserWindow, dialog } from "electron";
import path from "path";
import fs from "fs/promises";
import * as remote from "@electron/remote/main";
import { getWindowFromWebContents, log } from ".";
import { ipc } from "@electron/ipc/utils";

declare const HOME_WEBPACK_ENTRY: string;
declare const HOME_PRELOAD_WEBPACK_ENTRY: string;

export class WindowManager {
    private static windows: (BrowserWindow | null)[] = [];
    private static deleteDirsOnClose: (string | null)[] = [];
    private static isFirstWindow = true;

    static {
        if (process.platform === "win32") {
            this.setupWindowsTasks();
        }
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

        this.windows.push(newWindow);
        this.deleteDirsOnClose.push(null);

        this.setupWindow(newWindow, link);
        return newWindow;
    }

    private static setupWindow(window: BrowserWindow, link?: string) {
        window.loadURL(HOME_WEBPACK_ENTRY);
        window.setMenuBarVisibility(false);
        remote.enable(window.webContents);

        window.webContents.once("dom-ready", () => {
            // maximize also unhide window
            window.maximize();
            if (this.isFirstWindow) {
                ipc.send(window.webContents, "update:check:query");
                this.isFirstWindow = false;
            }
            ipc.send(window.webContents, "window:askBeforeClose:query");
            if (link)
                ipc.send(window.webContents, "reader:loadLink", {
                    link,
                });
        });

        window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    }

    static async handleWindowClose(window: BrowserWindow, ask = false) {
        const currentWindowIndex = this.windows.findIndex((w) => w && w.id === window.id);

        const closeEvent = async (e: Electron.Event) => {
            e.preventDefault();
            let res = 1;
            if (ask) {
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
                log.log("No response from window. Force closing app.");
                if (!window.isDestroyed()) window.destroy();
            }, 5000);

            await this.cleanupTempDir(currentWindowIndex);
        };

        const onClosed = () => {
            this.windows[currentWindowIndex] = null;
            this.deleteDirsOnClose[currentWindowIndex] = null;
            if (this.windows.filter((w) => w !== null).length === 0) {
                app.quit();
            }
        };

        window.on("closed", onClosed);
        window.on("close", closeEvent);
    }

    private static async cleanupTempDir(windowIndex: number) {
        const dirToDlt = this.deleteDirsOnClose[windowIndex];
        if (!dirToDlt) return;

        try {
            await fs.access(dirToDlt);
            await fs.rm(dirToDlt, { recursive: true });
        } catch (reason) {
            log.error("Could not delete temp files:", reason);
        }
    }
    static addDirToDelete(window: Electron.WebContents | number, dir: string) {
        try {
            const index = this.windows.findIndex(
                (w) => w && w.id === (typeof window === "number" ? window : getWindowFromWebContents(window).id)
            );
            if (index > -1) {
                this.deleteDirsOnClose[index] = dir;
            }
        } catch (error) {
            log.error("Could not add dir to delete:", error);
        }
    }

    static destroyWindow(window: BrowserWindow) {
        if (!window.isDestroyed()) {
            window.destroy();
        }
    }

    static getAllWindows(): BrowserWindow[] {
        return this.windows.filter((w): w is BrowserWindow => w !== null);
    }
    static registerListeners() {
        ipc.handle("window:openLinkInNewWindow", (_, link) => {
            console.log("opening link in new window", link);
            this.createWindow(link);
        });
        ipc.handle("window:addDirToDelete", (e, dir) => {
            this.addDirToDelete(e.sender, dir);
        });
        ipc.handle("window:destroy", (e) => {
            this.destroyWindow(getWindowFromWebContents(e.sender));
        });
        ipc.handle("window:askBeforeClose:response", (e, res = false) => {
            this.handleWindowClose(getWindowFromWebContents(e.sender), res);
        });
    }
}
