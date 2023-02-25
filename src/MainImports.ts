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
import themeJSON from "./themeInit.json";
declare module "react" {
    interface CSSProperties {
        [key: `--${string}`]: string | number;
    }
}

type WidenPrimitive<T> =
    | (T extends number ? number : T)
    | (T extends boolean ? boolean : T)
    | (T extends string ? string : T)
    | (T extends bigint ? bigint : T);

type DeepArrayToUnion<T> = T extends T
    ? {
          -readonly [K in keyof T]: T[K] extends readonly unknown[]
              ? DeepArrayToUnion<T[K][number]>
              : DeepArrayToUnion<WidenPrimitive<T[K]>>;
      }
    : never;

export const settingValidatorData = {
    theme: "",
    bookmarksPath: "",
    historyPath: "",
    baseDir: "",
    locationListSortType: ["normal", "inverse"],
    /**
     * Check for new update on start of app.
     */
    updateCheckerEnabled: false,
    askBeforeClosing: false,
    skipMinorUpdate: false,
    /**
     * Open chapter in reader directly, one folder inside of base manga dir.
     */
    openDirectlyFromManga: false,
    showTabs: {
        bookmark: true,
        history: true,
    },
    useCanvasBasedReader: false,
    // disableCachingCanvas: false,
    readerSettings: {
        readerWidth: 0,
        variableImageSize: false,
        /**
         * * `0` - Vertical scroll
         * * `1` - Left to Right
         * * `2` - Right to Left
         */
        readerTypeSelected: [0, 1, 2],
        /**
         * * `0` - One page per row.
         * * `1` - Two pages per row.
         * * `2` - Two pages per row, but first row only has one.
         */
        pagesPerRowSelected: [0, 1, 2],
        gapBetweenRows: false,
        sideListWidth: 0,
        widthClamped: true,
        gapSize: 0,
        showPageNumberInZenMode: false,
        scrollSpeed: 0,
        largeScrollMultiplier: 0,
        /**
         * reading direction in two pages per row
         * * `0` - ltr
         * * `1` - rtl
         */
        readingSide: [0, 1],
        // fitVertically: false,
        /**
         * * `0` - None
         * * `1` - Fit Vertically
         * * `2` - Fit Horizontally
         * * `3` - 1:1
         */
        fitOption: [0, 1, 2, 3],
        disableChapterTransitionScreen: false,
        /**
         * Decide which is enabled, maxWidth or maxHeight
         */
        maxHeightWidthSelector: ["none", "width", "height"],
        maxWidth: 500,
        maxHeight: 500,
    },
} as const;

// to add new theme property, add it to each theme in ./themeInit.json
const themeProps = themeJSON[0].main;
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
            webFrame: typeof webFrame;
        };
        /**
         * Library to un-archive zip or cbz.
         */
        crossZip: typeof crossZip;
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
            /**
             * returns string where .cbz and .zip are replace with " - CBZ file" and " - ZIP file"
             */
            replaceExtension: (str: string) => string;
            deleteDirOnClose: string;
            titleBarHeight: number;
            isReaderOpen: boolean;
            randomString: (length: number) => string;
            clickDelay: number;
            lastClick: number;
            currentPageNumber: number;
            scrollToPage: (pageNumber: number, behavior?: ScrollBehavior, callback?: () => void) => void;
            keyRepeated: boolean;
            // to remove later
            keydown: boolean;
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
            /**
             *
             * by default only show "Ok" button. `onOption=false` for buttons.
             * if `onOption=false`, default buttons "Yes","No". while default return id is 1(No)
             *
             */
            warn: ({
                title,
                message,
                detail,
                noOption,
                buttons,
                defaultId,
            }: {
                title?: string;
                message: string;
                detail?: string | undefined;
                noOption?: boolean;
                buttons?: string[];
                defaultId?: number;
            }) => Promise<Electron.MessageBoxReturnValue>;

            /**
             *
             * by default only show "Ok" button. `onOption=false` for buttons.
             * if `onOption=false`, default buttons "Yes","No". while default return id is 1(No)
             *
             */
            confirm: ({
                title,
                message,
                detail,
                noOption,
                buttons,
                defaultId,
            }: {
                title?: string;
                message: string;
                detail?: string | undefined;
                noOption?: boolean;
                buttons?: string[];
                defaultId?: number;
            }) => Promise<Electron.MessageBoxReturnValue>;
        };
    }
    /**
     * css variable names of theme
     */
    type ThemeDataMain = keyof typeof themeProps;
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
    interface ChapterItem extends ListItem {
        page: number;
    }
    interface HistoryItem extends ChapterItem {
        /**
         * Set of chapter names already read under same manga.
         */
        chaptersRead: string[];
        // chaptersRead:Set<string>;
        mangaLink: string;
    }
    interface ListItemE extends ChapterItem {
        index: number;
        isBookmark: boolean;
        isHistory: boolean;
    }
    /**
     * Available shortcut commands.
     * to add keyboard shortcuts, add ShortcutSchema to `window.shortcutsFunctions`
     * then register shortcut in `Reader.tsx` under `registerShortcuts` function
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
        | "showHidePageNumberInZen"
        | "cycleFitOptions"
        | "selectReaderMode0"
        | "selectReaderMode1"
        | "selectReaderMode2"
        | "selectPagePerRow1"
        | "selectPagePerRow2"
        | "selectPagePerRow2odd";
    interface ShortcutSchema {
        /**
         * name of command
         */
        command: ShortcutCommands;
        /**
         * display name in settings
         */
        name: string;
        /**
         * empty string for none
         */
        key1: string;
        /**
         * empty string for none
         */
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

    type AppSettings = DeepArrayToUnion<typeof settingValidatorData>;
}

