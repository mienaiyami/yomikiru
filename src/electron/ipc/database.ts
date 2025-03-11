import { BrowserWindow, ipcMain } from "electron";
import type { DatabaseChangeChannels, DatabaseChannels } from "@common/types/ipc";
import { DatabaseService } from "../db";
import { bookBookmarks, bookNotes, bookProgress, libraryItems, mangaBookmarks, mangaProgress } from "../db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { BookProgress, LibraryItem, MangaProgress } from "@common/types/db";
import { ipc } from "./utils";
import { log } from "@electron/util";
import {
    AddBookBookmarkSchema,
    AddBookNoteSchema,
    AddMangaBookmarkSchema,
    AddToLibrarySchema,
    UpdateBookProgressSchema,
    UpdateMangaProgressSchema,
} from "@electron/db/validator";

/**
 * Sends database change notifications to all open windows
 * @param channel The database change channel
 * @param data The data to send
 */
const pingDatabaseChange = async <T extends keyof DatabaseChangeChannels>(
    channel: T,
    data: DatabaseChangeChannels[T]["request"],
) => {
    // todo: maybe send whole data on channel and then update store?
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
        if (!window.isDestroyed()) {
            try {
                // Use type assertion to resolve TypeScript error
                // This is safe because DatabaseChangeChannels should be part of MainToRendererChannels
                ipc.send(window.webContents, channel as any, data);
            } catch (error) {
                log.error(`Failed to send ${channel} notification to window:`, error);
            }
        }
    });
};

