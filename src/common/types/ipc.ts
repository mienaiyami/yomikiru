import type {
    LibraryItem,
    MangaProgress,
    BookProgress,
    MangaBookmark,
    BookBookmark,
    BookNote,
    LibraryItemWithProgress,
} from "./db";
import { AddToLibraryData } from "@electron/db";

/**
 * m2r: main to renderer
 * r2m: renderer to main
 */
type ChannelDefinition<Req = unknown, Res = unknown, Dir extends "m2r" | "r2m" = "r2m"> = {
    request: Req;
    response: Res;
    direction: Dir;
    // [K: string]: K extends "request" | "response" ? any : never;
};

// todo: move types beside their implementation as .d.ts

export type DatabaseChannels = {
    "db:library:getItem": ChannelDefinition<{ link: string }, LibraryItem | null>;
    "db:library:getAllAndProgress": ChannelDefinition<void, LibraryItemWithProgress[]>;
    "db:library:addItem": ChannelDefinition<AddToLibraryData, LibraryItem>;
    "db:library:deleteItem": ChannelDefinition<{ link: string }, boolean>;
    "db:library:getAllBookmarks": ChannelDefinition<
        void,
        {
            mangaBookmarks: MangaBookmark[];
            bookBookmarks: BookBookmark[];
        }
    >;
    "db:manga:getProgress": ChannelDefinition<{ itemLink: string }, MangaProgress | null>;
    "db:manga:updateProgress": ChannelDefinition<
        {
            itemLink: string;
            chapterName?: string;
            chapterLink?: string;
            currentPage?: number;
            chaptersRead?: string[];
            lastReadAt?: Date;
            totalPages?: number;
        },
        MangaProgress | null
    >;
    "db:manga:updateChaptersRead": ChannelDefinition<
        { itemLink: string; chapterName: string; read: boolean },
        string[]
    >;
    "db:manga:updateChaptersReadAll": ChannelDefinition<
        { itemLink: string; chapters: string[]; read: boolean },
        string[]
    >;
    "db:manga:getBookmarks": ChannelDefinition<{ itemLink: string }, MangaBookmark[]>;
    "db:manga:addBookmark": ChannelDefinition<
        {
            itemLink: string;
            page: number;
            link: string;
            note?: string;
        },
        MangaBookmark | null
    >;
    "db:manga:deleteBookmarks": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
    "db:book:getProgress": ChannelDefinition<{ itemLink: string }, BookProgress | null>;
    "db:book:updateProgress": ChannelDefinition<
        {
            itemLink: string;
            data: {
                chapterId?: string;
                chapterName?: string;
                position?: string;
                lastReadAt?: Date;
            };
        },
        BookProgress | null
    >;
    "db:book:getBookmarks": ChannelDefinition<{ itemLink: string }, BookBookmark[]>;
    "db:book:addBookmark": ChannelDefinition<
        {
            itemLink: string;
            chapterId: string;
            position: string;
            title: string;
            note?: string;
        },
        BookBookmark | null
    >;
    "db:book:deleteBookmarks": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
    "db:book:getNotes": ChannelDefinition<{ itemLink: string }, BookNote[]>;
    "db:book:addNote": ChannelDefinition<
        {
            itemLink: string;
            chapterId: string;
            position: string;
            content: string;
            selectedText: string;
            color: string;
        },
        void
    >;
    "db:book:deleteNotes": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
};

// ! for updating store only, temp only
export type DatabaseChangeChannels = {
    "db:library:change": ChannelDefinition<
        (
            | (LibraryItem & { type: "book"; progress: BookProgress | null })
            | (LibraryItem & { type: "manga"; progress: MangaProgress | null })
        )[],
        void,
        "m2r"
    >;
    "db:bookmark:change": ChannelDefinition<
        {
            mangaBookmarks: MangaBookmark[];
            bookBookmarks: BookBookmark[];
        },
        void,
        "m2r"
    >;
};

