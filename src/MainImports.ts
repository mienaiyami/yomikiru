import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell } from "@electron/remote";
import { ipcRenderer, webFrame } from "electron";
/*//! i know its dangerous but its offline app and i was unable to get BrowserWindow to work
  //! in renderer with contextBridge from preload
 */
import crossZip from "cross-zip";
import chokidar from "chokidar";
import log from "electron-log";
log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/renderer.log");
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

// todo: use this as default settings by taking index 0 as default for arrays
export const settingValidatorData = {
    baseDir: "",
    customStylesheet: "",
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
    openOnDblClick: true,
    // disableCachingCanvas: false,
    recordChapterRead: true,
    // showPageNumOnHome: true,
    disableListNumbering: false,
    /**
     * show search input for history and bookmark
     */
    showSearch: false,

    openInZenMode: false,
    hideCursorInZenMode: false,
    readerSettings: {
        /**
         * width of reader in percent
         */
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
        scrollSpeedA: 0,
        scrollSpeedB: 0,
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
        customColorFilter: {
            enabled: false,
            /**
             * red 0-255
             */
            r: 0,
            g: 0,
            b: 0,
            /**
             * alpha 0-1
             */
            a: 1,
            blendMode: [
                "color",
                "color-burn",
                "color-dodge",
                "darken",
                "difference",
                "exclusion",
                "hard-light",
                "hue",
                "lighten",
                "luminosity",
                "multiply",
                "normal",
                "overlay",
                "saturation",
                "screen",
                "soft-light",
            ],
        },
        forceLowBrightness: {
            enabled: false,
            /**
             * opacity 0-1 of overlying black div
             */
            value: 0,
        },
        settingsCollapsed: {
            size: false,
            fitOption: false,
            readingMode: false,
            pagePerRow: false,
            readingSide: false,
            scrollSpeed: true,
            customColorFilter: true,
            others: false,
        },
    },
    epubReaderSettings: {
        /**load and show only one chapter at a time from TOC */
        loadOneChapter: false,
        /**
         * width of reader in percent
         */
        readerWidth: 50,
        /**
         * font size in px.
         */
        fontSize: 16,
        useDefault_fontFamily: true,
        fontFamily: "Roboto",
        useDefault_lineSpacing: true,
        /**
         * line height in em
         */
        lineSpacing: 1.4,
        useDefault_paragraphSpacing: true,
        /**
         * gap in em
         */
        paragraphSpacing: 2,
        useDefault_wordSpacing: true,
        wordSpacing: 1,
        hyphenation: false,
        scrollSpeedA: 0,
        scrollSpeedB: 0,
        /**
         * limit image height to 100%
         */
        limitImgHeight: true,
        noIndent: false,
        // all color valeus are hex
        useDefault_fontColor: true,
        fontColor: "none",
        useDefault_linkColor: false,
        linkColor: "none",
        useDefault_backgroundColor: true,
        backgroundColor: "none",
        useDefault_progressBackgroundColor: true,
        progressBackgroundColor: "none",
        /**
         * invert and blend-difference
         */
        invertImageColor: false,

        settingsCollapsed: {
            size: false,
            font: false,
            styles: true,
            scrollSpeed: true,
        },
        showProgressInZenMode: true,
        forceLowBrightness: {
            enabled: false,
            /**
             * opacity 0-1 of overlying black div
             */
            value: 0,
        },
    },
} as const;

