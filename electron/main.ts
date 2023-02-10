/* eslint-disable no-case-declarations */
import { app, session, BrowserWindow, Menu, shell, ipcMain, MenuItemConstructorOptions, dialog } from "electron";
import path from "path";
import fs from "fs";
import IS_PORTABLE from "./IS_PORTABLE";
import { homedir, tmpdir } from "os";
import * as remote from "@electron/remote/main";
remote.initialize();
declare const HOME_WEBPACK_ENTRY: string;
import { spawn, spawnSync } from "child_process";
import log from "electron-log";

if (require("electron-squirrel-startup")) app.quit();
if (IS_PORTABLE) {
    const folderPath = path.join(app.getAppPath(), "../../userdata/");
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }
    app.setPath("userData", folderPath);
}
// disabling hardware acceleration because it causes reader to stutter when scrolling
app.disableHardwareAcceleration();

// change path in `settings.tsx as well if changing log path
log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/main.log");
log.log("Starting app...");

import sudo from "@vscode/sudo-prompt";
import checkForUpdate from "./updater";

// registry, add option "open in reader" in  explorer context menu
const addOptionToExplorerMenu = () => {
    app;
    const appPath = IS_PORTABLE
        ? app.getPath("exe").replace(/\\/g, "\\\\")
        : path.join(app.getPath("exe"), `../../${app.name}.exe`).replace(/\\/g, "\\\\");
    const regInit = `Windows Registry Editor Version 5.00
    
    ; Setup context menu item for click on folders tree item:
    [HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\MangaReader\\command]
    @="\\"${appPath}\\" \\"%V\\""
    
    ; Optional: specify an icon for the item:   
    [HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\MangaReader]
    @="Open in Manga Reader"
    "icon"="${appPath}"

    
    [HKEY_CLASSES_ROOT\\.cbz\\shell\\MangaReader]
    @="Open in Manga Reader"
    "Icon"="${appPath}"

    [HKEY_CLASSES_ROOT\\.cbz\\shell\\MangaReader\\command]
    @="\\"${appPath}\\" \\"%V\\""


    [HKEY_CLASSES_ROOT\\MangaReader]
    @="Manga Reader"

    [HKEY_CLASSES_ROOT\\MangaReader\\DefaultIcon]
    @="${appPath}"

    [HKEY_CLASSES_ROOT\\MangaReader\\shell\\open]
    "Icon"="${appPath}"

    [HKEY_CLASSES_ROOT\\MangaReader\\shell\\open\\command]
    @="\\"${appPath}\\" \\"%V\\""

    [HKEY_CLASSES_ROOT\\.zip\\OpenWithProgids]
    "MangaReader"=""
    `;

    const tempPath = app.getPath("temp");
    fs.writeFileSync(path.join(tempPath, "createOpenWithMangaReader.reg"), regInit);

    const op = {
        name: "MangaReader",
        icns: app.getPath("exe"),
    };
    sudo.exec("regedit.exe /S " + path.join(tempPath, "createOpenWithMangaReader.reg"), op, function (error) {
        if (error) log.error(error);
    });
};
// registry, remove option "open in reader" in explorer context menu
const deleteOptionInExplorerMenu = () => {
    const regDelete = `Windows Registry Editor Version 5.00
    
    [-HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\MangaReader]
    
    [-HKEY_CLASSES_ROOT\\.cbz\\shell\\MangaReader]

    [-HKEY_CLASSES_ROOT\\MangaReader]

    [HKEY_CLASSES_ROOT\\.zip\\OpenWithProgids]
    "MangaReader"=-
    `;
    fs.writeFileSync(path.join(app.getPath("temp"), "deleteOpenWithMangaReader.reg"), regDelete);
    const op = {
        name: "MangaReader",
        icns: app.getPath("exe"),
    };
    sudo.exec(
        "regedit.exe /S " + path.join(app.getPath("temp"), "deleteOpenWithMangaReader.reg"),
        op,
        function (error) {
            if (error) log.error(error);
        }
    );
};

