import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell } from "@electron/remote";
import { ipcRenderer, webFrame } from "electron";

import chokidar from "chokidar";

import log from "electron-log";
import path from "path";
import fs from "fs";
import AniList from "../utils/anilist";
import Colorjs from "color";
import { ListItemE } from "@common/types/legacy";
import { settingSchema } from "../utils/settingsSchema";
import { SHORTCUT_COMMAND_MAP } from "../utils/keybindings";
import { z } from "zod";
import { formatUtils } from "../utils/file";
import { themeProps } from "../utils/theme";

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
                divider: () => Menu.ListItem;
                open: (url: string) => Menu.ListItem;
                openInNewWindow: (url: string) => Menu.ListItem;
                showInExplorer: (url: string) => Menu.ListItem;
                copyPath: (url: string) => Menu.ListItem;
                copyImage: (url: string) => Menu.ListItem;
                addToBookmark: (data: ListItemE) => Menu.ListItem;
                removeHistory: (url: string) => Menu.ListItem;
                removeBookmark: (url: string) => Menu.ListItem;
                unreadChapter: (mangaIndex: number, chapterIndex: number) => Menu.ListItem;
                unreadAllChapter: (mangaIndex: number) => Menu.ListItem;
                readChapter: (mangaIndex: number, chapters: string) => Menu.ListItem;
                readAllChapter: (mangaIndex: number, chapters: string[]) => Menu.ListItem;
            };
        };
        app: {
            betterSortOrder: (x: string, y: string) => number;
            formats: typeof formatUtils;
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
            //todo improve
            /**
             * used in epub reader only
             */
            epubHistorySaveData: {
                chapterName: string;
                id: string;
                elementQueryString: string;
            } | null;
            scrollToPage: (
                pageNumber_or_percent: number,
                behavior?: ScrollBehavior,
                callback?: () => void
            ) => void;
            keyRepeated: boolean;

            //todo try to remove if possible, or modify for better use
            /**
             * why did i add this? bcoz linkInReader state is showing initial only in App.tsx
             */
            linkInReader: {
                type: "image" | "book" | "";
                link: string;
                page: number;
                chapter: string;
                /** for epub */
                chapterId?: string;
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

    //
    //

    type ShortcutCommands = (typeof SHORTCUT_COMMAND_MAP)[number]["command"];

    type ShortcutSchema = {
        command: ShortcutCommands;
        keys: string[];
    };
    type AppSettings = z.infer<typeof settingSchema>;
    type Color = Colorjs;

    //
    //
    //

    type Themes = { name: string; allData: ThemeData[] };
    /**
     * css variable names of theme
     */
    type ThemeDataMain = keyof typeof themeProps;
    type ThemeData = {
        name: string;
        main: {
            [e in ThemeDataMain]: string;
        };
    };
}
