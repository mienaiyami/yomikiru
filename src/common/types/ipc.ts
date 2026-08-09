import type { I18nChangedPayload, I18nState, LanguageSource } from "@common/i18n";
import type { MainSettingsType } from "@electron/util/mainSettings";
import type {
    AddBookBookmarkData,
    AddBookNoteData,
    AddMangaBookmarkData,
    AddToLibraryData,
    BookBookmark,
    BookNote,
    BookProgress,
    LibraryItem,
    LibraryItemWithProgress,
    MangaBookmark,
    MangaProgress,
    UpdateBookBookmarkData,
    UpdateBookProgressData,
    UpdateLibraryItemData,
    UpdateMangaBookmarkData,
    UpdateMangaProgressData,
} from "./db";

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

/**
 * Shared result shape for all `covers:*` IPC channels and the main-process helpers that back them.
 */
export type CoverOpResult = { ok: true } | { ok: false; message: string };

export type CoverChannels = {
    "covers:materialize": ChannelDefinition<{ libraryId: number; sourceAbsolutePath: string }, CoverOpResult>;
    "covers:deleteForLibraryId": ChannelDefinition<{ libraryId: number }, CoverOpResult>;
    /** Removes all files under `userData/covers` and recreates the directory. */
    "covers:clearCache": ChannelDefinition<void, CoverOpResult>;
};

export type DatabaseChannels = {
    "db:library:getItem": ChannelDefinition<{ link: string }, LibraryItem | null>;
    "db:library:getAllAndProgress": ChannelDefinition<void, LibraryItemWithProgress[]>;
    "db:library:addItem": ChannelDefinition<AddToLibraryData, LibraryItem>;
    "db:library:updateItem": ChannelDefinition<UpdateLibraryItemData, LibraryItem | null>;
    "db:library:deleteItem": ChannelDefinition<{ link: string }, boolean>;
    /** Move a library item to a new disk path; updates FK `itemLink` columns. Returns null on conflict/missing. */
    "db:library:relocateItem": ChannelDefinition<{ oldLink: string; newLink: string }, LibraryItem | null>;
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
    "db:manga:updateBookmark": ChannelDefinition<UpdateMangaBookmarkData, MangaBookmark | null>;
    "db:manga:deleteBookmarks": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
    "db:book:getProgress": ChannelDefinition<{ itemLink: string }, BookProgress | null>;
    "db:book:updateProgress": ChannelDefinition<UpdateBookProgressData, BookProgress | null>;
    "db:book:getBookmarks": ChannelDefinition<{ itemLink: string }, BookBookmark[]>;
    "db:book:addBookmark": ChannelDefinition<AddBookBookmarkData, BookBookmark | null>;
    "db:book:updateBookmark": ChannelDefinition<UpdateBookBookmarkData, BookBookmark | null>;
    "db:book:deleteBookmarks": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;
    "db:book:getAllNotes": ChannelDefinition<void, BookNote[]>;
    "db:book:getNotes": ChannelDefinition<{ itemLink: string }, BookNote[]>;
    "db:book:addNote": ChannelDefinition<AddBookNoteData, BookNote | null>;
    "db:book:updateNote": ChannelDefinition<{ id: number; content: string; color?: string }, BookNote | null>;
    "db:book:deleteNotes": ChannelDefinition<{ itemLink: string; ids: number[]; all?: boolean }, boolean>;

    //
    "db:library:reset": ChannelDefinition<void, boolean>;
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
    "fs:fileChanged": ChannelDefinition<{ filePath: string; sourceWindowId?: number; ts: number }, void, "m2r">;
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
            cancelId?: number;
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

export type ErrorReportingChannels = {
    "error:report": ChannelDefinition<
        {
            error: string;
            stack?: string;
            context?: Record<string, unknown>;
            severity?: "low" | "medium" | "high" | "critical";
        },
        void
    >;
};

export type MainSettingsChannels = {
    "mainSettings:get": ChannelDefinition<void, MainSettingsType>;
    "mainSettings:update": ChannelDefinition<Partial<MainSettingsType>, void>;
    "mainSettings:sync": ChannelDefinition<MainSettingsType, void, "m2r">;
};

export type I18nChannels = {
    "i18n:getState": ChannelDefinition<void, I18nState>;
    "i18n:listSources": ChannelDefinition<void, LanguageSource[]>;
    "i18n:setSource": ChannelDefinition<{ sourceId: string }, I18nState>;
    "i18n:installPack": ChannelDefinition<
        { archivePath: string },
        { ok: true; source: LanguageSource } | { ok: false; message: string }
    >;
    "i18n:removePack": ChannelDefinition<{ packId: string }, { ok: true } | { ok: false; message: string }>;
    "i18n:exportPack": ChannelDefinition<
        { sourceId: string; destinationPath: string },
        { ok: true } | { ok: false; message: string }
    >;
    "i18n:changed": ChannelDefinition<I18nChangedPayload, void, "m2r">;
};

export type IPCChannels = DatabaseChannels &
    DatabaseChangeChannels &
    WindowManagementChannels &
    FileSystemChannels &
    UpdateChannels &
    ExplorerMenuChannels &
    ReaderChannels &
    DialogChannels &
    ErrorReportingChannels &
    MainSettingsChannels &
    CoverChannels &
    I18nChannels;

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