const handleSquirrelEvent = () => {
    if (process.argv.length === 1) {
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
            Set oMyShortcut = WshShell.CreateShortcut(strDesktop + "\\Manga Reader.lnk")
            oMyShortcut.WindowStyle = "1"
            oMyShortcut.IconLocation = "${path.resolve(rootFolder, "app.ico")}"
            OMyShortcut.TargetPath = "${appPath}"
            oMyShortCut.Save
            strStartMenu = WshShell.SpecialFolders("StartMenu")
            Set oMyShortcut2 = WshShell.CreateShortcut(strStartMenu + "\\programs\\Manga Reader.lnk")
            oMyShortcut2.WindowStyle = "1"
            oMyShortcut2.IconLocation = "${path.resolve(rootFolder, "app.ico")}"
            OMyShortcut2.TargetPath = "${appPath}"
            oMyShortCut2.Save
            `;
            fs.writeFileSync(path.resolve(rootFolder, "shortcut.vbs"), vbsScript);
            spawnSync("cscript.exe", [path.resolve(rootFolder, "shortcut.vbs")]);
            fs.unlinkSync(path.resolve(rootFolder, "shortcut.vbs"));
            app.quit();
            break;

        case "--squirrel-uninstall":
            if (
                fs.existsSync(
                    path.resolve(
                        homedir(),
                        "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Manga Reader.lnk"
                    )
                )
            )
                fs.unlinkSync(
                    path.resolve(
                        homedir(),
                        "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Manga Reader.lnk"
                    )
                );
            deleteOptionInExplorerMenu();
            if (fs.existsSync(path.resolve(homedir(), "Desktop/Manga Reader.lnk")))
                fs.unlinkSync(path.resolve(homedir(), "Desktop/Manga Reader.lnk"));
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
            // const cmd = spawn("cmd.exe", ["/K"], { detached: true });
            // cmd.stdin.write("start " + temp + " \r\n");
            spawn("cscript.exe", [path.resolve(temp, "uninstall.vbs")], {
                detached: true,
            });
            // spawnSync("cscript.exe", [path.resolve(temp, "uninstall.vbs")]);
            // fs.unlinkSync(path.resolve(rootFolder));
            // fs.unlinkSync(app.getPath("userData"));
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
// when manga reader opened from context menu "open with manga reader"
let openFolderOnLaunch = "";
if (app.isPackaged && process.argv[1] && fs.existsSync(process.argv[1])) {
    openFolderOnLaunch = process.argv[1];
}

// declare const HOME_PRELOAD_WEBPACK_ENTRY: string;
const windowsCont: (BrowserWindow | null)[] = [];
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
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "#2e2e2e",
            symbolColor: "#ff6d4b",
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
    const currentWindowIndex = windowsCont.length;
    windowsCont.push(newWindow);
    newWindow.loadURL(HOME_WEBPACK_ENTRY);
    newWindow.setMenuBarVisibility(false);
    remote.enable(newWindow.webContents);
    newWindow.webContents.once("dom-ready", () => {
        // maximize also unhide window
        newWindow.maximize();
        newWindow.webContents.send("loadMangaFromLink", { link: link || "" });
        newWindow.webContents.send("setWindowIndex", currentWindowIndex);
        if (isFirstWindow) {
            newWindow.webContents.send("canCheckForUpdate");
            newWindow.webContents.send("loadMangaFromLink", { link: openFolderOnLaunch });
            isFirstWindow = false;
        }
    });
    newWindow.webContents.setWindowOpenHandler(() => {
        return { action: "deny" };
    });
    newWindow.on("close", () => {
        newWindow.webContents.send("recordPageNumber");
    });
};

/**
 * code to make sure only one instance of app is running at one time.
 *  */
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}
app.on("second-instance", (event, commandLine) => {
    if (commandLine.length >= 3) {
        // for file explorer option
        if (fs.existsSync(commandLine[2])) createWindow(commandLine[2]);
    } else if (commandLine.length <= 2 || commandLine.includes("--new-window")) {
        log.log("second instance detected, opening new window...");
        createWindow();
    }
});
// taskbar right click option
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
    ipcMain.on("addOptionToExplorerMenu", () => {
        addOptionToExplorerMenu();
    });
    ipcMain.on("deleteOptionInExplorerMenu", () => {
        deleteOptionInExplorerMenu();
    });
    ipcMain.on("canCheckForUpdate_response", (e, res, windowId, skipMinor) => {
        if (res) checkForUpdate(windowId, skipMinor);
    });
    ipcMain.on("checkForUpdate", (e, windowId, promptAfterCheck = false) => {
        checkForUpdate(windowId, false, promptAfterCheck);
    });
    ipcMain.on("askBeforeClose", (e, windowId, ask = false, currentWindowIndex) => {
        const window = BrowserWindow.fromId(windowId)!;
        window.on("close", (e) => {
            //! not working, check later
            window.webContents.executeJavaScript("window.app.deleteDirOnClose").then((link: string) => {
                if (fs.existsSync(link))
                    fs.rmSync(link, {
                        recursive: true,
                    });
            });
            if (ask) {
                const res = dialog.showMessageBoxSync(window, {
                    message: "Close this window?",
                    title: "Manga Reader",
                    buttons: ["No", "Yes"],
                    type: "question",
                });
                if (res === 0) {
                    e.preventDefault();
                    return;
                }
            }
            windowsCont[currentWindowIndex] = null;
        });
    });
};
app.on("ready", () => {
    // if (!app.isPackaged) {
    //     try {
    //         const reactDevToolsPath = path.join(
    //             homedir(),
    //             "AppData\\local\\Microsoft\\Edge\\User Data\\Default\\Extensions\\fmkadmapgofadopljbjfkapdkoienihi\\4.27.1_0"
    //         );
    //         session.defaultSession.loadExtension(reactDevToolsPath);
    //     } catch (err) {
    //         log.error(err);
    //     }
    // }

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
                { role: "resetZoom" },
                { role: "zoomIn", accelerator: "CommandOrControl+=" },
                { role: "zoomOut" },
            ],
        },
        {
            label: "Others",
            submenu: [
                {
                    role: "help",
                    accelerator: "F1",
                    click: () => shell.openExternal("https://github.com/mienaiyami/react-ts-offline-manga-reader"),
                },
                {
                    label: "New Window",
                    accelerator: process.platform === "darwin" ? "Cmd+N" : "Ctrl+N",
                    click: () => createWindow(),
                },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    registerListener();
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
app.on("before-quit", () => {
    log.log("Quitting app...");
});
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
