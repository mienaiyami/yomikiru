import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell, BrowserWindow } from "@electron/remote";
import { ipcRenderer } from "electron";
/*//! i know its dangerous but its offline app and i was unable to get BrowserWindow to work
  //! in renderer with contextBridge from preload
 */
import path from "path";
import fs from "fs";
declare module "react" {
    interface CSSProperties {
        [key: `--${string}`]: string | number;
    }
}
declare global {
    interface Window {
        electron: {
            app: typeof app;
            dialog: typeof dialog;
            shell: typeof shell;
            ipcRenderer: typeof ipcRenderer;
            getCurrentWindow: typeof getCurrentWindow;
            getAllWindows: Electron.BrowserWindow[];
            clipboard: typeof clipboard;
            nativeImage: typeof nativeImage;
        };
        supportedFormats: string[];
        path: typeof path;
        fs: typeof fs;
        app: {
            betterSortOrder: (x: string, y: string) => number;
            titleBarHeight: number;
            isReaderOpen: boolean;
            // to remove later
            keydown: boolean;
            clickDelay: number;
            lastClick: number;
        };
        loadManga: string;
        cachedImageList: { link: string; images: string[] };
        temp: any;
        dialog: {
            nodeError: (err: NodeJS.ErrnoException) => Promise<Electron.MessageBoxReturnValue>;
            customError: ({
                title,
                message,
                detail,
            }: {
                title?: string;
                message: string;
                detail?: string | undefined;
            }) => Promise<Electron.MessageBoxReturnValue>;
            warn: ({
                title,
                message,
                detail,
                noOption,
            }: {
                title?: string;
                message: string;
                detail?: string | undefined;
                noOption?: boolean;
            }) => Promise<Electron.MessageBoxReturnValue>;
            confirm: ({
                title,
                message,
                detail,
                noOption,
            }: {
                title?: string;
                message: string;
                detail?: string | undefined;
                noOption?: boolean;
            }) => Promise<Electron.MessageBoxReturnValue>;
        };
    }
    interface ListItem {
        mangaName: string;
        chapterName: string;
        date?: string;
        link: string;
        pages: number;
    }
    interface ListItemE extends ListItem {
        index: number;
        isBookmark: boolean;
        isHistory: boolean;
    }
    interface ShortcutSchema {
        command: shortcutCommand;
        name: string;
        key1: string;
        key2: string;
    }
    interface IContextMenuData {
        isBookmark?: boolean;
        isHistory?: boolean;
        isFile?: boolean;
        isImg?: boolean;
        link: string;
        e: MouseEvent;
        item?: ListItemE;
    }
    //! edit settingValidatorData and default settings in app.tsx when adding new settings
    interface appsettings {
        theme: string;
        bookmarksPath: string;
        historyPath: string;
        baseDir: string;
        historyLimit: number;
        locationListSortType: "normal" | "inverse";
        updateCheckerEnabled: boolean;
        readerSettings: {
            readerWidth: number;
            variableImageSize: boolean;
            readerTypeSelected: 0 | 1;
            pagesPerRowSelected: 0 | 1 | 2;
            gapBetweenRows: boolean;
            sideListWidth: number;
            widthClamped: boolean;
            gapSize: number;
        };
    }

    type shortcutCommand =
        | "navToPage"
        | "toggleZenMode"
        | "readerSettings"
        | "nextChapter"
        | "prevChapter"
        | "bookmark"
        | "sizePlus"
        | "sizeMinus"
        | "largeScroll"
        | "nextPage"
        | "prevPage"
        | "scrollDown"
        | "scrollUp";
}
export const settingValidatorData = {
    theme: "string",
    bookmarksPath: "string",
    historyPath: "string",
    baseDir: "string",
    historyLimit: "number",
    locationListSortType: ["normal", "inverse"],
    updateCheckerEnabled: "boolean",
    readerSettings: {
        readerWidth: "number",
        variableImageSize: "boolean",
        readerTypeSelected: [0, 1],
        pagesPerRowSelected: [0, 1, 2],
        gapBetweenRows: "boolean",
        sideListWidth: "number",
        widthClamped: true,
        gapSize: "number",
    },
};

window.path = path;
window.fs = fs;
window.supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", "avif"];
const collator = Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
window.app.betterSortOrder = collator.compare;
window.electron = {
    app,
    dialog,
    shell,
    ipcRenderer,
    getCurrentWindow,
    clipboard,
    nativeImage,
    getAllWindows: BrowserWindow.getAllWindows(),
};
window.dialog = {
    nodeError: (err: NodeJS.ErrnoException) =>
        window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "error",
            title: err.name,
            message: "Error no.: " + err.errno,
            detail: err.message,
        }),
    customError: ({ title = "Error", message, detail }: { title?: string; message: string; detail?: string }) =>
        window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "error",
            title: title,
            message: message,
            detail: detail,
        }),
    warn: ({
        title = "Warning",
        message,
        detail,
        noOption = true,
    }: {
        title?: string;
        message: string;
        detail?: string;
        noOption?: boolean;
    }) =>
        window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "warning",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : ["Yes", "No"],
        }),
    confirm: ({
        title = "Confirm",
        message,
        detail,
        noOption = true,
    }: {
        title?: string;
        message: string;
        detail?: string;
        noOption?: boolean;
    }) =>
        window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "info",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : ["Yes", "No"],
        }),
};
