import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell } from "@electron/remote";
import { ipcRenderer, webFrame } from "electron";

import * as pdfjsLib from "pdfjs-dist/build/pdf.js";

import chokidar from "chokidar";
import { z } from "zod";
import log from "electron-log";
log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/renderer.log");
import path from "path";
import fs from "fs";
import Colorjs from "color";
import themeJSON from "./themeInit.json";
import AniList from "./Components/anilist/request";
import { settingSchema } from "./utils/settingsSchema";
import { SHORTCUT_COMMAND_MAP, keyFormatter } from "./utils/keybindings";
declare module "react" {
    interface CSSProperties {
        [key: `--${string}`]: string | number;
    }
}
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

// to add new theme property, add it to each theme in ./themeInit.json
const themeProps = themeJSON.allData[0].main;

const formats = {
    image: {
        list: [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", ".avif"],
        test: function (str: string) {
            return !!str && this.list.includes(path.extname(str).toLowerCase());
        },
    },
    files: {
        list: [".zip", ".cbz", ".7z", ".cb7", ".rar", ".cbr", ".pdf", ".epub", ".xhtml", ".html", ".txt"],
        test: function (str: string) {
            return !!str && this.list.includes(path.extname(str).toLowerCase());
        },
        getName(str: string) {
            const ext = path.extname(str);
            if (!this.list.includes(ext)) return str;
            return path.basename(str, ext);
        },
        getExt(str: string) {
            const ext = path.extname(str);
            if (!this.list.includes(ext)) return "";
            return ext.replace(".", "").toUpperCase();
        },
    },
    packedManga: {
        list: [".zip", ".cbz", ".7z", ".cb7", ".rar", ".cbr"],
        test: function (str: string) {
            return str && this.list.includes(path.extname(str).toLowerCase());
        },
    },
    book: {
        list: [".epub", ".xhtml", ".html", ".txt"],
        test: function (str: string) {
            return str && this.list.includes(path.extname(str).toLowerCase());
        },
    },
};
window.app.formats = formats;
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
        getCSSPath: (elem: Element) => string;
        path: typeof path;
        fs: typeof fs;
        themeProps: { [e in ThemeDataMain]: string };
        keyFormatter: (event: KeyboardEvent | React.KeyboardEvent, limited?: boolean) => string;
        SHORTCUT_COMMANDS: {
            command: ShortcutCommands;
            name: string;
            defaultKeys: string[];
        }[];
        /**
         * Anilist
         */
        al: AniList;
        color: {
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
                divider: () => MenuListItem;
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
            formats: typeof formats;
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
                chapterURL: string;
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
             * why did i add this? bcoz linkInReader state is showing initial only in App.tsx
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
        temp: unknown;
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
                detail?: string;
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
                detail?: string;
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
                noLink,
            }: {
                title?: string;
                message: string;
                detail?: string;
                noOption?: boolean;
                buttons?: string[];
                defaultId?: number;
                noLink?: boolean;
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
        progressVolumes: number;
        score: number;
        repeat: number;
        private: boolean;
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
        chapterURL: string;
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

    type ShortcutCommands = (typeof SHORTCUT_COMMAND_MAP)[number]["command"];

    type ShortcutSchema = {
        command: ShortcutCommands;
        keys: string[];
    };
    type MenuListItem = {
        label: string;
        action: () => void;
        disabled?: boolean;
        /**
         * checked or enabled
         */
        selected?: boolean;
        style?: React.CSSProperties;
        /**
         * if true ignore all data and show line
         */
        divider?: boolean;
    };
    type IContextMenuData = {
        clickX: number;
        clickY: number;
        focusBackElem?: EventTarget | null;
        /**
         * leave extra space on left side, useful when have "check" items in list
         */
        padLeft?: boolean;
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
        selected?: boolean;
        style?: React.CSSProperties;
    };
    type IColorSelectData = {
        value: Color;
        onChange: (color: Color) => void;
        onBlur?: (e: React.FocusEvent<HTMLDivElement, Element>) => void;
        focusBackElem?: HTMLElement | null;
        elemBox: HTMLElement | { x: number; y: number } | null;
    };
    type AppSettings = z.infer<typeof settingSchema>;
    type Color = Colorjs;
}

window.path = path;
window.fs = fs;
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
    "--contentMenu-item-bg-color-hover": "Context-Menu Item BG Hovered/Focused",
    //todo move to reader settings or add duplicate for epub
    "--zenModePage-bg": "ZenMode Page Indicator BG (Manga Reader only)",
};
window.SHORTCUT_COMMANDS = SHORTCUT_COMMAND_MAP;
window.keyFormatter = keyFormatter;
window.logger = log;
window.pdfjsLib = pdfjsLib;
window.chokidar = chokidar;
window.makeFileSafe = (string: string): string => {
    return string.replace(/(:|\\|\/|\||<|>|\*|\?)/g, "");
};

window.getCSSPath = (el) => {
    if (!(el instanceof Element)) return "";
    const path = [] as string[];
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
    /**
     * using this to fake right click event on element, for easier management
     */
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
    confirm: (
        { title = "Confirm", message, detail, noOption = true, buttons = ["Yes", "No"], noLink },
        defaultId = 1
    ) =>
        window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
            type: "info",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : buttons,
            defaultId,
            noLink,
        }),
};

const unzip = (link: string, extractPath: string) => {
    return window.electron.ipcRenderer.invoke("unzip", link, extractPath);
};

function promptSelectDir(
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
    const path = asFile ? (multi ? result : result[0]) : window.path.normalize(result[0]);
    cb && cb(path);
}

// for first launch
if (localStorage.getItem("anilist_token") === null) localStorage.setItem("anilist_token", "");
if (localStorage.getItem("anilist_tracking") === null) localStorage.setItem("anilist_tracking", "[]");
window.al = new AniList(localStorage.getItem("anilist_token") || "");

export { unzip, promptSelectDir };
