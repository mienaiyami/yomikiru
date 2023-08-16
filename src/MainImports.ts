import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell } from "@electron/remote";
import { ipcRenderer, webFrame } from "electron";
/*//! i know its dangerous but its offline app and i was unable to get BrowserWindow to work
  //! in renderer with contextBridge from preload


  //! nah is it really? idk, since no remote content is loaded other than anilist
 */
import chokidar from "chokidar";
import * as pdfjsLib from "pdfjs-dist/build/pdf.js";
// import pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import worker from "pdfjs-dist/build/pdf.worker.js";
pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
// const worker = new Worker();
// import * as pdfjsLib from "pdfjs-dist";
// pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

import log from "electron-log";
log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/renderer.log");
import path from "path";
import fs from "fs";
import Colorjs from "color";
import themeJSON from "./themeInit.json";
import AniList from "./Components/anilist/request";
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
          //! any[] as temp for now
          -readonly [K in keyof T]: T[K] extends readonly []
              ? any[]
              : T[K] extends readonly unknown[]
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
    hideOpenArrow: false,
    /**
     * Show more data in title attr in bookmark/history tab items
     */
    showMoreDataOnItemHover: true,
    autoRefreshSideList: false,
    keepExtractedFiles: false,
    checkboxReaderSetting: false,
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
        /**
         * to be used in `page.getViewport({ scale: | })`
         * higher scale = higher quality
         */
        pdfScale: 1,
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
        invertImage: false,
        grayscale: false,
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
        loadOneChapter: true,
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
        useDefault_fontWeight: true,
        fontWeight: 500,
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
        quickFontFamily: [],
        textSelect: true,
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
         * to convert pdf to img.
         */
        pdfjsLib: typeof pdfjsLib;
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
        // fileSaveTimeOut: Map<string, NodeJS.Timeout | null>;
        /**
         * Anilist
         */
        al: AniList;
        color: {
            // RGBA_to_hex: (RGB: { r: number; g: number; b: number; a?: number }) => ColorFormats["hex"] | undefined;
            // /**
            //  *
            //  * @param RGBA_Str rgba()
            //  * @returns
            //  */
            // parseRGBA:(RGBA_Str:string)=>ColorFormats["rgba"];
            // // stringifyRGBA:(RGBA:ColorFormats["rgba"])=>string;
            // hex_to_RGBA: (hex: string) =>
            //     | ColorFormats["rgba"]
            //     | undefined;
            // /**
            //  * @param longHex #RRGGBBAA
            //  */
            // separateHex: (longHex: string) => { color: ColorFormats["hex"]; alpha: number };
            new: (...args: Parameters<typeof Colorjs>) => Colorjs;
            /**
             * returns `Color` from css variable or color string
             */
            realColor: (var_or_color: string, themeDataMain: ThemeData["main"]) => Colorjs;
            /**
             *
             * @param variableStr css variable name, e.g. `var(--btn-color-hover)`
             * @returns `--btn-color-hover`, `undefined` if not valid
             */
            cleanVariable: (variableStr: string) => ThemeDataMain | undefined;
            /**
             *
             * @param variableStr css variable name, e.g. `var(--btn-color-hover)` or `--btn-color-hover`
             */
            varToColor: (variableStr: string, themeDataMain: ThemeData["main"]) => Colorjs | undefined;
        };
        contextMenu: {
            fakeEvent: (
                elem: HTMLElement | { posX: number; posY: number },
                focusBackElem?: HTMLElement | null
            ) => MouseEvent;
            template: {
                open: (url: string) => MenuListItem;
                openInNewWindow: (url: string) => MenuListItem;
                showInExplorer: (url: string) => MenuListItem;
                copyPath: (url: string) => MenuListItem;
                copyImage: (url: string) => MenuListItem;
                addToBookmark: (data: ListItemE) => MenuListItem;
                removeHistory: (url: string) => MenuListItem;
                removeBookmark: (url: string) => MenuListItem;
                unreadChapter: (mangaIndex: number, chapterIndex: number) => MenuListItem;
                unreadAllChapter: (mangaIndex: number) => MenuListItem;
                readChapter: (mangaIndex: number, chapters: string) => MenuListItem;
                readAllChapter: (mangaIndex: number, chapters: string[]) => MenuListItem;
            };
        };
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

    type AniListTrackItem = {
        localURL: string;
        anilistMediaId: number;
    };
    type AniListTrackStore = AniListTrackItem[];
    type AniListMangaData = {
        id: number;
        mediaId: number;
        status: "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";
        progress: number;
        score: number;
        repeat: number;
        startedAt: {
            year: number | null;
            month: number | null;
            day: number | null;
        };
        completedAt: {
            year: number | null;
            month: number | null;
            day: number | null;
        };
        media: {
            title: {
                english: string;
                romaji: string;
                native: string;
            };
            coverImage: {
                medium: string;
            };
            bannerImage: string;
            siteUrl: string;
        };
    };

    type Themes = { name: string; allData: ThemeData[] };
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
    type ChapterItem = MangaItem & {
        page: number;
    };
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
        focused: boolean;
    };
    type BookItem = {
        title: string;
        author: string;
        link: string;
        date?: string;
        chapter?: string;
    };
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
    type TOCData = {
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
    };

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
    type MenuListItem = {
        label: string;
        action: () => void;
        disabled: boolean;
        style?: React.CSSProperties;
    };
    type IContextMenuData = {
        clickX: number;
        clickY: number;
        focusBackElem?: EventTarget | null;
        items: MenuListItem[];
    };
    type IOptSelectData = {
        items: MenuListItem[];
        onBlur?: (e: React.FocusEvent<HTMLDivElement, Element>) => void;
        focusBackElem?: HTMLElement | null;
        // display: boolean;
        elemBox: HTMLElement | { x: number; y: number; width: number } | null;
    };
    type IOptSelectOption = {
        label: string;
        value: string;
        // todo implement
        current?: boolean;
        style?: React.CSSProperties;
    };
    type IColorSelectData = {
        value: Color;
        onChange: (color: Color) => void;
        onBlur?: (e: React.FocusEvent<HTMLDivElement, Element>) => void;
        focusBackElem?: HTMLElement | null;
        elemBox: HTMLElement | { x: number; y: number } | null;
    };
    type AppSettings = DeepArrayToUnion<typeof settingValidatorData>;
    type Color = Colorjs;
    // type ColorFormats = {
    //     hex:string;
    //     rgba:{
    //         /**
    //          * [0-255] int
    //          */
    //         r: number;
    //         /**
    //          * [0-255] int
    //          */
    //         g: number;
    //         /**
    //          * [0-255] int
    //          */ b: number;
    //         /**
    //          * [0-1] float
    //          */ a: number;
    //     }
    //     hsla:{
    //         h:number;
    //         s:number;
    //         l:number;
    //         a:number;
    //     }
    // };
}