export type WindowManagementChannels = {
    "window:openLinkInNewWindow": ChannelDefinition<string, void>;
    "window:destroy": ChannelDefinition<void, void>;
    // "window:askBeforeClose": ChannelDefinition<boolean, void>;
    "window:askBeforeClose:query": ChannelDefinition<void, void, "m2r">;
    "window:askBeforeClose:response": ChannelDefinition<boolean, void, "r2m">;
    "window:addDirToDelete": ChannelDefinition<string, void>;
};

export type FileSystemChannels = {
    "fs:changeTempPath": ChannelDefinition<string, void>;
    "fs:unzip": ChannelDefinition<
        { source: string; destination: string },
        | { source: string; destination: string; ok: true }
        | {
              ok: false;
              message: string;
          }
    >;
    "fs:showInExplorer": ChannelDefinition<string, void>;
    "fs:saveFile": ChannelDefinition<{ filePath: string; data: string }, void>;
};

export type UpdateChannels = {
    "update:check:manual": ChannelDefinition<
        {
            promptAfterCheck?: boolean;
        },
        void
    >;
    // from main to renderer, update check on interval settings is on
    "update:check:query": ChannelDefinition<void, void, "m2r">;
    "update:check:response": ChannelDefinition<
        {
            enabled: boolean;
            skipMinor: boolean;
            autoDownload: boolean;
        },
        void
    >;
};

export type ExplorerMenuChannels = {
    "explorer:addOption": ChannelDefinition<void, boolean>;
    "explorer:removeOption": ChannelDefinition<void, boolean>;
    "explorer:addOption:epub": ChannelDefinition<void, boolean>;
    "explorer:removeOption:epub": ChannelDefinition<void, boolean>;
};

export type ReaderChannels = {
    "reader:loadLink": ChannelDefinition<{ link: string }, void, "m2r">;
    "reader:recordPage": ChannelDefinition<void, void, "m2r">;
};

export type DialogChannels = {
    "dialog:error": ChannelDefinition<
        {
            title?: string;
            message: string;
            detail?: string;
            log?: boolean;
        },
        Electron.MessageBoxReturnValue
    >;

    "dialog:warn": ChannelDefinition<
        {
            title?: string;
            message: string;
            detail?: string;
            noOption?: boolean;
            buttons?: string[];
            defaultId?: number;
        },
        Electron.MessageBoxReturnValue
    >;

    "dialog:confirm": ChannelDefinition<
        {
            title?: string;
            message: string;
            detail?: string;
            noOption?: boolean;
            buttons?: string[];
            defaultId?: number;
            cancelId?: number;
            checkboxLabel?: string;
            type?: "info" | "warning" | "error" | "question";
            noLink?: boolean;
        },
        Electron.MessageBoxReturnValue
    >;

    "dialog:nodeError": ChannelDefinition<
        {
            name: string;
            errno: number | undefined;
            message: string;
        },
        Electron.MessageBoxReturnValue
    >;

    "dialog:showOpenDialog": ChannelDefinition<Electron.OpenDialogOptions, Electron.OpenDialogReturnValue>;
    "dialog:showSaveDialog": ChannelDefinition<Electron.SaveDialogOptions, Electron.SaveDialogReturnValue>;
};

export type IPCChannels = DatabaseChannels &
    DatabaseChangeChannels &
    WindowManagementChannels &
    FileSystemChannels &
    UpdateChannels &
    ExplorerMenuChannels &
    ReaderChannels &
    DialogChannels;

export type MainToRendererChannels = {
    [K in keyof IPCChannels as IPCChannels[K] extends ChannelDefinition<unknown, unknown, "m2r">
        ? K
        : never]: IPCChannels[K];
};

export type RendererToMainChannels = {
    [K in keyof IPCChannels as IPCChannels[K] extends ChannelDefinition<unknown, unknown, "r2m">
        ? K
        : never]: IPCChannels[K];
};
