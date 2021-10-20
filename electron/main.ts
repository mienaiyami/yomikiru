import {
    app,
    session,
    BrowserWindow,
    Menu,
    MenuItem,
    globalShortcut,
    dialog,
    shell,
    ipcMain,
    MenuItemConstructorOptions,
    protocol,
} from "electron";
import * as path from "path";
import { homedir } from "os";
// import fetch from "node-fetch";
import * as remote from "@electron/remote/main";
remote.initialize();
let mainWindow: BrowserWindow;
declare const HOME_WEBPACK_ENTRY: string;
// declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 940,
        minHeight: 560,
        frame: false,
        backgroundColor: "#272727",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            // preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        },
    });

    mainWindow.maximize();
    mainWindow.loadURL(HOME_WEBPACK_ENTRY);

    mainWindow.setMenuBarVisibility(false);
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });
    ipcMain.on("closeApp", () => {
        mainWindow.close();
    });
    ipcMain.on("minimizeApp", () => {
        mainWindow.minimize();
    });
    ipcMain.on("maximizeApp", () => {
        mainWindow.maximize();
    });
    ipcMain.on("restoreDownApp", () => {
        mainWindow.restore();
    });
    ipcMain.on("maximizeRestoreApp", () => {
        if (mainWindow.isMaximized()) {
            mainWindow.restore();
            return;
        }
        mainWindow.maximize();
    });
    mainWindow.on("maximize", () => {
        mainWindow.webContents.send("isMaximized");
    });
    mainWindow.on("unmaximize", () => {
        mainWindow.webContents.send("isRestored");
    });
    // mainWindow.on("closed", () => {
    //     mainWindow = null;
    // });
}

async function checkforupdate() {
    const rawdata = await fetch(
        "https://raw.githubusercontent.com/mienaiyami/offline-manga-reader/main/package.json"
    ).then((data: any) => data.json());
    const latestVersion = await rawdata.version.split(".");
    const currentAppVersion = app.getVersion().split(".");
    if (
        latestVersion[0] > currentAppVersion[0] ||
        (latestVersion[0] === currentAppVersion[0] && latestVersion[1] > currentAppVersion[1]) ||
        (latestVersion[0] === currentAppVersion[0] &&
            latestVersion[1] === currentAppVersion[1] &&
            latestVersion[2] > currentAppVersion[2])
    ) {
        dialog
            .showMessageBox(
                new BrowserWindow({
                    show: false,
                    alwaysOnTop: true,
                }),
                {
                    title: "New Version Available",
                    message: "New Version Available.\nGo to download page?",
                    buttons: ["Yes", "No"],
                }
            )
            .then(response => {
                if (response.response === 0) {
                    shell.openExternal("https://mienaiyami.github.io/mangareader/");
                }
            });
    }
}
// checkforupdate();
const reactDevToolsPath = path.join(
    homedir(),
    "AppData\\local\\Microsoft\\Edge\\User Data\\Default\\Extensions\\gpphkfbcpidddadnkolkpfckpihlkkil\\4.19.2_0"
);
app.on("ready", async () => {
    createWindow();
    globalShortcut.register("f1", () => {
        shell.openExternal("https://github.com/mienaiyami/offline-manga-reader");
    });
    await session.defaultSession.loadExtension(reactDevToolsPath);
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
                { type: "separator" },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
