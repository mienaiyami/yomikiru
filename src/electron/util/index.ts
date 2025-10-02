import { app, BrowserWindow } from "electron";
import _log from "electron-log";
import fs from "fs";
import path from "path";

export const IS_PORTABLE =
    app.isPackaged &&
    process.platform === "win32" &&
    !app.getAppPath().includes(path.dirname(app.getPath("appData")));

if (IS_PORTABLE) {
    const folderPath = path.join(app.getAppPath(), "../../userdata/");
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }
    app.setPath("userData", folderPath);
}

// change path in `settings.tsx as well if changing log path
_log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/main.log");

export const log = _log;

export const saveFile = (path: string, data: string, sync = true, retry = 3): void => {
    try {
        if (sync) {
            fs.writeFileSync(path, data);
        } else
            fs.writeFile(path, data, (err) => {
                if (err) {
                    throw err;
                }
            });
    } catch (err) {
        log.error("electron:util:saveFile:", err, "Retrying...,", retry - 1, "left");
        if (retry > 0)
            setTimeout(() => {
                saveFile(path, data, sync, retry - 1);
            }, 1000);
    }
};

export const electronOnly = (): void => {
    if (process.type === "renderer") throw new Error("This function is only available in the main process.");
};

export const getWindowFromWebContents = (webContents: Electron.WebContents): BrowserWindow => {
    const win = BrowserWindow.fromWebContents(webContents);
    // to avoid typescript errors because in most cases it will never be null
    if (!win) {
        throw new Error("BrowserWindow not found");
    }
    return win;
};

/**
 * old formatting used `new Date().toLocaleString("en-UK", { hour12: true })`
 */
export const dateFromOldDateString = (localeDate?: string): Date => {
    if (!localeDate) return new Date();
    const [date, time] = localeDate.split(", ");
    const [day, month, year] = date.split("/");
    const newString = `${year}-${month}-${day} ${time}`;
    return new Date(newString);
};
