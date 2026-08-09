import path from "node:path";
import { mainT } from "@electron/i18n/mainI18n";
import type { BrowserWindow } from "electron";
import { app, Menu, nativeImage, Tray } from "electron";
import { createMainLogger } from "./logger";

const logger = createMainLogger("TrayManager");

import { MainSettings } from "./mainSettings";
import { WindowManager } from "./window";

const TITLE_TRUNCATE_LEN = 50;

export class TrayManager {
    private static tray: Tray | null = null;
    private static lastFocusedWindow: BrowserWindow | null = null;

    private constructor() {
        logger.error("TrayManager must not be instantiated (static API only)");
    }

    private static createTray(): void {
        if (TrayManager.tray || !app.isReady()) return;
        const image = nativeImage.createFromPath(path.join(app.getAppPath(), "../app.ico"));
        const finalImage = image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 });
        TrayManager.tray = new Tray(finalImage);

        TrayManager.tray.setToolTip(app.name);
        TrayManager.tray.on("click", () => TrayManager.handleTrayClick());

        TrayManager.updateContextMenu();
    }

    private static truncateTitle(title: string): string {
        title = title.replace(`${app.name} - `, "");
        if (title.length <= TITLE_TRUNCATE_LEN) return title;
        return `${title.slice(0, TITLE_TRUNCATE_LEN - 3)}...`;
    }

    /**
     * Shows a window that was hidden to the tray. Only {@link BrowserWindow#restore}s when the OS reports the
     * window as minimized; otherwise `restore()` would incorrectly clear a maximized (or fullscreen) state.
     */
    private static showWindowFromTray(window: BrowserWindow): void {
        if (window.isDestroyed()) return;
        if (window.isMinimized()) {
            window.restore();
        }
        window.show();
        window.focus();
    }

    private static updateContextMenu(): void {
        if (!TrayManager.tray || TrayManager.tray.isDestroyed()) return;

        const t = mainT;
        const windows = WindowManager.getAllWindows();
        const windowItems: Electron.MenuItemConstructorOptions[] =
            windows.length === 0
                ? [{ label: t("tray.noWindows", { ns: "electron" }), enabled: false }]
                : windows.map((w) => ({
                      label: TrayManager.truncateTitle(w.getTitle() || app.name),
                      click: () => {
                          if (!w.isDestroyed()) {
                              if (w.isVisible()) {
                                  w.focus();
                                  return;
                              }
                              TrayManager.showWindowFromTray(w);
                          }
                      },
                  }));

        const template: Electron.MenuItemConstructorOptions[] = [
            {
                label: t("tray.windows", { ns: "electron" }),
                enabled: false,
            },
            ...windowItems,
            { type: "separator" },
            {
                label: t("tray.hideAllWindows", { ns: "electron" }),
                enabled: windows.length > 0,
                click: () => {
                    TrayManager.hideAllWindows();
                },
            },
            { type: "separator" },
            {
                label: t("tray.exit", { ns: "electron" }),
                click: () => {
                    app.quit();
                },
            },
        ];
        TrayManager.tray.setContextMenu(Menu.buildFromTemplate(template));
    }

    static refreshMenu(): void {
        if (!MainSettings.settings.minimizeToTray || !TrayManager.tray || TrayManager.tray.isDestroyed()) return;
        TrayManager.updateContextMenu();
    }

    private static destroyTray(): void {
        if (TrayManager.tray && !TrayManager.tray.isDestroyed()) {
            TrayManager.tray.destroy();
            TrayManager.tray = null;
        }
        TrayManager.lastFocusedWindow = null;
    }

    /**
     * Hides every non-destroyed window without focusing any (avoids stealing focus from other apps).
     */
    private static hideAllWindows(): void {
        const windows = WindowManager.getAllWindows().filter((w) => !w.isDestroyed());
        for (const w of windows) {
            w.hide();
        }
        TrayManager.refreshMenu();
        logger.log(`Tray menu 'Hide all': minimized ${windows.length} window(s) to tray`);
    }

    /**
     * Left-click: with a single window, toggles show/hide; with multiple windows, shows hidden or focuses (unchanged).
     */
    private static handleTrayClick(): void {
        const windows = WindowManager.getAllWindows().filter((w) => !w.isDestroyed());
        if (windows.length === 1) {
            const only = windows[0];
            if (!only.isVisible()) {
                TrayManager.showWindowFromTray(only);
                return;
            }
            only.hide();
            TrayManager.refreshMenu();
            logger.log("Tray icon click: minimized focused window to tray");
            return;
        }
        const hidden = windows.filter((w) => !w.isVisible());
        // by default start from hidden windows first
        if (hidden.length > 0) {
            const toShow = hidden[hidden.length - 1];
            TrayManager.showWindowFromTray(toShow);
            return;
        }
        // if no hidden windows, pick last focused window; it could already be visible
        if (TrayManager.lastFocusedWindow && !TrayManager.lastFocusedWindow.isDestroyed()) {
            if (TrayManager.lastFocusedWindow.isVisible()) {
                TrayManager.lastFocusedWindow.focus();
                return;
            }
            TrayManager.showWindowFromTray(TrayManager.lastFocusedWindow);
            return;
        }
        const visible = windows.filter((w) => !w.isDestroyed() && w.isVisible());
        const toFocus = visible[visible.length - 1];
        if (toFocus) {
            toFocus.focus();
        }
    }

    static initialize(): void {
        if (MainSettings.settings.minimizeToTray) {
            TrayManager.createTray();
            logger.log("System tray ready (minimize-to-tray enabled)");
        }
    }

    static setMinimizeToTray(enabled: boolean): void {
        if (enabled) {
            TrayManager.createTray();
        } else {
            TrayManager.destroyTray();
        }
    }

    static setupWindowListeners(window: BrowserWindow): void {
        window.on("minimize", () => {
            if (MainSettings.settings.minimizeToTray) {
                window.hide();
                TrayManager.refreshMenu();
            }
        });
        window.on("focus", () => {
            TrayManager.lastFocusedWindow = window;
        });
        window.webContents.on("page-title-updated", () => {
            TrayManager.refreshMenu();
        });
        TrayManager.refreshMenu();
    }
}
