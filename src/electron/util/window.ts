import fs from "node:fs/promises";
import { mainT } from "@electron/i18n/mainI18n";
import { ipc } from "@electron/ipc/utils";
import * as remote from "@electron/remote/main";
import { app, BrowserWindow, dialog, shell } from "electron";
import { getWindowFromWebContents } from ".";
import { createMainLogger } from "./logger";

const logger = createMainLogger("WindowManager");

import { handleError } from "./errorHandler";
import { MainSettings } from "./mainSettings";
import { TrayManager } from "./tray";

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
        WindowManager.errorCheckTimeout = setTimeout(() => {
            const t = mainT;
            dialog
                .showMessageBox({
                    type: "info",
                    message: t("window.blankWindow", { ns: "electron" }),
                    buttons: [t("buttons.okAlt", { ns: "dialogs" }), t("buttons.homePage", { ns: "dialogs" })],
                })
                .then((e) => {
                    if (e.response === 1) shell.openExternal("https://github.com/mienaiyami/yomikiru");
                });
        }, 1000 * 10);
    }
    private constructor() {
        logger.error("WindowManager must not be instantiated (static API only)");
    }

    /**
     * Windows jump-list tasks. Call after main i18n is ready (and again on language change).
     */
    static setupWindowsTasks(): void {
        if (process.platform !== "win32") return;
        const t = mainT;
        app.setUserTasks([
            {
                program: process.execPath,
                arguments: "--new-window",
                iconPath: process.execPath,
                iconIndex: 0,
                title: t("window.jumpListNewWindow", { ns: "electron" }),
                description: t("window.jumpListNewWindowDesc", { ns: "electron" }),
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
            TrayManager.setupWindowListeners(window);
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
                logger.error("Renderer process terminated unexpectedly", detail);
                const t = mainT;
                dialog
                    .showMessageBox({
                        type: "error",
                        message: t("window.crashed", { ns: "electron" }),
                        buttons: [t("buttons.okAlt", { ns: "dialogs" }), t("buttons.homePage", { ns: "dialogs" })],
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
            if (MainSettings.settings.askBeforeClosing) {
                const t = mainT;
                res = dialog.showMessageBoxSync(window, {
                    message: t("window.closeConfirm", { ns: "electron" }),
                    title: t("window.closeTitle", { ns: "electron" }),
                    buttons: [t("buttons.no", { ns: "dialogs" }), t("buttons.yes", { ns: "dialogs" })],
                    type: "question",
                });
            }
            if (res === 0) return;
            try {
                /**
                 * reader:recordPage goes to UI -> UI saves progress -> UI emits "window:destroy" -> window is destroyed
                 */
                if (window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
                    ipc.send(window.webContents, "reader:recordPage");
                }
            } catch (err) {
                logger.error("Failed to send reader:recordPage IPC before window close", err);
                handleError(err instanceof Error ? err : new Error(String(err)), "medium");
            }

            setTimeout(() => {
                try {
                    if (!window?.isDestroyed()) {
                        logger.log("Close timeout: destroying window after reader:recordPage wait");
                        window.destroy();
                    }
                } catch (err) {
                    logger.error("Window destroy after close timeout failed", err);
                }
            }, 5000);

            await WindowManager.cleanupTempDir(currentWindowIndex);
        };

        const onClosed = () => {
            WindowManager.windows[currentWindowIndex] = null;
            WindowManager.deleteDirsOnClose[currentWindowIndex] = null;
            TrayManager.refreshMenu();
            if (WindowManager.windows.every((w) => !w)) app.quit();
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
            if (typeof reason === "string" && reason.includes("ENOENT")) return;
            logger.error(`Could not delete temp reader directory "${dirToDlt}"`, reason);
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
            logger.error("addDirToDelete: window not found or lookup failed", error);
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
