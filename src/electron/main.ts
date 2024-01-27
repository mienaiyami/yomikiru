/* eslint-disable no-case-declarations */
import { app, session, BrowserWindow, Menu, shell, ipcMain, MenuItemConstructorOptions, dialog } from "electron";
import path from "path";
import fs from "fs";
import IS_PORTABLE from "./IS_PORTABLE";
import { homedir, tmpdir } from "os";
import * as remote from "@electron/remote/main";
remote.initialize();
declare const HOME_WEBPACK_ENTRY: string;
import { exec, spawn, spawnSync } from "child_process";
import crossZip from "cross-zip";
import log from "electron-log";

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
    if (fs.existsSync(tempPath)) app.setPath("temp", tempPath);
    else fs.rmSync(tempPath);
}
let OPEN_IN_EXISTING_WINDOW = false;
if (fs.existsSync(path.join(app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW"))) OPEN_IN_EXISTING_WINDOW = true;

// change path in `settings.tsx as well if changing log path
log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/main.log");
log.log("Starting app...");

import sudo from "@vscode/sudo-prompt";
import checkForUpdate from "./updater";

// registry, add option "open in reader" in  explorer context menu
const addOptionToExplorerMenu = () => {
    const appPath = IS_PORTABLE
        ? app.getPath("exe").replace(/\\/g, "\\\\")
        : path.join(app.getPath("exe"), `../../${app.name}.exe`).replace(/\\/g, "\\\\");
    const regInit = `Windows Registry Editor Version 5.00
    
    ; setup context menu item for click on folders tree item
    [HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\Yomikiru\\command]
    @="\\"${appPath}\\" \\"%V\\""
    
    ; specify an icon for the item
    [HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\Yomikiru]
    @="Open in Yomikiru "
    "icon"="${appPath}"

    
    [HKEY_CLASSES_ROOT\\.cbz\\shell\\Yomikiru]
    @="Open in Yomikiru"
    "Icon"="${appPath}"

    [HKEY_CLASSES_ROOT\\.cbz\\shell\\Yomikiru\\command]
    @="\\"${appPath}\\" \\"%V\\""


    [HKEY_CLASSES_ROOT\\Yomikiru]
    @="Yomikiru"

    [HKEY_CLASSES_ROOT\\Yomikiru\\DefaultIcon]
    @="${appPath}"

    [HKEY_CLASSES_ROOT\\Yomikiru\\shell\\open]
    "Icon"="${appPath}"

    [HKEY_CLASSES_ROOT\\Yomikiru\\shell\\open\\command]
    @="\\"${appPath}\\" \\"%V\\""

    [HKEY_CLASSES_ROOT\\.zip\\OpenWithProgids]
    "Yomikiru"=""
    [HKEY_CLASSES_ROOT\\.cbz\\OpenWithProgids]
    "Yomikiru"=""
    [HKEY_CLASSES_ROOT\\.cbr\\OpenWithProgids]
    "Yomikiru"=""
    [HKEY_CLASSES_ROOT\\.cb7\\OpenWithProgids]
    "Yomikiru"=""

    [HKEY_CLASSES_ROOT\\.rar\\OpenWithProgids]
    "Yomikiru"=""

    [HKEY_CLASSES_ROOT\\.pdf\\OpenWithProgids]
    "Yomikiru"=""

    [HKEY_CLASSES_ROOT\\.7z\\OpenWithProgids]
    "Yomikiru"=""
    `;

    const tempPath = app.getPath("temp");
    fs.writeFileSync(path.join(tempPath, "createOpenWithYomikiru.reg"), regInit);

    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec("regedit.exe /S " + path.join(tempPath, "createOpenWithYomikiru.reg"), op, function (error) {
        if (error) log.error(error);
    });
};
const addOptionToExplorerMenu_epub = () => {
    app;
    const appPath = IS_PORTABLE
        ? app.getPath("exe").replace(/\\/g, "\\\\")
        : path.join(app.getPath("exe"), `../../${app.name}.exe`).replace(/\\/g, "\\\\");
    const regInit = `Windows Registry Editor Version 5.00
    
    [HKEY_CLASSES_ROOT\\.epub\\shell\\Yomikiru]
    @="Open in Yomikiru"
    "Icon"="${appPath}"

    [HKEY_CLASSES_ROOT\\.epub\\shell\\Yomikiru\\command]
    @="\\"${appPath}\\" \\"%V\\""

    [HKEY_CLASSES_ROOT\\.epub\\OpenWithProgids]
    "Yomikiru"=""
    
    [HKEY_CLASSES_ROOT\\.txt\\OpenWithProgids]
    "Yomikiru"=""
    
    [HKEY_CLASSES_ROOT\\.xhtml\\OpenWithProgids]
    "Yomikiru"=""
    
    [HKEY_CLASSES_ROOT\\.html\\OpenWithProgids]
    "Yomikiru"=""
    `;

    const tempPath = app.getPath("temp");
    fs.writeFileSync(path.join(tempPath, "createOpenWithYomikiru-epub.reg"), regInit);

    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec("regedit.exe /S " + path.join(tempPath, "createOpenWithYomikiru-epub.reg"), op, function (error) {
        if (error) log.error(error);
    });
};
const deleteOptionInExplorerMenu = () => {
    const regDelete = `Windows Registry Editor Version 5.00
    
    [-HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\Yomikiru]
    
    [-HKEY_CLASSES_ROOT\\.cbz\\shell\\Yomikiru]

    [-HKEY_CLASSES_ROOT\\Yomikiru]

    [HKEY_CLASSES_ROOT\\.zip\\OpenWithProgids]
    "Yomikiru"=-

    [HKEY_CLASSES_ROOT\\.pdf\\OpenWithProgids]
    "Yomikiru"=-

    [HKEY_CLASSES_ROOT\\.7z\\OpenWithProgids]
    "Yomikiru"=-
    `;
    fs.writeFileSync(path.join(app.getPath("temp"), "deleteOpenWithYomikiru.reg"), regDelete);
    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec(
        "regedit.exe /S " + path.join(app.getPath("temp"), "deleteOpenWithYomikiru.reg"),
        op,
        function (error) {
            if (error) log.error(error);
        }
    );
};
const deleteOptionInExplorerMenu_epub = () => {
    const regDelete = `Windows Registry Editor Version 5.00
    
    [-HKEY_CLASSES_ROOT\\.epub\\shell\\Yomikiru]

    `;
    fs.writeFileSync(path.join(app.getPath("temp"), "deleteOpenWithYomikiru-epub.reg"), regDelete);
    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec(
        "regedit.exe /S " + path.join(app.getPath("temp"), "deleteOpenWithYomikiru-epub.reg"),
        op,
        function (error) {
            if (error) log.error(error);
        }
    );
};

const handleSquirrelEvent = () => {
    if (process.argv.length === 1 || process.platform !== "win32") {
        return false;
    }
    const appFolder = path.resolve(process.execPath, "..");
    const rootFolder = path.resolve(appFolder, "..");
    // const updateDotExe = path.resolve(path.join(rootFolder, "Update.exe"));
    const appPath = IS_PORTABLE
        ? app.getPath("exe").replace(/\\/g, "\\\\")
        : path.join(app.getPath("exe").replace(/\\/g, "\\\\"), `../../${app.name}.exe`);
    // const spawnUpdate = (args: any) => spawn(updateDotExe, args);
    const squirrelEvent = process.argv[1];
    switch (squirrelEvent) {
        case "--squirrel-install":
        case "--squirrel-updated":
            // const createShortcutArgs = [
            //     `--createShortcut="${app.getName()}.exe"`,
            //     "--shortcut-locations=Desktop,StartMenu",
            // ];
            // spawn(path.join(appPath, "../Update.exe"), createShortcutArgs, { detached: true });
            const vbsScript = `
            Set WshShell = CreateObject("Wscript.shell")
            strDesktop = WshShell.SpecialFolders("Desktop")
            Set oMyShortcut = WshShell.CreateShortcut(strDesktop + "\\Yomikiru.lnk")
            oMyShortcut.WindowStyle = "1"
            oMyShortcut.IconLocation = "${path.resolve(rootFolder, "app.ico")}"
            OMyShortcut.TargetPath = "${appPath}"
            oMyShortCut.Save
            strStartMenu = WshShell.SpecialFolders("StartMenu")
            Set oMyShortcut2 = WshShell.CreateShortcut(strStartMenu + "\\programs\\Yomikiru.lnk")
            oMyShortcut2.WindowStyle = "1"
            oMyShortcut2.IconLocation = "${path.resolve(rootFolder, "app.ico")}"
            OMyShortcut2.TargetPath = "${appPath}"
            oMyShortCut2.Save
            `;
            fs.writeFileSync(path.resolve(rootFolder, "shortcut.vbs"), vbsScript);
            spawnSync("cscript.exe", [path.resolve(rootFolder, "shortcut.vbs")]);

            // fs.unlinkSync(path.resolve(rootFolder, "shortcut.vbs"));
            app.quit();
            break;

        case "--squirrel-uninstall":
            if (
                fs.existsSync(
                    path.resolve(homedir(), "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Yomikiru.lnk")
                )
            )
                fs.unlinkSync(
                    path.resolve(homedir(), "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Yomikiru.lnk")
                );
            deleteOptionInExplorerMenu();
            deleteOptionInExplorerMenu_epub();
            if (fs.existsSync(path.resolve(homedir(), "Desktop/Yomikiru.lnk")))
                fs.unlinkSync(path.resolve(homedir(), "Desktop/Yomikiru.lnk"));
            const uninstallFull = `
            set WshShell = CreateObject("Wscript.shell")
            WScript.Sleep 30000
            Dim FSO
            set FSO=CreateObject("Scripting.FileSystemObject")
            FSO.DeleteFolder("${app.getPath("userData")}")
            FSO.DeleteFolder("${rootFolder}\\*")
            `;
            const temp = fs.mkdtempSync(path.join(tmpdir(), "foo-"));
            fs.writeFileSync(path.join(temp, "uninstall.vbs"), uninstallFull);
            spawn("cscript.exe", [path.resolve(temp, "uninstall.vbs")], {
                detached: true,
            });
            app.quit();
            break;

        case "--squirrel-obsolete":
            app.quit();
            break;
    }
};

if (handleSquirrelEvent()) {
    app.quit();
}

const saveJSONfile = (path: string, data: any, sync = true) => {
    try {
        if (sync) {
            fs.writeFileSync(path, data);
        } else
            fs.writeFile(path, data, (err) => {
                if (err) {
                    log.error(err);
                }
            });
    } catch (err) {
        log.error("ERROR::saveJSONfile:electron:", err, "Retrying...");
        setTimeout(() => {
            saveJSONfile(path, data, sync);
        }, 1000);
    }
};

// when manga reader opened from context menu "open with manga reader"
let openFolderOnLaunch = "";
if (app.isPackaged && process.argv[1] && fs.existsSync(process.argv[1])) {
    openFolderOnLaunch = process.argv[1];
}

// declare const HOME_PRELOAD_WEBPACK_ENTRY: string;
const windowsCont: (BrowserWindow | null)[] = [];
const deleteDirsOnClose: (string | null)[] = [];
let isFirstWindow = true;

/**
 * Create main reader window.
 * @param link (optional) open given link/location in manga reader after loading window.
 */
const createWindow = (link?: string) => {
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
            contextIsolation: false,
            // enableRemoteModule: true,
            webSecurity: app.isPackaged,
            safeDialogs: true,
            // preload: HOME_PRELOAD_WEBPACK_ENTRY,
        },
    });
    // newWindow.webContents.setFrameRate(60);
    windowsCont.push(newWindow);
    deleteDirsOnClose.push(null);
    newWindow.loadURL(HOME_WEBPACK_ENTRY);
    newWindow.setMenuBarVisibility(false);
    remote.enable(newWindow.webContents);
    newWindow.webContents.once("dom-ready", () => {
        // maximize also unhide window
        newWindow.maximize();
        if (isFirstWindow) {
            newWindow.webContents.send("checkForUpdate:query");
            isFirstWindow = false;
        }
        newWindow.webContents.send("askBeforeClose:query");
        newWindow.webContents.send("loadMangaFromLink", { link: link || "" });
    });
    newWindow.webContents.setWindowOpenHandler(() => {
        return { action: "deny" };
    });
    // // ! try removeing coz theres 2 "close "
    // newWindow.on("close", () => {
    //     newWindow.webContents.send("recordPageNumber");
    //     windowsCont] = null;
    //     if (windowsCont.filter((e) => e !== null).length === 0) app.quit();
    // });
};
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
            } else if (fs.existsSync(commandLine[2])) createWindow(commandLine[2]);
        } else if (commandLine.length <= 2 || commandLine.includes("--new-window")) {
            log.log("second instance detected, opening new window...");
            createWindow();
        }
    });
}
// taskbar right click option
if (process.platform === "win32")
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
const registerListener = () => {
    ipcMain.on("openLinkInNewWindow", (e, link) => {
        createWindow(link);
    });
    if (process.platform === "win32") {
        ipcMain.on("addOptionToExplorerMenu", () => {
            addOptionToExplorerMenu();
        });
        ipcMain.on("deleteOptionInExplorerMenu", () => {
            deleteOptionInExplorerMenu();
        });
        ipcMain.on("addOptionToExplorerMenu:epub", () => {
            addOptionToExplorerMenu_epub();
        });
        ipcMain.on("deleteOptionInExplorerMenu:epub", () => {
            deleteOptionInExplorerMenu_epub();
        });
    }
    ipcMain.handle("changeTempPath", (e, newPath: string) => {
        app.setPath("temp", newPath);
        const lockFile = path.join(app.getPath("userData"), "TEMP_PATH");
        if (newPath === process.env.TEMP && fs.existsSync(lockFile)) fs.rmSync(lockFile);
        fs.writeFileSync(lockFile, newPath);
    });
    if (process.platform === "linux") {
        ipcMain.on("showInExplorer", (e, filePath) => {
            if (!fs.lstatSync(filePath).isDirectory()) filePath = path.dirname(filePath);
            if (fs.existsSync(filePath))
                exec(`xdg-open "${filePath}"`, (err, stdout, stderr) => {
                    if (err) {
                        if (err.message.includes("xdg-open: not found")) {
                            dialog.showMessageBoxSync(
                                (BrowserWindow.fromWebContents(e.sender) || BrowserWindow.fromId(1))!,
                                {
                                    message:
                                        "xdg-open: not found.\nRun 'sudo apt install xdg-utils' to use this command.",
                                    title: "Yomikiru",
                                    type: "error",
                                }
                            );
                        } else
                            dialog.showMessageBoxSync(
                                (BrowserWindow.fromWebContents(e.sender) || BrowserWindow.fromId(1))!,
                                {
                                    message: err.message,
                                    title: "Yomikiru",
                                    type: "error",
                                }
                            );
                    }
                });
        });
    }
    const errorCheckTimeout = setTimeout(() => {
        app.isPackaged &&
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
    }, 1000 * 30);
    ipcMain.on("checkForUpdate:response", (e, res, windowId, skipMinor, autoDownload) => {
        if (res) {
            checkForUpdate(windowId, skipMinor, false, autoDownload);
            setInterval(() => {
                checkForUpdate(windowId, skipMinor, false, autoDownload);
            }, 1000 * 60 * 60 * 1);
        }
        clearTimeout(errorCheckTimeout);
    });
    ipcMain.on("checkForUpdate", (e, windowId, promptAfterCheck = false) => {
        checkForUpdate(windowId, false, promptAfterCheck);
    });
    ipcMain.on("addDirToDlt", (e, dir) => {
        try {
            const index = windowsCont.findIndex((a) => a && a.id === BrowserWindow.fromWebContents(e.sender)?.id);
            if (index > -1) {
                deleteDirsOnClose[index] = dir;
                // log.log({ deleteDirsOnClose });
            }
        } catch (error) {
            log.error(error);
        }
    });
    ipcMain.on("destroyWindow", (e) => {
        // log.log("received destroy");
        const window = BrowserWindow.fromWebContents(e.sender);
        if (window && !window.isDestroyed()) window.destroy();
    });
    ipcMain.on("askBeforeClose:response", (e, ask = false) => {
        const currentWindowIndex = windowsCont.findIndex(
            (a) => a && a.id === BrowserWindow.fromWebContents(e.sender)?.id
        );
        const window = BrowserWindow.fromWebContents(e.sender)!;
        const closeEvent = (e: Electron.Event) => {
            e.preventDefault();
            let res = 1;
            if (ask)
                res = dialog.showMessageBoxSync(window, {
                    message: "Close this window?",
                    title: "Yomikiru",
                    buttons: ["No", "Yes"],
                    type: "question",
                });
            if (res === 0) {
                return;
            }
            // it also destroys current window.
            // window closes before recieving message to save history file, so it is needed
            window.webContents.send("recordPageNumber");
            //backup in case window is stuck
            setTimeout(() => {
                log.log("No response from window. Force closing app.");
                if (window && !window.isDestroyed()) window.destroy();
            }, 5000);
            const dirToDlt = deleteDirsOnClose[currentWindowIndex];
            if (dirToDlt)
                try {
                    if (fs.existsSync(dirToDlt) && fs.lstatSync(dirToDlt).isDirectory()) {
                        fs.rmSync(dirToDlt, {
                            recursive: true,
                        });
                    }
                } catch (reason) {
                    log.error("Could not delete temp files:", reason);
                }
        };
        const onClosed = () => {
            windowsCont[currentWindowIndex] = null;
            deleteDirsOnClose[currentWindowIndex] = null;
            if (windowsCont.filter((e) => e !== null).length === 0) app.quit();
        };
        window.on("closed", onClosed);
        window.on("close", closeEvent);
    });
    ipcMain.on("saveFile", (e, path: string, data: string) => {
        // log.log("received file", path);
        saveJSONfile(path, data);
    });

    ipcMain.handle("unzip", (e, link: string, extractPath: string) => {
        return new Promise((res, rej) => {
            if (link && extractPath) {
                if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true });
                if (path.extname(link) === ".rar") {
                    try {
                        fs.mkdirSync(extractPath);
                        const unrar = spawn("unrar", ["x", "-ai", "-r", link, extractPath]);
                        unrar.on("error", (err) => {
                            if (err.message.includes("ENOENT"))
                                rej("WinRAR not found. Try adding it to system PATHS.");
                            else rej(err);
                        });
                        unrar.stderr.on("data", (data) => {
                            rej(data);
                        });
                        unrar.on("close", (code) => {
                            if (code === 0) {
                                fs.writeFileSync(path.join(extractPath, "SOURCE"), link);
                                res({ link, extractPath, status: "ok" });
                            } else rej("WinRAR exited with code " + code);
                        });
                    } catch (reason) {
                        log.error(reason);
                        rej(reason);
                    }
                } else
                    crossZip.unzip(link, extractPath, (err) => {
                        if (err) rej(err);
                        else {
                            fs.writeFileSync(path.join(extractPath, "SOURCE"), link);
                            res({ link, extractPath, status: "ok" });
                        }
                    });
            } else rej("ELECTRON:UNZIP: Invalid link or extractPath.");
        });
    });
};
app.on("ready", () => {
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
                    click: () => createWindow(),
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
    registerListener();
    createWindow(openFolderOnLaunch);
});

app.on("before-quit", () => {
    log.log("Quitting app...");
});
app.on("activate", () => {
    //todo: what is this for?
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
