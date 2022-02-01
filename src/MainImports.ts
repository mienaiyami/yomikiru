import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell } from "@electron/remote";
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
            clipboard: typeof clipboard;
            nativeImage: typeof nativeImage;
        };
        path: typeof path;
        fs: typeof fs;
        app: {
            betterSortOrder: (x: string, y: string) => number;
            titleBarHeight: number;
            isReaderOpen: boolean;
            clickDelay: number;
            lastClick: number;
        };
        loadManga: string;
        cachedImageList: { link: string; images: string[] };
        temp: any;
    }
    interface appsettings {
        theme: string;
        bookmarksPath: string;
        historyPath: string;
        baseDir: string;
        historyLimit: number;
        locationListSortType: "normal" | "inverse";
        readerSettings: {
            readerWidth: number;
            variableImageSize: boolean;
            readerTypeSelected: 0 | 1;
            pagesPerRowSelected: 0 | 1 | 2;
            gapBetweenRows: boolean;
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
    interface IContextMenuData {
        isBookmark?: boolean;
        isHistory?: boolean;
        isFile?: boolean;
        isImg?: boolean;
        link: string;
        e: MouseEvent;
        item?: ListItemE;
    }
}
window.path = path;
window.fs = fs;
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
};