window.path = path;
window.fs = fs;
window.supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", ".avif"];
window.themeProps = {
    "--body-bg-color": "Body BG Color",
    "--topBar-color": "Top-Bar BG Color",
    "--icon-color": "Icon Color",
    "--font-color": "Text Color",
    "--font-color-secondary": "Text Color Secondary",
    "--font-select-color": "Selected Text Color",
    "--font-select-bg-color": "Selected Text BG Color",
    "--btn-color": "Button Color",
    "--btn-color-hover": "Button Hover Color",
    "--btn-color-focus": "Button Focus Color",
    "--btn-shadow-focus": "Button Focus Shadow Color",
    "--topBar-btn-hover": "Top-Bar Button Color Hovered",
    "--text-input-bg": "Input BG Color",
    "--text-input-bg-focus": "Input BG Color Focused",
    "--listItem-bg-color": "List-Item BG Color",
    "--listItem-bg-color-hover": "List-Item BG Color Hovered",
    "--listItem-bg-color-read": "List-Item BG Color AlreadyRead",
    "--listItem-bg-color-current": "List-Item BG Color (Current in SideList)",
    "--readerSettings-bg": "Reader Settings BG",
    "--readerSettings-toggleBtn-bg-color": "Reader Setting Toggle Button Color",
    "--readerSettings-toggleBtn-bg-color-hover": "Reader Setting Toggle Button Color Hovered",
    "--sideList-bg-color": "Reader Side-List BG Color",
    "--reader-sidelist-divider-color": "Reader Side-List Divider Color",
    "--scrollbar-track-color": "Scroll-Bar Track Color",
    "--scrollbar-thumb-color": "Scroll-Bar Thumb Color",
    "--scrollbar-thumb-color-hover": "Scroll-Bar Thumb Color Hovered",
    "--code-text-color": "Code Text Color",
    "--code-bg-color": "Code BG Color",
    "--code-shadow-color": "Code Shadow Color",
    "--divider-color": "Divider Color",
    "--contextMenu-bg-color": "Context-Menu BG",
    "--contentMenu-item-color": "Context-Menu Item BG",
    "--contentMenu-item-bg-color-hover": "Context-Menu Item BG Hovered",
    "--zenModePage-bg": "ZenMode Page Indicator BG (Manga Reader only)",
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
window.pdfjsLib = pdfjsLib;
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
//todo , make better
window.app.replaceExtension = (str, replaceWith = "~") => {
    return str
        .replace(/\.zip$/i, replaceWith === "~" ? " $ZIP" : replaceWith)
        .replace(/\.cbz$/i, replaceWith === "~" ? " $CBZ" : replaceWith)
        .replace(/\.epub$/i, replaceWith === "~" ? " $EPUB" : replaceWith)
        .replace(/\.7z$/i, replaceWith === "~" ? " $7Z" : replaceWith)
        .replace(/\.pdf$/i, replaceWith === "~" ? " $PDF" : replaceWith)
        .replace(/\.rar$/i, replaceWith === "~" ? " $RAR" : replaceWith);
};
window.app.isSupportedFormat = (str: string) =>
    window.app.replaceExtension(str).includes("$ZIP") ||
    window.app.replaceExtension(str).includes("$CBZ") ||
    window.app.replaceExtension(str).includes("$7Z") ||
    window.app.replaceExtension(str).includes("$EPUB") ||
    window.app.replaceExtension(str).includes("$PDF") ||
    window.app.replaceExtension(str).includes("$RAR");
window.app.deleteDirOnClose = "";
window.app.currentPageNumber = 1;
window.app.epubHistorySaveData = null;
window.app.linkInReader = {
    type: "",
    link: "",
    page: 1,
    chapter: "",
};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
window.contextMenu = {
    fakeEvent(elem, focusBackElem) {
        if (elem instanceof HTMLElement)
            return new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: false,
                view: window,
                button: 2,
                buttons: 0,
                clientX: elem.getBoundingClientRect().width + elem.getBoundingClientRect().x - 10,
                clientY: elem.getBoundingClientRect().height / 2 + elem.getBoundingClientRect().y,
                relatedTarget: focusBackElem,
            });
        else
            return new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: false,
                view: window,
                button: 2,
                buttons: 0,
                clientX: elem.posX,
                clientY: elem.posY,
                relatedTarget: focusBackElem,
            });
    },
};
// window.fileSaveTimeOut = new Map();
window.app.randomString = (length: number) => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i <= length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};
window.color = {
    // hex_to_RGBA(hex) {
    //     if (hex && typeof hex === "string" && hex.charAt(0) === "#") {
    //         const colorRaw = hex.replace("#", "");
    //         const colorRGBA = {
    //             r: 0,
    //             g: 0,
    //             b: 0,
    //             a: 1,
    //         };
    //         if (colorRaw.length === 3) {
    //             colorRGBA.r = parseInt(colorRaw.charAt(0).repeat(2), 16);
    //             colorRGBA.g = parseInt(colorRaw.charAt(1).repeat(2), 16);
    //             colorRGBA.b = parseInt(colorRaw.charAt(2).repeat(2), 16);
    //         }
    //         if (colorRaw.length === 4) {
    //             colorRGBA.r = parseInt(colorRaw.charAt(0).repeat(2), 16);
    //             colorRGBA.g = parseInt(colorRaw.charAt(1).repeat(2), 16);
    //             colorRGBA.b = parseInt(colorRaw.charAt(2).repeat(2), 16);
    //             colorRGBA.a = parseFloat((parseInt(colorRaw.charAt(2).repeat(2), 16) / 255).toFixed(3));
    //         }
    //         if (colorRaw.length === 6) {
    //             colorRGBA.r = parseInt(colorRaw.substring(0, 2), 16);
    //             colorRGBA.g = parseInt(colorRaw.substring(2, 4), 16);
    //             colorRGBA.b = parseInt(colorRaw.substring(4, 6), 16);
    //         }
    //         if (colorRaw.length === 8) {
    //             colorRGBA.r = parseInt(colorRaw.substring(0, 2), 16);
    //             colorRGBA.g = parseInt(colorRaw.substring(2, 4), 16);
    //             colorRGBA.b = parseInt(colorRaw.substring(4, 6), 16);
    //             colorRGBA.a = parseFloat((parseInt(colorRaw.substring(6, 8), 16) / 255).toFixed(3));
    //         }
    //         return colorRGBA;
    //     }
    // },
    // RGBA_to_hex(RGB) {
    //     if (RGB) {
    //         let hex = "#";
    //         hex += RGB.r.toString(16).padStart(2, "0");
    //         hex += RGB.g.toString(16).padStart(2, "0");
    //         hex += RGB.b.toString(16).padStart(2, "0");
    //         if (RGB.a)
    //             hex += Math.round(RGB.a * 255)
    //                 .toString(16)
    //                 .padStart(2, "0");
    //         return hex;
    //     }
    // },
    // separateHex(longHex) {
    //     const hex = {
    //         color: "",
    //         alpha: 100,
    //     };
    //     if (longHex.length > 7) {
    //         hex.color = longHex.substring(0, 7);
    //         hex.alpha = parseInt(longHex.substring(7), 16) / 2.55;
    //     }
    //     return hex;
    // },
    new: (args) => Colorjs(args),
    realColor(var_or_color, themeDataMain) {
        if (this.cleanVariable(var_or_color)) {
            return this.varToColor(var_or_color, themeDataMain) as Colorjs;
        }
        return this.new(var_or_color);
    },
    cleanVariable(variableStr) {
        if (/var\(.*\)/gi.test(variableStr)) {
            return variableStr.replace("var(", "").replace(")", "") as ThemeDataMain;
        }
    },
    varToColor(variableStr, themeDataMain) {
        if (/var\(.*\)/gi.test(variableStr)) {
            let base = this.cleanVariable(variableStr);
            let clr = "";
            // getting real color value from a css variable (var(--btn-color-hover) -> #62636e)
            while (base && themeDataMain[base]) {
                clr = themeDataMain[base];
                // repeating in case variable is linked to another variable (var(--btn-color-hover) -> var(--btn-color))
                if (clr.includes("var(")) {
                    base = this.cleanVariable(clr);
                    continue;
                }
                break;
            }
            if (clr === "") window.logger.error("THEME::varToColor: color not found.");
            return this.new(clr);
        }
    },
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

export const unzip = (link: string, extractPath: string) => {
    return window.electron.ipcRenderer.invoke("unzip", link, extractPath);
};
// export const renderPDF = (link: string, extractPath: string, scale: number) => {
//     return window.electron.ipcRenderer.invoke("renderPDF", link, extractPath, scale);
// };
const saveJSONfile = (path: string, data: any) => {
    // console.log("Saving file ", window.fileSaveTimeOut, path);
    const str = JSON.stringify(data, null, "\t");
    if (str)
        try {
            // window.logger.log("Sent file to save:", path);
            if (JSON.parse(str)) window.electron.ipcRenderer.send("saveFile", path, str);
        } catch (err) {
            console.error("ERROR::saveJSONfile:renderer:", err);
        }
};

const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const historyPath = window.path.join(userDataURL, "history.json");
const themesPath = window.path.join(userDataURL, "themes.json");
const shortcutsPath = window.path.join(userDataURL, "shortcuts.json");

export function promptSelectDir(
    cb: (path: string | string[]) => void,
    asFile = false,
    filters?: Electron.FileFilter[],
    multi = false
): void {
    const result = window.electron.dialog.showOpenDialogSync(window.electron.getCurrentWindow(), {
        properties: asFile
            ? multi
                ? ["openFile", "multiSelections"]
                : ["openFile"]
            : ["openDirectory", "openFile"],
        filters,
    });

    if (!result) return;
    // todo, why need window.path.sep
    // const path = asFile ? (multi ? result : result[0]) : window.path.normalize(result[0] + window.path.sep);
    const path = asFile ? (multi ? result : result[0]) : window.path.normalize(result[0]);
    cb && cb(path);
}
export const renderPDF = (
    link: string,
    renderPath: string,
    scale: number,
    onUpdate?: (total: number, done: number) => void
) => {
    return new Promise(
        (
            res: (result: { count: number; success: number; renderPath: string; link: string }) => void,
            rej: (reason: { message: string; reason?: string }) => void
        ) => {
            const doc = window.pdfjsLib.getDocument(link);
            doc.onPassword = () => {
                window.dialog.customError({
                    message: "PDF is password protected.",
                    log: false,
                });
                rej({ message: "PDF is password protected." });
            };
            doc.promise
                .then((pdf) => {
                    let count = 0;
                    let success = 0;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        pdf.getPage(i).then((page) => {
                            const viewport = page.getViewport({
                                scale: scale || 1.5,
                            });
                            const canvas = document.createElement("canvas");
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            const context = canvas.getContext("2d");
                            if (context) {
                                // console.log("starting", i);
                                const abc = page.render({
                                    canvasContext: context,
                                    viewport: viewport,
                                    intent: "print",
                                });
                                abc.promise.then(() => {
                                    page.cleanup();
                                    const image = canvas.toDataURL("image/png");
                                    canvas.width = 0;
                                    canvas.width = 0;
                                    window.fs.writeFile(
                                        window.path.join(renderPath, "./" + i + ".png"),
                                        image.replace(/^data:image\/png;base64,/, ""),
                                        "base64",
                                        (err) => {
                                            if (err) {
                                                console.error(err);
                                            } else {
                                                // console.log("Made image", i + ".png");
                                                success++;
                                            }
                                            count++;
                                            onUpdate && onUpdate(pdf.numPages, count);
                                            if (count === pdf.numPages) {
                                                window.fs.writeFileSync(
                                                    window.path.join(renderPath, "SOURCE"),
                                                    link
                                                );
                                                res({ count, success, renderPath, link });
                                            }
                                        }
                                    );
                                });
                            }
                        });
                    }
                })
                .catch((reason) => {
                    if (window.fs.existsSync(renderPath)) window.fs.rmSync(renderPath, { recursive: true });
                    rej({ message: "PDF Reading Error", reason });
                });
        }
    );
};

