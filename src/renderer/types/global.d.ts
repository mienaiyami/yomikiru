import Colorjs from "color";
import { settingSchema } from "../utils/settingsSchema";
import { SHORTCUT_COMMAND_MAP } from "../utils/keybindings";
import { z } from "zod";
import { themeProps } from "../utils/theme";
import { addBookmark } from "../store/bookmarks";

declare module "react" {
    interface CSSProperties {
        [key: `--${string}`]: string | number;
    }
}

declare global {
    interface Window {
        contextMenu: {
            fakeEvent: (
                elem: HTMLElement | { posX: number; posY: number },
                focusBackElem?: HTMLElement | null,
            ) => MouseEvent;
            template: {
                divider: () => Menu.ListItem;
                open: (url: string) => Menu.ListItem;
                openInNewWindow: (url: string) => Menu.ListItem;
                showInExplorer: (url: string) => Menu.ListItem;
                copyPath: (url: string) => Menu.ListItem;
                copyImage: (url: string) => Menu.ListItem;
                addToBookmark: (args: Parameters<typeof addBookmark>["0"]) => Menu.ListItem;
                removeHistory: (url: string) => Menu.ListItem;
                removeBookmark: (itemLink: string, bookmarkId: number, type: "manga" | "book") => Menu.ListItem;
                unreadChapter: (itemLink: string, chapterName: string) => Menu.ListItem;
                unreadAllChapter: (itemLink: string) => Menu.ListItem;
                readChapter: (itemLink: string, chapterName: string) => Menu.ListItem;
                readAllChapter: (itemLink: string, chapterNames: string[]) => Menu.ListItem;
            };
        };
        app: {
            betterSortOrder: (x: string, y: string) => number;
            /**
             * temp dir to be removed after closing chapter which was extracted
             */
            deleteDirOnClose: string;
            titleBarHeight: number;
            // todo remove
            // isReaderOpen: boolean;
            clickDelay: number;
            lastClick: number;
            scrollToPage: (
                pageNumber_or_percent: number,
                behavior?: ScrollBehavior,
                callback?: () => void,
            ) => void;
            keyRepeated: boolean;

            //todo try to remove if possible, or modify for better use
            /**
             * why did i add this? bcoz linkInReader state is showing initial only in App.tsx
             */
            // linkInReader: {
            //     type: "image" | "book" | "";
            //     link: string;
            //     page: number;
            //     chapter: string;
            //     /** for epub */
            //     chapterId?: string;
            //     /**
            //      * elem query string for epub auto scroll
            //      */
            //     queryStr?: string;
            // };

            // to remove later
            keydown: boolean;
        };
        /**
         * TODO: refactor
         * @deprecated
         */
        cachedImageList: { link: string; images: string[] };
        temp: unknown;
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
