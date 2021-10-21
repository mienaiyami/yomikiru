import { contextBridge, ipcRenderer, shell } from "electron";
import { app, dialog, BrowserWindow, clipboard, nativeImage } from "@electron/remote";
import path from "path";
import fs from "fs";

export const electronApi = {
    app: app,
    dialog: dialog,
    shell: shell,
    ipcRenderer: ipcRenderer,
    BrowserWindow: BrowserWindow,
    clipboard: clipboard,
    nativeImage: nativeImage,
};

contextBridge.exposeInMainWorld("fs", fs);
contextBridge.exposeInMainWorld("path", path);
contextBridge.exposeInMainWorld("electron", electronApi);