// to add new theme property, add it to each theme in ./themeInit.json
const themeProps = themeJSON.allData[0].main;
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
        /**
         * watch for change in file/dir.
         */
        chokidar: typeof chokidar;
        /**
         * take string and make it safe for file system
         */
        makeFileSafe: (string: string) => string;
        logger: typeof log;
        /**
         * Supported image formats.
         */
        supportedFormats: string[];
        getCSSPath: (elem: Element) => string;
        path: typeof path;
        fs: typeof fs;
        themeProps: { [e in ThemeDataMain]: string };
        shortcutsFunctions: ShortcutSchema[];
        fileSaveTimeOut: Map<string, NodeJS.Timeout | null>;
        app: {
            betterSortOrder: (x: string, y: string) => number;
            /**
             * returns string where .cbz and .zip are replace with " - CBZ file" and " - ZIP file" etc.
             */
            replaceExtension: (str: string, replaceWith?: string) => string;
            /**
             * check if url is zip,cbz,epub or any supported extension.
             */
            isSupportedFormat: (str: string) => boolean;
            /**
             * temp dir to be removed after closing chapter which was extracted
             */
            deleteDirOnClose: string;
            titleBarHeight: number;
            isReaderOpen: boolean;
            randomString: (length: number) => string;
            clickDelay: number;
            lastClick: number;
            currentPageNumber: number;
            /**
             * used in epub reader only
             */
            epubHistorySaveData: {
                chapter: string;
                queryString: string;
            } | null;
            scrollToPage: (
                pageNumber_or_percent: number,
                behavior?: ScrollBehavior,
                callback?: () => void
            ) => void;
            keyRepeated: boolean;

            // todo: fix
            // todo: make better way to do this
            /**
             * why did i add this? bcoz fking linkInReader state is showing initial only in App.tsx
             */
            linkInReader: {
                type: "image" | "book" | "";
                link: string;
                page: number;
                chapter: string;
                /**
                 * elem query string for epub auto scroll
                 */
                queryStr?: string;
            };

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
    interface MangaItem {
        mangaName: string;
        chapterName: string;
        date?: string;
        link: string;
        pages: number;
    }
    interface ChapterItem extends MangaItem {
        page: number;
    }
    type MangaHistoryItem = {
        type: "image";
        data: {
            /**
             * Set of chapter names already read under same manga.
             */
            chaptersRead: string[];
            mangaLink: string;
        } & ChapterItem;
    };
    type BookHistoryItem = {
        type: "book";
        data: {
            /**
             * css query string of element to focus on load
             */
            elementQueryString: string;
        } & BookItem;
    };
    type HistoryItem = MangaHistoryItem | BookHistoryItem;
    type ListItemE = Manga_BookItem & {
        index: number;
        isBookmark: boolean;
        isHistory: boolean;
    };
    interface BookItem {
        title: string;
        author: string;
        link: string;
        date?: string;
        chapter?: string;
    }
    type BookBookmarkItem = BookItem & {
        /**
         * css query string of element to focus on load
         */
        elementQueryString: string;
    };
    type Manga_BookItem =
        | {
              type: "image";
              data: ChapterItem;
          }
        | {
              type: "book";
              data: BookBookmarkItem;
          };
    interface TOCData {
        title: string;
        author: string;
        /**real depth */
        depth: number;
        nav: {
            src: string;
            name: string;
            /**depth level of current nav */
            depth: number;
        }[];
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
        | "selectPagePerRow2odd"
        | "fontSizePlus"
        | "fontSizeMinus";
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
        clickX: number;
        clickY: number;
        hasLink?: {
            link: string;
            chapterItem?: {
                item: ListItemE;
                isBookmark?: boolean;
            };
            simple?: {
                isImage?: boolean;
            };
        };
    }

    type AppSettings = DeepArrayToUnion<typeof settingValidatorData>;
}