window.path = path;
window.fs = fs;
window.supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", ".avif"];
window.themeProps = themeProps;
window.shortcutsFunctions = [
    {
        command: "navToPage",
        name: "Search Page Number",
        key1: "f",
        key2: "",
    },
    {
        command: "toggleZenMode",
        name: "Toggle Zen Mode / Full Screen",
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
        name: "Bigger Scroll, Scroll B (Shift+key for reverse)",
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
        key1: "p",
        key2: "",
    },
    {
        command: "cycleFitOptions",
        name: "Cycle through fit options",
        key1: "v",
        key2: "",
    },
    {
        command: "selectReaderMode0",
        name: "Reading mode - Vertical Scroll",
        key1: "9",
        key2: "",
    },
    {
        command: "selectReaderMode1",
        name: "Reading mode - Left to Right",
        key1: "0",
        key2: "",
    },
    {
        command: "selectReaderMode2",
        name: "Reading mode - Right to Left",
        key1: "",
        key2: "",
    },
    {
        command: "selectPagePerRow1",
        name: "Select Page Per Row - 1",
        key1: "1",
        key2: "",
    },
    {
        command: "selectPagePerRow2",
        name: "Select Page Per Row - 2",
        key1: "2",
        key2: "",
    },
    {
        command: "selectPagePerRow2odd",
        name: "Select Page Per Row - 2odd",
        key1: "3",
        key2: "",
    },
];
window.logger = log;
window.crossZip = crossZip;
const collator = Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
window.app.betterSortOrder = collator.compare;
window.app.replaceExtension = (str) => {
    return str.replace(/\.zip/gi, " [ZIP file]").replace(/\.cbz/gi, " [CBZ file]");
};
window.app.deleteDirOnClose = "";
window.app.currentPageNumber = 1;
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
    warn: ({ title = "Warning", message, detail, noOption = true, buttons = ["Yes", "No"], defaultId = 1 }) => {
        // window.logger.warn(message, detail || "");
        return window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "warning",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : buttons,
            defaultId,
        });
    },
    confirm: ({ title = "Confirm", message, detail, noOption = true, buttons = ["Yes", "No"] }, defaultId = 1) =>
        window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "info",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : buttons,
            defaultId,
        }),
};
/**
 * async file save
 */
const saveJSONfile = (path: string, data: any) => {
    window.fs.writeFile(path, JSON.stringify(data, null, "\t"), (err) => {
        if (err) {
            window.logger.error(err);
            window.dialog.nodeError(err);
        }
    });
};

const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const historyPath = window.path.join(userDataURL, "history.json");
const themesPath = window.path.join(userDataURL, "themes.json");
const shortcutsPath = window.path.join(userDataURL, "shortcuts.json");

