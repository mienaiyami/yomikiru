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
import path from "path";
import { homedir } from "os";
import * as remote from "@electron/remote/main";
remote.initialize();
declare const HOME_WEBPACK_ENTRY: string;
declare const HOME_PRELOAD_WEBPACK_ENTRY: string;
const windowsCont: (BrowserWindow | null)[] = [];

const createWindow = (link?: string) => {
    const newWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 940,
        minHeight: 560,
        frame: false,
        backgroundColor: "#272727",
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            // preload: HOME_PRELOAD_WEBPACK_ENTRY,
        },
    });
    console.log(newWindow);
    const currentWindowIndex = windowsCont.length;
    windowsCont.push(newWindow);
    newWindow.on("close", () => (windowsCont[currentWindowIndex] = null));
    newWindow.loadURL(HOME_WEBPACK_ENTRY);
    newWindow.setMenuBarVisibility(false);
    if (link) {
        newWindow.webContents.send("loadMangaFromLink", { link: link });
    }
    newWindow.once("ready-to-show", () => {
        newWindow.maximize();
        newWindow.show();
    });
    newWindow.webContents.setWindowOpenHandler(({ url }) => {
        return {
            action: "allow",
            overrideBrowserWindowOptions: {
                width: 1200,
                height: 800,
                minWidth: 940,
                minHeight: 560,
                frame: false,
                backgroundColor: "#272727",
                webPreferences: {
                    nodeIntegration: false,
                    // contextIsolation: false,
                    enableRemoteModule: true,
                    // preload: HOME_PRELOAD_WEBPACK_ENTRY,
                },
            },
        };
    });
};
ipcMain.on("openLinkInNewWindow", (e, link) => {
    console.log(link, windowsCont.length);
    createWindow(link);
});

app.on("ready", async () => {
    createWindow();
    globalShortcut.register("f1", () => {
        shell.openExternal("https://github.com/mienaiyami/offline-manga-reader");
    });
    if (!app.isPackaged) {
        const reactDevToolsPath = path.join(
            homedir(),
            "AppData\\local\\Microsoft\\Edge\\User Data\\Default\\Extensions\\gpphkfbcpidddadnkolkpfckpihlkkil\\4.19.2_0"
        );
        await session.defaultSession.loadExtension(reactDevToolsPath);
    }
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
