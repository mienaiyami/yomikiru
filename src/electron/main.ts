import fs from "node:fs";
import * as remote from "@electron/remote/main";
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions, shell } from "electron";
import { createMainLogger } from "./util/logger";

const logger = createMainLogger("main");

import { getErrorHandler } from "./util/errorHandler";

remote.initialize();

if (require("electron-squirrel-startup")) app.quit();

import { DatabaseService } from "./db";
import { registerI18nHandlers, setApplicationMenuRebuild } from "./i18n/ipc";
import { initMainI18n, mainT } from "./i18n/mainI18n";
import { registerCoverHandlers } from "./ipc/covers";
import { registerDbBackupHandlers, runDbBackupStartupBeforeOpen } from "./ipc/dbBackup";
import { setupDatabaseHandlers } from "./ipc/database";
import { registerDialogHandlers } from "./ipc/dialog";
import { registerErrorReportingHandlers } from "./ipc/errorReporting";
import { registerExplorerHandlers } from "./ipc/explorer";
import { registerFSHandlers } from "./ipc/fs";
import { registerUpdateHandlers } from "./ipc/update";
import handleSquirrelEvent from "./util/handleSquirrelEvent";
import { backupIfPendingMigrations, handleFailedSchemaMigrate, setLiveSqlite, stopScheduler } from "./util/dbBackup";
import { MainSettings } from "./util/mainSettings";
import { checkForJSONMigration } from "./util/migrate";
import { TrayManager } from "./util/tray";
import { WindowManager } from "./util/window";

if (handleSquirrelEvent()) {
    app.quit();
}

// initialize global error handler early
const errorHandler = getErrorHandler({
    showDialogs: true,
    logToFile: true,
    collectSystemInfo: true,
    maxReports: 50,
    enableCrashReporting: true,
});

/* constructed in app.ready after restore + cold-start backup */
let db: DatabaseService | null = null;
let isShuttingDown = false;

// when manga reader opened from context menu "open with manga reader"
let openFolderOnLaunch = "";
if (app.isPackaged && process.argv[1] && fs.existsSync(process.argv[1])) {
    openFolderOnLaunch = process.argv[1];
}

if (app.isPackaged) {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
    }
    app.on("second-instance", (_event, commandLine) => {
        const filePath = commandLine.length >= 3 && fs.existsSync(commandLine[2]) ? commandLine[2] : undefined;

        if (commandLine.includes("--new-window")) {
            WindowManager.createWindow(filePath);
            return;
        }

        if (MainSettings.settings.openInExistingWindow) {
            const existingWindow = BrowserWindow.getAllWindows().at(-1);
            if (existingWindow) {
                existingWindow.show();
                existingWindow.focus();
                if (filePath) existingWindow.webContents.send("reader:loadLink", { link: filePath });
            } else if (filePath) {
                WindowManager.createWindow(filePath);
            }
        } else {
            WindowManager.createWindow(filePath);
        }
    });
}

/**
 * Builds the application menu from the current main i18n language.
 * Electron `role` items stay OS-localized; custom labels use `menu` namespace keys.
 */
const rebuildApplicationMenu = (): void => {
    const t = mainT;
    const template: MenuItemConstructorOptions[] = [
        {
            label: t("edit", { ns: "menu" }),
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "pasteAndMatchStyle" },
                { role: "selectAll" },
            ],
        },
        {
            label: t("view", { ns: "menu" }),
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
            ],
        },
        {
            label: t("others", { ns: "menu" }),
            submenu: [
                {
                    role: "help",
                    accelerator: "F1",
                    click: () => shell.openExternal("https://github.com/mienaiyami/yomikiru"),
                },
                {
                    label: t("newWindow", { ns: "menu" }),
                    accelerator: process.platform === "darwin" ? "Cmd+N" : "Ctrl+N",
                    click: () => WindowManager.createWindow(),
                },
                {
                    label: t("close", { ns: "menu" }),
                    accelerator: process.platform === "darwin" ? "Cmd+W" : "Ctrl+W",
                    click: (_, window) => window?.close(),
                },
                {
                    label: t("reportIssue", { ns: "menu" }),
                    click: () => errorHandler.showIssueReportDialog(),
                },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

app.on("ready", async () => {
    try {
        /* i18n before migration dialogs — checkForJSONMigration calls mainT() */
        await initMainI18n();
        setApplicationMenuRebuild(() => {
            rebuildApplicationMenu();
            WindowManager.setupWindowsTasks();
            TrayManager.refreshMenu();
        });
        registerI18nHandlers();
        rebuildApplicationMenu();
        WindowManager.setupWindowsTasks();

        const cold = await runDbBackupStartupBeforeOpen();

        db = new DatabaseService();
        setLiveSqlite(db.sqliteDb);
        const pre = await backupIfPendingMigrations(db.sqliteDb, cold);
        if (!pre.proceed) {
            app.quit();
            return;
        }
        try {
            await db.initialize(pre.pendingTags);
        } catch (err) {
            logger.error("schema migrate failed", { tags: pre.pendingTags }, err);
            await handleFailedSchemaMigrate(pre.snapshotFileName);
            app.quit();
            return;
        }
        await checkForJSONMigration(db);

        setupDatabaseHandlers(db);
        registerDbBackupHandlers(db);
        registerCoverHandlers();

        WindowManager.registerListeners();

        registerExplorerHandlers();
        registerFSHandlers();
        registerDialogHandlers();
        registerErrorReportingHandlers();

        WindowManager.createWindow(openFolderOnLaunch);
        TrayManager.initialize();
        // need to be after window is created
        registerUpdateHandlers();
    } catch (error) {
        errorHandler.handleError(error as Error, "critical", {
            source: "App Ready Handler",
            action: "Initialize application",
        });
    }
});

app.on("before-quit", (event) => {
    if (isShuttingDown) return;
    event.preventDefault();
    isShuttingDown = true;
    void (async () => {
        try {
            await stopScheduler();
            setLiveSqlite(null);
            db?.close();
        } catch (err) {
            logger.error("shutdown: backup stop or db close failed", err);
        } finally {
            logger.log("Application shutdown (before-quit)");
            app.quit();
        }
    })();
});
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        WindowManager.createWindow();
    }
});
