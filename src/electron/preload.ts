import { contextBridge, ipcRenderer, shell, webFrame } from "electron";
import { app, clipboard, nativeImage, getCurrentWindow } from "@electron/remote";
import path from "path";
import fs from "fs/promises";
import { existsSync, lstatSync, accessSync, readFileSync } from "fs";
import type { IPCChannels } from "@common/types/ipc";
import * as chokidar from "chokidar";
import { getFonts } from "font-list";

type FunctionLess<T> = {
    [K in keyof T as T[K] extends () => any ? never : K]: T[K];
};

// ! when sending data to renderer process from preload, any function/prototype get removed from the object

// todo: replace with ipc later
const fsAPI = {
    constants: fs.constants,
    readFile: fs.readFile,
    readFileSync: readFileSync,
    writeFile: fs.writeFile,
    readdir: fs.readdir,
    stat: async (path: string) => {
        const stats = await fs.stat(path);
        const returnStats = {
            ...stats,
            isDir: stats.isDirectory(),
            isFile: stats.isFile(),
        };
        return returnStats as FunctionLess<typeof returnStats>;
    },
    access: fs.access,
    accessSync,
    existsSync,
    rm: fs.rm,
    mkdir: fs.mkdir,
    // todo make async version of these
    isDir: (path: string) => {
        try {
            return lstatSync(path).isDirectory();
        } catch (error) {
            return false;
        }
    },
    isFile: (path: string) => {
        try {
            return lstatSync(path).isFile();
        } catch (error) {
            return false;
        }
    },
};
const pathAPI = {
    join: path.join,
    normalize: path.normalize,
    extname: path.extname,
    basename: path.basename,
    dirname: path.dirname,
    resolve: path.resolve,
    sep: path.sep,
};
// this will only return single type "will-resize" coz of typescript limitation?
// type BrowserWindowEvent = Parameters<Electron.BrowserWindow["on"]>[0];
// but still need this to shut up typescript error
type BrowserWindowEvent =
    | "ready-to-show"
    | "show"
    | "hide"
    | "close"
    | "closed"
    | "focus"
    | "blur"
    | "maximize"
    | "unmaximize"
    | "minimize"
    | "restore"
    | "enter-full-screen"
    | "leave-full-screen";

const electronAPI = {
    app: {
        getPath: app.getPath,
        getVersion: app.getVersion,
        getName: app.getName,
        isPackaged: app.isPackaged,
    },
    readText: clipboard.readText,
    writeText: clipboard.writeText,
    copyImage: (imagePath: string) => clipboard.writeImage(nativeImage.createFromPath(imagePath)),
    openExternal: (url: string) => shell.openExternal(url),
    showItemInFolder: (path: string) => shell.showItemInFolder(path),
    webFrame: {
        getZoomFactor: () => webFrame.getZoomFactor(),
        setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
        clearCache: () => webFrame.clearCache(),
    },
    clearAppCache: () => {
        getCurrentWindow().webContents.session.clearCache();
        webFrame.clearCache();
        getCurrentWindow().webContents.session.clearCodeCaches({
            urls: [],
        });
    },
    currentWindow: {
        isFullScreen: () => getCurrentWindow().isFullScreen(),
        setFullScreen: (flag: boolean) => getCurrentWindow().setFullScreen(flag),
        isMaximized: () => getCurrentWindow().isMaximized(),
        isFocused: () => getCurrentWindow().isFocused(),
        maximize: () => getCurrentWindow().maximize(),
        minimize: () => getCurrentWindow().minimize(),
        restore: () => getCurrentWindow().restore(),
        close: () => getCurrentWindow().close(),
        setTitleBarOverlay: () => getCurrentWindow().setTitleBarOverlay,
        clearEvents: (events?: BrowserWindowEvent[]) => {
            const window = getCurrentWindow();
            if (events) {
                events.forEach((event) => {
                    window.removeAllListeners(event);
                });
            } else {
                window.removeAllListeners();
            }
        },
        on: (event: BrowserWindowEvent, callback: () => void): (() => void) => {
            const handler = () => callback();
            const window = getCurrentWindow();
            window.on(event as any, handler);
            return () => window.off(event, handler);
        },
        // self: () => getCurrentWindow(),
    },
    //
    on: <T extends keyof IPCChannels>(
        channel: T,
        callback: (data: IPCChannels[T]["request"]) => void,
    ): (() => void) => {
        const handler = (event: Electron.IpcRendererEvent, data: IPCChannels[T]["request"]) => callback(data);
        ipcRenderer.on(channel, handler);
        return () => ipcRenderer.off(channel, handler);
    },
    invoke: <T extends keyof IPCChannels>(
        channel: T,
        ...data: IPCChannels[T]["request"] extends void ? [] : [IPCChannels[T]["request"]]
    ): Promise<IPCChannels[T]["response"]> => {
        return ipcRenderer.invoke(channel, ...data);
    },
    send: <T extends keyof IPCChannels>(
        channel: T,
        ...data: IPCChannels[T]["request"] extends void ? [] : [IPCChannels[T]["request"]]
    ): void => {
        ipcRenderer.send(channel, ...data);
    },
};

const processObj = {
    versions: process.versions,
    platform: process.platform,
    arch: process.arch,
    isPortable:
        app.isPackaged &&
        process.platform === "win32" &&
        !app.getAppPath().includes(path.dirname(app.getPath("appData"))),
};

const chokidarAPI = {
    // cant be used directly in renderer process
    watch: ({
        path,
        event,
        options,
        callback,
    }: {
        path: string | string[];
        event: "all" | "change" | "add" | "addDir" | "unlink" | "unlinkDir" | "error" | "ready" | "raw";
        options?: chokidar.WatchOptions;
        callback: (event: string, path: string) => void;
    }): (() => void) => {
        const watcher = chokidar.watch(path, options);
        watcher.on(event, callback);
        return () => watcher.close();
    },
};

contextBridge.exposeInMainWorld("fs", fsAPI);
contextBridge.exposeInMainWorld("path", pathAPI);
contextBridge.exposeInMainWorld("electron", electronAPI);
contextBridge.exposeInMainWorld("chokidar", chokidarAPI);
contextBridge.exposeInMainWorld("process", processObj);
contextBridge.exposeInMainWorld("getFonts", getFonts);
//todo temp only
contextBridge.exposeInMainWorld("logger", console);

declare global {
    interface Window {
        fs: typeof fsAPI;
        path: typeof pathAPI;
        electron: typeof electronAPI;
        chokidar: typeof chokidarAPI;
        process: typeof processObj;
        logger: typeof console;
        getFonts: typeof getFonts;
    }
}
