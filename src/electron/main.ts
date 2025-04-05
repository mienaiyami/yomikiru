/* eslint-disable no-case-declarations */
import { app, BrowserWindow, Menu, shell, MenuItemConstructorOptions } from "electron";
import fs from "fs";
import { log } from "./util";

import * as remote from "@electron/remote/main";
remote.initialize();

if (require("electron-squirrel-startup")) app.quit();

import handleSquirrelEvent from "./util/handleSquirrelEvent";
import { MainSettings } from "./util/mainSettings";
import { DatabaseService } from "./db";
import { setupDatabaseHandlers } from "./ipc/database";
import { WindowManager } from "./util/window";
import { registerExplorerHandlers } from "./ipc/explorer";
import { registerUpdateHandlers } from "./ipc/update";
import { registerFSHandlers } from "./ipc/fs";
import { registerDialogHandlers } from "./ipc/dialog";
import { checkForJSONMigration } from "./util/migrate";

if (handleSquirrelEvent()) {
    app.quit();
}

const db = new DatabaseService();

// when manga reader opened from context menu "open with manga reader"
let openFolderOnLaunch = "";
if (app.isPackaged && process.argv[1] && fs.existsSync(process.argv[1])) {
    openFolderOnLaunch = process.argv[1];
}

if (app.isPackaged) {
    /**
     * code to make sure only one instance of app is running at one time.
     *  */
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
    }
    // todo: improve
    app.on("second-instance", (event, commandLine) => {
        if (commandLine.length >= 3) {
            // for file explorer option
            if (MainSettings.getSettings().openInExistingWindow) {
                const window = BrowserWindow.getAllWindows().at(-1);
                if (window) {
                    window.webContents.send("loadMangaFromLink", { link: commandLine[2] });
                    window.show();
                } else {
                    log.error("Could not get the window.");
                }
            } else if (fs.existsSync(commandLine[2])) WindowManager.createWindow(commandLine[2]);
        } else if (commandLine.length <= 2 || commandLine.includes("--new-window")) {
            log.log("second instance detected, opening new window...");
            WindowManager.createWindow();
        }
    });
}

app.on("ready", async () => {
    // checkForJSONMigration depends on app ready to use dialog
    checkForJSONMigration(db);
    /**
     * enables basic shortcut keys such as copy, paste, reload, etc.
     */
    const template: MenuItemConstructorOptions[] = [
        {
            label: "Edit",
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
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                // ! moving to App.tsx
                // { role: "resetZoom" },
                // { role: "zoomIn", accelerator: "CommandOrControl+=" },
                // { role: "zoomOut" },
            ],
        },
        {
            label: "Others",
            submenu: [
                {
                    role: "help",
                    accelerator: "F1",
                    click: () => shell.openExternal("https://github.com/mienaiyami/yomikiru"),
                },
                {
                    label: "New Window",
                    accelerator: process.platform === "darwin" ? "Cmd+N" : "Ctrl+N",
                    click: () => WindowManager.createWindow(),
                },
                {
                    label: "Close",
                    accelerator: process.platform === "darwin" ? "Cmd+W" : "Ctrl+W",
                    click: (_, window) => window?.close(),
                },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    await db.initialize();
    setupDatabaseHandlers(db);

    WindowManager.registerListeners();

    registerUpdateHandlers();
    registerExplorerHandlers();
    registerFSHandlers();
    registerDialogHandlers();

    WindowManager.createWindow(openFolderOnLaunch);
});

app.on("before-quit", () => {
    log.log("Quitting app...");
});
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        WindowManager.createWindow();
    }
});