// for first launch
if (localStorage.getItem("anilist_token") === null) localStorage.setItem("anilist_token", "");
if (localStorage.getItem("anilist_tracking") === null) localStorage.setItem("anilist_tracking", "[]");
window.al = new AniList(localStorage.getItem("anilist_token") || "");

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
    disableListNumbering: true,
    showSearch: false,
    openInZenMode: false,
    hideCursorInZenMode: false,
    hideOpenArrow: false,
    showMoreDataOnItemHover: true,
    autoRefreshSideList: false,
    keepExtractedFiles: false,
    checkboxReaderSetting: false,
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
        fitOption: 0,
        disableChapterTransitionScreen: false,
        maxHeightWidthSelector: "none",
        maxHeight: 500,
        maxWidth: 500,
        invertImage: false,
        grayscale: false,
        pdfScale: 1.5,
        customColorFilter: {
            enabled: false,
            r: 0,
            g: 0,
            b: 0,
            a: 1,
            blendMode: "screen",
        },
        forceLowBrightness: {
            enabled: false,
            value: 0.5,
        },
        settingsCollapsed: {
            size: false,
            fitOption: true,
            readingMode: false,
            pagePerRow: true,
            readingSide: true,
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
        useDefault_fontWeight: true,
        fontWeight: 500,
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
        quickFontFamily: ["Roboto", "Cambria"],
        textSelect: true,
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
                    if (value2.length === 0) {
                        if (!(settings[key][key2] instanceof Array)) {
                            output.isValid = false;
                            output.location.push(`${key}.${key2}`);
                        }
                        return;
                    }
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