window.path = path;
window.fs = fs;
window.supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", ".avif"];
window.themeProps = {
    "--body-bg-color": "Body BG Color",
    "--sideList-bg-color": "SideList BG Color",
    "--icon-color": "Icon Color",
    "--font-color": "Text Color",
    "--font-select-color": "Selected Text Color",
    "--font-select-bg-color": "Selected Text BG Color",
    "--btn-color": "Button Color",
    "--btn-color-hover": "Button Hover Color",
    "--btn-color-focus": "Button Focus Color",
    "--btn-shadow-focus": "Button Focus Shadow Color",
    "--text-input-bg": "Text Input BG Color",
    "--text-input-bg-focus": "Text Input BG Color Focused",
    "--topBar-color": "TopBar BG Color",
    "--topBar-btn-hover": "TopBar Button Color Hovered",
    "--listItem-bg-color": "ListItem BG Color",
    "--listItem-bg-color-hover": "ListItem BG Color Hovered",
    "--listItem-bg-color-read": "ListItem BG Color AlreadyRead",
    "--listItem-bg-color-current": "ListItem BG Color (Current in SideList)",
    "--readerSettings-bg": "Reader Settings BG",
    "--readerSettings-toggleBtn-bg-color": "Reader Setting Toggle Button Color",
    "--readerSettings-toggleBtn-bg-color-hover": "Reader Setting Toggle Button Color Hovered",
    "--scrollbar-track-color": "ScrollBar Track Color",
    "--scrollbar-thumb-color": "ScrollBar Thumb Color",
    "--scrollbar-thumb-color-hover": "ScrollBar Thumb Color Hovered",
    "--code-bg-color": "Code BG Color",
    "--code-shadow-color": "Code Shadow Color",
    "--divider-color": "Divider Color",
    "--contextMenu-bg-color": "ContextMenu BG",
    "--contentMenu-item-color": "ContextMenu Item BG",
    "--contentMenu-item-bg-color-hover": "ContextMenu Item BG Hovered",
    "--zenModePage-bg": "ZenMode Page Indicator BG",
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

    {
        command: "fontSizePlus",
        name: "Increase font size (epub)",
        key1: "",
        key2: "",
    },
    {
        command: "fontSizeMinus",
        name: "Decrease font size (epub)",
        key1: "",
        key2: "",
    },
];
window.logger = log;
window.crossZip = crossZip;
window.chokidar = chokidar;
window.makeFileSafe = (string: string): string => {
    return string.replace(/(:|\\|\/|\||<|>|\*|\?)/g, "");
};