const handlers: {
    [K in keyof DatabaseChannels]: (
        db: DatabaseService,
        request: DatabaseChannels[K]["request"],
    ) => Promise<DatabaseChannels[K]["response"]>;
} = {
    "db:library:getItem": async (db, request) => {
        const [item] = await db.db.select().from(libraryItems).where(eq(libraryItems.link, request.link));
        return item;
    },
    "db:library:getAllAndProgress": async (db) => {
        const itemsWithProgress = await db.db
            .select({
                item: libraryItems,
                mangaProgress: mangaProgress,
                bookProgress: bookProgress,
            })
            .from(libraryItems)
            .leftJoin(mangaProgress, eq(libraryItems.link, mangaProgress.itemLink))
            .leftJoin(bookProgress, eq(libraryItems.link, bookProgress.itemLink))
            .orderBy(desc(mangaProgress.lastReadAt), desc(bookProgress.lastReadAt));
        return itemsWithProgress.map(({ item, bookProgress, mangaProgress }) => ({
            ...item,
            progress: mangaProgress || bookProgress,
        })) as (
            | (LibraryItem & { type: "book"; progress: BookProgress })
            | (LibraryItem & { type: "manga"; progress: MangaProgress })
        )[];
    },
    "db:library:addItem": async (db, request) => {
        const data = (await db.addLibraryItem(AddToLibrarySchema.parse(request))) ?? null;
        pingDatabaseChange("db:library:change", await handlers["db:library:getAllAndProgress"](db));
        return data;
    },
    "db:library:deleteItem": async (db, request) => {
        try {
            await db.db.delete(libraryItems).where(eq(libraryItems.link, request.link));
            pingDatabaseChange("db:library:change", await handlers["db:library:getAllAndProgress"](db));
            return true;
        } catch (error) {
            console.error(`Error in IPC channel "db:library:deleteItem":`, error);
            return false;
        }
    },
    "db:library:getAllBookmarks": async (db) => {
        const mangaBk = await db.db.select().from(mangaBookmarks);
        const bookBk = await db.db.select().from(bookBookmarks);
        return {
            mangaBookmarks: mangaBk,
            bookBookmarks: bookBk,
        };
    },
    "db:manga:getProgress": async (db, request) => {
        const [progress] = await db.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, request.itemLink));
        pingDatabaseChange("db:library:change", await handlers["db:library:getAllAndProgress"](db));
        return progress ?? null;
    },
    "db:manga:updateProgress": async (db, request) => {
        const data = (await db.updateMangaProgress(UpdateMangaProgressSchema.parse(request)))?.[0] ?? null;
        pingDatabaseChange("db:library:change", await handlers["db:library:getAllAndProgress"](db));
        return data;
    },
    "db:manga:updateChaptersRead": async (db, request) => {
        const data = await db.updateMangaChapterRead(request.itemLink, [request.chapterName], request.read);
        pingDatabaseChange("db:library:change", await handlers["db:library:getAllAndProgress"](db));
        return data;
    },
    "db:manga:updateChaptersReadAll": async (db, request) => {
        const data = await db.updateMangaChapterRead(request.itemLink, request.chapters, request.read);
        pingDatabaseChange("db:library:change", await handlers["db:library:getAllAndProgress"](db));
        return data;
    },
    "db:manga:getBookmarks": async (db, request) => {
        return await db.db.select().from(mangaBookmarks).where(eq(mangaBookmarks.itemLink, request.itemLink));
    },
    "db:manga:addBookmark": async (db, request) => {
        const data =
            (await db.db.insert(mangaBookmarks).values(AddMangaBookmarkSchema.parse(request)).returning())?.[0] ??
            null;
        if (data) pingDatabaseChange("db:bookmark:change", await handlers["db:library:getAllBookmarks"](db));
        return data;
    },
    "db:manga:deleteBookmarks": async (db, request) => {
        if (request.all) {
            await db.db.delete(mangaBookmarks).where(eq(mangaBookmarks.itemLink, request.itemLink));
            return true;
        }
        await db.db
            .delete(mangaBookmarks)
            .where(and(eq(mangaBookmarks.itemLink, request.itemLink), inArray(mangaBookmarks.id, request.ids)));

        pingDatabaseChange("db:bookmark:change", await handlers["db:library:getAllBookmarks"](db));
        return true;
    },
    "db:book:getProgress": async (db, request) => {
        const [item] = await db.db.select().from(bookProgress).where(eq(bookProgress.itemLink, request.itemLink));
        return item ?? null;
    },
    "db:book:updateProgress": async (db, request) => {
        const data = (await db.updateBookProgress(UpdateBookProgressSchema.parse(request)))?.[0];

        pingDatabaseChange("db:library:change", await handlers["db:library:getAllAndProgress"](db));
        return data;
    },
    "db:book:getBookmarks": async (db, request) => {
        return await db.db.select().from(bookBookmarks).where(eq(bookBookmarks.itemLink, request.itemLink));
    },
    // manually doing this makes sure no extra data is added to the db
    "db:book:addBookmark": async (db, request) => {
        const data =
            (await db.db.insert(bookBookmarks).values(AddBookBookmarkSchema.parse(request)).returning())?.[0] ??
            null;
        if (data) pingDatabaseChange("db:bookmark:change", await handlers["db:library:getAllBookmarks"](db));
        return data;
    },
    "db:book:deleteBookmarks": async (db, request) => {
        if (request.all) {
            await db.db.delete(bookBookmarks).where(eq(bookBookmarks.itemLink, request.itemLink));
            return true;
        }
        await db.db
            .delete(bookBookmarks)
            .where(and(eq(bookBookmarks.itemLink, request.itemLink), inArray(bookBookmarks.id, request.ids)));

        pingDatabaseChange("db:bookmark:change", await handlers["db:library:getAllBookmarks"](db));
        return true;
    },
    "db:book:getNotes": async (db, request) => {
        return await db.db.select().from(bookNotes).where(eq(bookNotes.itemLink, request.itemLink));
    },
    "db:book:addNote": async (db, request) => {
        await db.db.insert(bookNotes).values(AddBookNoteSchema.parse(request));
    },
    "db:book:deleteNotes": async (db, request) => {
        if (request.all) {
            await db.db.delete(bookNotes).where(eq(bookNotes.itemLink, request.itemLink));
            return true;
        }
        await db.db
            .delete(bookNotes)
            .where(and(eq(bookNotes.itemLink, request.itemLink), inArray(bookNotes.id, request.ids)));
        return true;
    },
    // "db:migrateFromJSON": async (db, request) => {
    //     await db.migrateFromJSON(request.historyData, request.bookmarkData);
    // },
};

export function setupDatabaseHandlers(db: DatabaseService) {
    for (const channel in handlers) {
        ipcMain.handle(channel, async (_, request) => {
            try {
                return await handlers[channel as keyof DatabaseChannels](db, request);
            } catch (error) {
                console.error(`Error in IPC channel "${channel}":`, error);
                throw error;
            }
        });
    }
}
