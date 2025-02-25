import { InferInsertModel } from "drizzle-orm";
import type { LibraryItem, MangaProgress, BookProgress, MangaBookmark, BookBookmark, BookNote } from "./db";
import { libraryItems } from "../../electron/db/schema";

// must include
// export const DatabaseChannelsNames = [
//     "db:library:getItem",
//     "db:library:getAllAndProgress",
//     "db:library:addItem",
//     "db:library:getAllBookmarks",
//     "db:manga:getProgress",
//     "db:manga:updateProgress",
//     "db:manga:updateChaptersRead",
//     "db:manga:updateChaptersReadAll",
//     "db:manga:addBookmark",
//     "db:manga:getBookmarks",
//     "db:manga:deleteBookmarks",
//     // "db:manga:getAllBookmarks",
//     "db:book:getProgress",
//     "db:book:updateProgress",
//     "db:book:getBookmarks",
//     "db:book:addBookmark",
//     "db:book:deleteBookmarks",
//     // "db:book:getAllBookmarks",
//     "db:book:getNotes",
//     "db:book:addNote",
//     "db:book:deleteNotes",
//     // doing this on main process
//     // "db:migrateFromJSON",
// ] as const;

// todo: move all ipc to this file

export type DatabaseChannels = {
    "db:library:getItem": {
        request: { link: string };
        response: LibraryItem | null;
    };
    "db:library:getAllAndProgress": {
        request: void;
        response: (
            | (LibraryItem & { type: "book"; progress: BookProgress })
            | (LibraryItem & { type: "manga"; progress: MangaProgress })
        )[];
    };
    "db:library:addItem": {
        request: {
            data: Omit<InferInsertModel<typeof libraryItems>, "createdAt" | "updatedAt">;
            // progress: {
            //     chapterLink: string;
            //     totalPages: number;
            //     currentPage?: number;
            // };
        };
        response: LibraryItem;
    };
    "db:library:getAllBookmarks": {
        request: void;
        response: {
            mangaBookmarks: MangaBookmark[];
            bookBookmarks: BookBookmark[];
        };
        // response: ((MangaBookmark & { type: "manga" }) | (BookBookmark & { type: "book" }))[];
    };
    "db:manga:getProgress": {
        request: { itemLink: string };
        response: MangaProgress | null;
    };
    "db:manga:updateProgress": {
        request: {
            itemLink: string;
            data: {
                chapterName?: string;
                chapterLink?: string;
                currentPage?: number;
                chaptersRead?: string[];
                lastReadAt?: Date;
                totalPages?: number;
            };
        };
        response: MangaProgress | null;
    };
    "db:manga:updateChaptersRead": {
        request: { itemLink: string; chapterName: string; read: boolean };
        response: string[];
    };
    "db:manga:updateChaptersReadAll": {
        // pass empty chapters to unmark all chapters
        request: { itemLink: string; chapters: string[]; read: boolean };
        response: string[];
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
        response: MangaBookmark | null;
    };
    "db:manga:deleteBookmarks": {
        request: { itemLink: string; ids: number[]; all?: boolean };
        response: boolean;
    };
    "db:book:getProgress": {
        request: { itemLink: string };
        response: BookProgress | null;
    };
    "db:book:updateProgress": {
        request: {
            itemLink: string;
            data: {
                chapterId?: string;
                chapterName?: string;
                position?: string;
                lastReadAt?: Date;
            };
        };
        response: BookProgress | null;
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
        response: BookBookmark | null;
    };
    "db:book:deleteBookmarks": {
        request: { itemLink: string; ids: number[]; all?: boolean };
        response: boolean;
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
        response: void;
    };
    "db:book:deleteNotes": {
        request: { itemLink: string; ids: number[]; all?: boolean };
        response: boolean;
        // asd: 123;
    };

    // "db:migrateFromJSON": {
    //     request: {
    //         historyData: HistoryItem[];
    //         bookmarkData: Manga_BookItem[];
    //     };
    //     response: void;
    // };
};
// type MissingChannels = Exclude<(typeof DatabaseChannelsNames)[number], keyof DatabaseChannels>;
// type ExtraChannels = Exclude<keyof DatabaseChannels, (typeof DatabaseChannelsNames)[number]>;

// type AssertChannels<Missing extends string, Extra extends string> = [Missing] extends [never]
//     ? [Extra] extends [never]
//         ? true
//         : `Extra : ${Extra}`
//     : `Missing : ${Missing}`;

// type _Check = AssertChannels<MissingChannels, ExtraChannels>;
// const _check: _Check = true as _Check;

export type IpcChannel = keyof DatabaseChannels;
