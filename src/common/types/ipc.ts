import { InferInsertModel } from "drizzle-orm";
import type { LibraryItem, MangaProgress, BookProgress, MangaBookmark, BookBookmark, BookNote } from "./db";
import type { HistoryItem, Manga_BookItem } from "./legacy";
import { libraryItems } from "../../electron/db/schema";

// must include
const DatabaseChannelsNames = [
    "db:library:getItem",
    "db:library:getWholeAndProgress",
    "db:library:addItem",
    "db:manga:getProgress",
    "db:manga:updateProgress",
    "db:manga:addBookmark",
    "db:manga:getBookmarks",
    "db:book:getProgress",
    "db:book:updateProgress",
    "db:book:getBookmarks",
    "db:book:addBookmark",
    "db:book:getNotes",
    "db:book:addNote",
    "db:migrateFromJSON",
] as const;

// todo: move all ipc to this file

export type DatabaseChannels = {
    "db:library:getItem": {
        request: { link: string };
        response: LibraryItem | null;
    };
    "db:library:getWholeAndProgress": {
        request: void;
        response: {
            item: LibraryItem;
            mangaProgress: MangaProgress | null;
            bookProgress: BookProgress | null;
        }[];
    };
    "db:library:addItem": {
        request: {
            data: Omit<InferInsertModel<typeof libraryItems>, "createdAt" | "updatedAt">;
            progress: {
                chapterLink: string;
                totalPages: number;
                currentPage?: number;
            };
        };
        response: LibraryItem;
    };

    "db:manga:getProgress": {
        request: { itemLink: string };
        response: MangaProgress | null;
    };
    "db:manga:updateProgress": {
        request: {
            itemLink: string;
            data: {
                chapterName: string;
                chapterLink: string;
                currentPage: number;
                chaptersRead: string[];
                lastReadAt: Date;
                totalPages?: number;
            };
        };
        response: void;
    };
    "db:manga:getBookmarks": {
        request: { itemLink: string };
        response: MangaBookmark[];
    };
    "db:manga:addBookmark": {
        request: {
            itemLink: string;
            page: number;
            link: string;
            note?: string;
        };
        response: MangaBookmark;
    };
    "db:book:getProgress": {
        request: { itemLink: string };
        response: BookProgress | null;
    };
    "db:book:updateProgress": {
        request: {
            itemLink: string;
            data: {
                chapterId: string;
                chapterName: string;
                position: string;
                lastReadAt: Date;
            };
        };
        response: void;
    };

    "db:book:getBookmarks": {
        request: { itemLink: string };
        response: BookBookmark[];
    };
    "db:book:addBookmark": {
        request: {
            itemLink: string;
            chapterId: string;
            position: string;
            title: string;
            note?: string;
        };
        response: BookBookmark;
    };

    "db:book:getNotes": {
        request: { itemLink: string };
        response: BookNote[];
    };
    "db:book:addNote": {
        request: {
            itemLink: string;
            chapterId: string;
            position: string;
            content: string;
            selectedText: string;
            color: string;
        };
        response: BookNote;
    };

    "db:migrateFromJSON": {
        request: {
            historyData: HistoryItem[];
            bookmarkData: Manga_BookItem[];
        };
        response: void;
    };
};
type VerifyChannels = (typeof DatabaseChannelsNames)[number] extends keyof DatabaseChannels
    ? keyof DatabaseChannels extends (typeof DatabaseChannelsNames)[number]
        ? true
        : never
    : never;
type Assert<T extends true> = T;
type _Check = Assert<VerifyChannels>;
// DatabaseChannels must include all DatabaseChannelsNames
const _check: _Check = true;

export type IpcChannel = keyof DatabaseChannels;