const defaultSettings: AppSettings = {
    theme: "theme2",
    bookmarksPath,
    historyPath,
    baseDir: window.electron.app.getPath("home"),
    locationListSortType: "normal",
    updateCheckerEnabled: true,
    askBeforeClosing: false,
    skipMinorUpdate: false,
    openDirectlyFromManga: false,
    showTabs: {
        bookmark: true,
        history: true,
    },
    useCanvasBasedReader: false,
    // disableCachingCanvas: false,
    readerSettings: {
        readerWidth: 60,
        variableImageSize: true,
        readerTypeSelected: 0,
        pagesPerRowSelected: 0,
        gapBetweenRows: true,
        sideListWidth: 450,
        widthClamped: true,
        gapSize: 10,
        showPageNumberInZenMode: true,
        scrollSpeed: 5,
        largeScrollMultiplier: 15,
        readingSide: 1,
        // fitVertically: false,
        fitOption: 0,
        disableChapterTransitionScreen: false,
        maxHeightWidthSelector: "none",
        maxHeight: 500,
        maxWidth: 500,
    },
};

/**
 * Make settings.json for app.
 * @param locations (optional) only update given locations in settings.json.
 */
const makeSettingsJson = (locations?: string[]) => {
    if (locations) {
        const settingsDataSaved = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
        locations.forEach((e) => {
            window.logger.log(`"SETTINGS: ${e}" missing/corrupted in app settings, adding new...`);
            const l: string[] = e.split(".");
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            if (l.length === 1) settingsDataSaved[l[0]] = settingsDataNew[l[0]];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            if (l.length === 2) settingsDataSaved[l[0]][l[1]] = settingsDataNew[l[0]][l[1]];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            if (l.length === 3) settingsDataSaved[l[0]][l[1]][l[2]] = settingsDataNew[l[0]][l[1]][l[2]];
        });
        window.fs.writeFileSync(settingsPath, JSON.stringify(settingsDataSaved, null, "\t"));
    } else window.fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, "\t"));
};

if (!window.fs.existsSync(settingsPath)) {
    window.dialog.warn({ message: "No settings found, Select manga folder to make default in settings" });
    makeSettingsJson();
}

/**
 * Check if settings.json is valid or not.
 * @returns
 * * `isValid` - boolean
 * * `location` - array of invalid settings location, empty array if whole is corrupted
 */
const isSettingsValid = (): { isValid: boolean; location: string[] } => {
    try {
        JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
    } catch (err) {
        window.logger.error(err);
        makeSettingsJson();
        return { isValid: false, location: [] };
    }
    const settings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
    const output: { isValid: boolean; location: string[] } = {
        isValid: true,
        location: [],
    };
    Object.entries(settingValidatorData).forEach(([key, value]) => {
        if (!Object.prototype.hasOwnProperty.call(settings, key)) {
            output.isValid = false;
            output.location.push(key);
            return;
        }
        if (
            (typeof value === "string" && typeof settings[key] !== "string") ||
            (typeof value === "number" && typeof settings[key] !== "number") ||
            (typeof value === "boolean" && typeof settings[key] !== "boolean") ||
            (typeof value === "object" && !(value instanceof Array) && typeof settings[key] !== "object")
        ) {
            output.isValid = false;
            output.location.push(key);
            return;
        }
        if (value instanceof Array) {
            if (!value.includes(settings[key])) {
                output.isValid = false;
                output.location.push(key);
            }
            return;
        }
        if (value instanceof Object) {
            Object.entries(value).forEach(([key2, value2]) => {
                if (!Object.prototype.hasOwnProperty.call(settings[key], key2)) {
                    output.isValid = false;
                    output.location.push(`${key}.${key2}`);
                    return;
                }
                if (
                    (typeof value2 === "string" && typeof settings[key][key2] !== "string") ||
                    (typeof value2 === "number" && typeof settings[key][key2] !== "number") ||
                    (typeof value2 === "boolean" && typeof settings[key][key2] !== "boolean") ||
                    (typeof value2 === "object" &&
                        !(value2 instanceof Array) &&
                        typeof settings[key][key2] !== "object")
                ) {
                    output.isValid = false;
                    output.location.push(`${key}.${key2}`);
                    return;
                }
                if (value2 instanceof Array) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    //@ts-ignore
                    if (!value2.includes(settings[key][key2])) {
                        output.isValid = false;
                        output.location.push(`${key}.${key2}`);
                    }
                    return;
                }
            });
        }
    });
    return output;
};

// todo: remove useless
export {
    settingsPath,
    bookmarksPath,
    historyPath,
    themesPath,
    shortcutsPath,
    defaultSettings,
    makeSettingsJson,
    isSettingsValid,
    saveJSONfile,
};
