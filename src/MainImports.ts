import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell } from "@electron/remote";
import { ipcRenderer, webFrame } from "electron";
import crossZip from "cross-zip";
import log from "electron-log";
log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/renderer.log");
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
    //! try to map strings to theme.main
    /**
     * css variable names of theme
     */
    type ThemeDataMain =
        | "--body-bg"
        | "--sideList-bg"
        | "--icon-color"
        | "--font-color"
        | "--font-select-color"
        | "--font-select-bg"
        | "--color-primary"
        | "--color-secondary"
        | "--color-tertiary"
        | "--topBar-color"
        | "--topBar-hover-color"
        | "--input-bg"
        | "--btn-color1"
        | "--btn-color2"
        | "--listItem-bg-color"
        | "--listItem-hover-color"
        | "--listItem-alreadyRead-color"
        | "--listItem-current"
        | "--toolbar-btn-bg"
        | "--toolbar-btn-hover"
        | "--scrollbar-track-color"
        | "--scrollbar-thumb-color"
        | "--scrollbar-thumb-color-hover"
        | "--divider-color"
        | "--context-menu-text"
        | "--context-menu-bg"
        | "--zenModePageIndicator-bg";
    //! edit window.shortcutsFunctions as well
    /**
     * Available shortcut commands.
     */
    type ShortcutCommands =
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
        | "scrollUp"
        | "showHidePageNumberInZen";
    interface Window {
        electron: {
            app: typeof app;
            dialog: typeof dialog;
            shell: typeof shell;
            ipcRenderer: typeof ipcRenderer;
            getCurrentWindow: typeof getCurrentWindow;
            clipboard: typeof clipboard;
            nativeImage: typeof nativeImage;
            webFrame: typeof webFrame;
        };
        /**
         * Library to un-archive zip or cbz.
         */
        crossZip: typeof crossZip;
        currentPageNumber: number;
        scrollToPage: (pageNumber: number, callback?: () => void) => void;
        logger: typeof log;
        /**
         * Supported image formats.
         */
        supportedFormats: string[];
        path: typeof path;
        fs: typeof fs;
        themeProps: { [e in ThemeDataMain]: string };
        shortcutsFunctions: ShortcutSchema[];
        app: {
            betterSortOrder: (x: string, y: string) => number;
            deleteDirOnClose: string;
            titleBarHeight: number;
            isReaderOpen: boolean;
            randomString: (length: number) => string;
            // to remove later
            keydown: boolean;
            clickDelay: number;
            lastClick: number;
        };
        /**
         * Link of manga to be opened in reader only on start of new window.
         * Changed on window load, if `loadManga!==""` then open link (loadManga).
         */
        loadManga: string;
        cachedImageList: { link: string; images: string[] };
        temp: any;
        dialog: {
            nodeError: (err: NodeJS.ErrnoException) => Promise<Electron.MessageBoxReturnValue>;
            customError: ({
                title,
                message,
                detail,
                log,
            }: {
                title?: string;
                message: string;
                detail?: string | undefined;
                log?: boolean;
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
    interface ThemeData {
        name: string;
        main: {
            [e in ThemeDataMain]: string;
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
        command: ShortcutCommands;
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
        /**
         * Check for new update on start of app.
         */
        updateCheckerEnabled: boolean;
        askBeforeClosing: boolean;
        readerSettings: {
            readerWidth: number;
            variableImageSize: boolean;
            /**
             * * `0` - Infinite scroll
             * * `1` - Click to move
             */
            readerTypeSelected: 0 | 1;
            /**
             * * `0` - One page per row.
             * * `1` - Two pages per row.
             * * `2` - Two pages per row, but first row only has one.
             */
            pagesPerRowSelected: 0 | 1 | 2;
            gapBetweenRows: boolean;
            sideListWidth: number;
            widthClamped: boolean;
            gapSize: number;
            showPageNumberInZenMode: boolean;
            scrollSpeed: number;
            largeScrollMultiplier: number;
            // 0: "ltr"| 1: "rtl"
            /**
             * reading direction in two pages per row
             * * `0` - ltr
             * * `1` - rtl
             */
            readingSide: 0 | 1;
        };
    }
}
export const settingValidatorData = {
    theme: "string",
    bookmarksPath: "string",
    historyPath: "string",
    baseDir: "string",
    historyLimit: "number",
    locationListSortType: ["normal", "inverse"],
    updateCheckerEnabled: "boolean",
    askBeforeClosing: "boolean",
    readerSettings: {
        readerWidth: "number",
        variableImageSize: "boolean",
        readerTypeSelected: [0, 1],
        pagesPerRowSelected: [0, 1, 2],
        gapBetweenRows: "boolean",
        sideListWidth: "number",
        widthClamped: true,
        gapSize: "number",
        showPageNumberInZenMode: "boolean",
        scrollSpeed: "number",
        largeScrollMultiplier: "number",
        readingSide: [0, 1],
    },
};

window.path = path;
window.fs = fs;
window.currentPageNumber = 1;
window.supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", "avif"];
window.themeProps = {
    "--body-bg": "",
    "--sideList-bg": "",
    "--icon-color": "",
    "--font-color": "",
    "--font-select-color": "",
    "--font-select-bg": "",
    "--color-primary": "",
    "--color-secondary": "",
    "--color-tertiary": "",
    "--topBar-color": "",
    "--topBar-hover-color": "",
    "--input-bg": "",
    "--btn-color1": "",
    "--btn-color2": "",
    "--listItem-bg-color": "",
    "--listItem-hover-color": "",
    "--listItem-alreadyRead-color": "",
    "--listItem-current": "",
    "--toolbar-btn-bg": "",
    "--toolbar-btn-hover": "",
    "--scrollbar-track-color": "",
    "--scrollbar-thumb-color": "",
    "--scrollbar-thumb-color-hover": "",
    "--divider-color": "",
    "--context-menu-text": "",
    "--context-menu-bg": "",
    "--zenModePageIndicator-bg": "",
};
window.shortcutsFunctions = [
    {
        command: "navToPage",
        name: "Search Page Number",
        key1: "f",
        key2: "",
    },
    {
        command: "toggleZenMode",
        name: "Toggle Zen Mode",
        key1: "`",
        key2: "",
    },
    {
        command: "readerSettings",
        name: "Open/Close Reader Settings",
        key1: "q",
        key2: "",
    },
    {
        command: "nextChapter",
        name: "Next Chapter",
        key1: "]",
        key2: "",
    },
    {
        command: "prevChapter",
        name: "Previous Chapter",
        key1: "[",
        key2: "",
    },
    {
        command: "bookmark",
        name: "Bookmark",
        key1: "b",
        key2: "",
    },
    {
        command: "sizePlus",
        name: "Increase image size",
        key1: "=",
        key2: "+",
    },
    {
        command: "sizeMinus",
        name: "Decrease image size",
        key1: "-",
        key2: "",
    },
    {
        command: "largeScroll",
        name: "Bigger Scroll (Shift+key for reverse)",
        key1: " ",
        key2: "",
    },
    {
        command: "scrollUp",
        name: "Scroll Up",
        key1: "w",
        key2: "ArrowUp",
    },
    {
        command: "scrollDown",
        name: "Scroll Down",
        key1: "s",
        key2: "ArrowDown",
    },
    {
        command: "prevPage",
        name: "Previous Page",
        key1: "a",
        key2: "ArrowLeft",
    },
    {
        command: "nextPage",
        name: "Next Page",
        key1: "d",
        key2: "ArrowRight",
    },
    {
        command: "showHidePageNumberInZen",
        name: "Show/Hide Page number in Zen Mode",
        key1: "1",
        key2: "",
    },
];
window.logger = log;
window.crossZip = crossZip;
const collator = Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
window.app.betterSortOrder = collator.compare;
window.app.randomString = (length: number) => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i <= length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};
window.electron = {
    app,
    dialog,
    shell,
    ipcRenderer,
    getCurrentWindow,
    clipboard,
    nativeImage,
    webFrame,
};
window.dialog = {
    nodeError: (err: NodeJS.ErrnoException) => {
        window.logger.error(err);
        return window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "error",
            title: err.name,
            message: "Error no.: " + err.errno,
            detail: err.message,
        });
    },
    customError: ({ title = "Error", message, detail, log = true }) => {
        if (log) window.logger.error("Error:", message, detail || "");
        return window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "error",
            title: title,
            message: message,
            detail: detail,
        });
    },
    warn: ({ title = "Warning", message, detail, noOption = true }) => {
        // window.logger.warn(message, detail || "");
        return window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "warning",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : ["Yes", "No"],
            defaultId: 1,
        });
    },
    confirm: ({ title = "Confirm", message, detail, noOption = true }) =>
        window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "info",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : ["Yes", "No"],
        }),
};
