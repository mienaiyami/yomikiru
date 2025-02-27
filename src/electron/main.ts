/* eslint-disable no-case-declarations */
import { app, BrowserWindow, Menu, shell, ipcMain, MenuItemConstructorOptions, dialog } from "electron";
import path from "path";
import fs from "fs";
import { IS_PORTABLE, log, saveFile } from "./util";

import { exec, spawn } from "child_process";
import * as crossZip from "cross-zip";

import * as remote from "@electron/remote/main";
remote.initialize();

declare const HOME_WEBPACK_ENTRY: string;
declare const HOME_PRELOAD_WEBPACK_ENTRY: string;

if (require("electron-squirrel-startup")) app.quit();
if (IS_PORTABLE) {
    const folderPath = path.join(app.getAppPath(), "../../userdata/");
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }
    app.setPath("userData", folderPath);
}

//// disabling hardware acceleration because it causes reader to stutter when scrolling
////18/05/23 - decided to not use it anymore as it make scrolling laggy
//todo better way to do this
if (fs.existsSync(path.join(app.getPath("userData"), "DISABLE_HARDWARE_ACCELERATION")))
    app.disableHardwareAcceleration();
if (fs.existsSync(path.join(app.getPath("userData"), "TEMP_PATH"))) {
    const tempPath = fs.readFileSync(path.join(app.getPath("userData"), "TEMP_PATH"), "utf-8");
    app.setPath("temp", tempPath);
    if (!fs.existsSync(tempPath)) {
        log.log("Set tempPath does not exist, creating,", tempPath);
        fs.mkdirSync(tempPath);
    }
}
let OPEN_IN_EXISTING_WINDOW = false;
if (fs.existsSync(path.join(app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW"))) OPEN_IN_EXISTING_WINDOW = true;

import checkForUpdate from "./updater";
import {
    addOptionToExplorerMenu,
    addOptionToExplorerMenu_epub,
    deleteOptionInExplorerMenu,
    deleteOptionInExplorerMenu_epub,
} from "./util/shelloptions";
import handleSquirrelEvent from "./util/handleSquirrelEvent";
import { DatabaseService } from "./db";
import { setupDatabaseHandlers } from "./ipc/database";
import { WindowManager } from "./util/window";
import { registerExplorerHandlers } from "./ipc/explorer";
import { registerUpdateHandlers } from "./ipc/update";
import { registerFSHandlers } from "./ipc/fs";
import { registerDialogHandlers } from "./ipc/dialog";

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
            if (OPEN_IN_EXISTING_WINDOW) {
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