window.getCSSPath = (el) => {
    if (!(el instanceof Element)) return "";
    const path = [];
    let elem = el;
    while (elem.nodeType === Node.ELEMENT_NODE) {
        let selector = elem.nodeName.toLowerCase();
        if (elem.id) {
            selector += "#" + elem.id.trim();
            path.unshift(selector);
            break;
        } else {
            let sib = elem,
                nth = 1;
            while (sib.previousElementSibling) {
                sib = sib.previousElementSibling;
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += ":nth-of-type(" + nth + ")";
        }
        path.unshift(selector);
        elem = elem.parentNode as Element;
    }
    return path.join(" > ");
};

const collator = Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
window.app.betterSortOrder = collator.compare;
window.app.replaceExtension = (str, replaceWith = "~") => {
    return str
        .replace(/\.zip/gi, replaceWith === "~" ? " $ZIP" : replaceWith)
        .replace(/\.cbz/gi, replaceWith === "~" ? " $CBZ" : replaceWith)
        .replace(/\.epub/gi, replaceWith === "~" ? " $EPUB" : replaceWith);
};
window.app.isSupportedFormat = (str: string) =>
    str.includes("$ZIP") || str.includes("$CBZ") || str.includes("$EPUB");
window.app.deleteDirOnClose = "";
window.app.currentPageNumber = 1;
window.app.epubHistorySaveData = null;
window.app.linkInReader = {
    type: "",
    link: "",
    page: 1,
    chapter: "",
};
window.fileSaveTimeOut = new Map();
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
const saveJSONfile = (path: string, data: any, sync = false) => {
    // console.log("Saving file ", window.fileSaveTimeOut, path);
    const checkOld = window.fileSaveTimeOut.get(path);
    if (checkOld) {
        // console.log("saving in progress");
        clearTimeout(checkOld);
    }
    window.fileSaveTimeOut.set(
        path,
        setTimeout(
            () => {
                const saveString = JSON.stringify(data, null, "\t");
                if (saveString) {
                    try {
                        JSON.parse(saveString);
                        // console.log("Saving " + path);
                        if (sync) {
                            window.fs.writeFileSync(path, JSON.stringify(data, null, "\t"));
                            window.fileSaveTimeOut.delete(path);
                        } else
                            window.fs.writeFile(path, JSON.stringify(data, null, "\t"), (err) => {
                                if (err) {
                                    window.logger.error(err);
                                    window.dialog.nodeError(err);
                                }
                                window.fileSaveTimeOut.delete(path);
                            });
                    } catch (err) {
                        window.logger.error(err, "Retrying");
                        setTimeout(() => {
                            saveJSONfile(path, data, sync);
                        }, 1000);
                    }
                }
            },
            sync ? 0 : 2000
        )
    );
};

const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const historyPath = window.path.join(userDataURL, "history.json");
const themesPath = window.path.join(userDataURL, "themes.json");
const shortcutsPath = window.path.join(userDataURL, "shortcuts.json");

export const promptSelectDir = (
    cb: (path: string) => void,
    asFile = false,
    filters?: Electron.FileFilter[]
): void => {
    const result = window.electron.dialog.showOpenDialogSync(window.electron.getCurrentWindow(), {
        properties: asFile ? ["openFile"] : ["openDirectory", "openFile"],
        filters,
    });
    if (!result) return;
    const path = asFile ? result[0] : window.path.normalize(result[0] + window.path.sep);
    cb && cb(path);
};

// todo: try taking automatically from settingValidator
const defaultSettings: AppSettings = {
    baseDir: window.electron.app.getPath("home"),
    customStylesheet: "",
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
    openOnDblClick: true,
    // disableCachingCanvas: false,
    recordChapterRead: true,
    // showPageNumOnHome: true,
    disableListNumbering: false,
    showSearch: false,
    openInZenMode: false,
    hideCursorInZenMode: false,
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
        scrollSpeedA: 5,
        scrollSpeedB: 15,
        readingSide: 1,
        // fitVertically: false,
        fitOption: 0,
        disableChapterTransitionScreen: false,
        maxHeightWidthSelector: "none",
        maxHeight: 500,
        maxWidth: 500,
        customColorFilter: {
            enabled: false,
            r: 0,
            g: 0,
            b: 0,
            a: 1,
            blendMode: "normal",
        },
        forceLowBrightness: {
            enabled: false,
            value: 0.5,
        },
        settingsCollapsed: {
            size: false,
            fitOption: false,
            readingMode: false,
            pagePerRow: false,
            readingSide: false,
            scrollSpeed: true,
            customColorFilter: true,
            others: false,
        },
    },
    epubReaderSettings: {
        loadOneChapter: true,
        readerWidth: 50,
        fontSize: 16,
        useDefault_fontFamily: true,
        fontFamily: "Roboto",
        useDefault_lineSpacing: true,
        lineSpacing: 1.4,
        useDefault_paragraphSpacing: true,
        paragraphSpacing: 2,
        useDefault_wordSpacing: true,
        wordSpacing: 0,
        hyphenation: false,
        scrollSpeedA: 5,
        scrollSpeedB: 15,
        limitImgHeight: true,
        noIndent: false,

        useDefault_fontColor: true,
        fontColor: "#ffffff",
        useDefault_linkColor: false,
        linkColor: "#0073ff",
        useDefault_backgroundColor: true,
        backgroundColor: "#000000",
        useDefault_progressBackgroundColor: true,
        progressBackgroundColor: "#000000",

        invertImageColor: false,

        settingsCollapsed: {
            size: false,
            font: false,
            styles: true,
            scrollSpeed: true,
        },
        showProgressInZenMode: true,
        forceLowBrightness: {
            enabled: false,
            value: 0,
        },
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
            if (l.length === 1) settingsDataSaved[l[0]] = defaultSettings[l[0]];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            if (l.length === 2) settingsDataSaved[l[0]][l[1]] = defaultSettings[l[0]][l[1]];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            if (l.length === 3) settingsDataSaved[l[0]][l[1]][l[2]] = defaultSettings[l[0]][l[1]][l[2]];
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
        window.logger.log(window.fs.readFileSync(settingsPath, "utf-8"));
        // makeSettingsJson();
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
