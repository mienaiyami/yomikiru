import type {
    LibraryItem,
    MangaProgress,
    BookProgress,
    MangaBookmark,
    BookBookmark,
    BookNote,
    LibraryItemWithProgress,
    AddToLibraryData,
    AddMangaBookmarkData,
    AddBookBookmarkData,
    UpdateBookProgressData,
    UpdateMangaProgressData,
    AddBookNoteData,
} from "./db";
import type { MainSettingsType } from "@electron/util/mainSettings";

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
    "db:manga:updateProgress": ChannelDefinition<UpdateMangaProgressData, MangaProgress | null>;
    "db:manga:updateChaptersRead": ChannelDefinition<
        { itemLink: string; chapterName: string; read: boolean },
        string[]
    >;
    "db:manga:updateChaptersReadAll": ChannelDefinition<
        { itemLink: string; chapters: string[]; read: boolean },
        string[]
    >;
    "db:manga:getBookmarks": ChannelDefinition<{ itemLink: string }, MangaBookmark[]>;
    "db:manga:addBookmark": ChannelDefinition<AddMangaBookmarkData, MangaBookmark | null>;
    "db:manga:deleteBookmarks": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
    "db:book:getProgress": ChannelDefinition<{ itemLink: string }, BookProgress | null>;
    "db:book:updateProgress": ChannelDefinition<UpdateBookProgressData, BookProgress | null>;
    "db:book:getBookmarks": ChannelDefinition<{ itemLink: string }, BookBookmark[]>;
    "db:book:addBookmark": ChannelDefinition<AddBookBookmarkData, BookBookmark | null>;
    "db:book:deleteBookmarks": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
    "db:book:getAllNotes": ChannelDefinition<void, BookNote[]>;
    "db:book:getNotes": ChannelDefinition<{ itemLink: string }, BookNote[]>;
    "db:book:addNote": ChannelDefinition<AddBookNoteData, BookNote | null>;
    "db:book:updateNote": ChannelDefinition<{ id: number; content: string; color?: string }, BookNote | null>;
    "db:book:deleteNotes": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
};

// ! for updating store only, temp only
export type DatabaseChangeChannels = {
    "db:library:change": ChannelDefinition<void, void, "m2r">;
    "db:bookmark:change": ChannelDefinition<void, void, "m2r">;
    "db:bookNote:change": ChannelDefinition<void, void, "m2r">;
};

export type WindowManagementChannels = {
    "window:openLinkInNewWindow": ChannelDefinition<string, void>;
    "window:destroy": ChannelDefinition<void, void>;
    "window:addDirToDelete": ChannelDefinition<string, void>;
    /**
     * for checking if window opened and loaded App without crashing
     */
    "window:statusCheck": ChannelDefinition<void, void, "m2r">;
    "window:statusCheck:response": ChannelDefinition<void, void, "r2m">;
};

export type FileSystemChannels = {
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

export type AppUpdateChannel = "stable" | "beta";

export type UpdateChannels = {
    "update:check:manual": ChannelDefinition<
        {
            promptAfterCheck?: boolean;
            channel?: AppUpdateChannel;
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

export type MainSettingsChannels = {
    "mainSettings:get": ChannelDefinition<void, MainSettingsType>;
    "mainSettings:update": ChannelDefinition<Partial<MainSettingsType>, MainSettingsType>;
};

export type IPCChannels = DatabaseChannels &
    DatabaseChangeChannels &
    WindowManagementChannels &
    FileSystemChannels &
    UpdateChannels &
    ExplorerMenuChannels &
    ReaderChannels &
    DialogChannels &
    MainSettingsChannels;

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
