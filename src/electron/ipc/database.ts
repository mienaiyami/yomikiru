import { ipcMain } from "electron";
import type { DatabaseChannels } from "@common/types/ipc";
import { DatabaseService } from "../db";
import { bookBookmarks, bookNotes, bookProgress, libraryItems, mangaBookmarks, mangaProgress } from "../db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { BookProgress, LibraryItem, MangaProgress } from "@common/types/db";

const handlers: {
    [K in keyof DatabaseChannels]: (
        db: DatabaseService,
        request: DatabaseChannels[K]["request"]
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
            .leftJoin(bookProgress, eq(libraryItems.link, bookProgress.itemLink));
        return itemsWithProgress.map(({ item, bookProgress, mangaProgress }) => ({
            ...item,
            progress: mangaProgress || bookProgress,
        })) as (
            | (LibraryItem & { type: "book"; progress: BookProgress })
            | (LibraryItem & { type: "manga"; progress: MangaProgress })
        )[];
    },
    "db:library:addItem": async (db, request) => {
        return (await db.addLibraryItem(request.data)) ?? null;
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
        return progress ?? null;
    },
    "db:manga:updateProgress": async (db, request) => {
        return (await db.updateMangaProgress(request.itemLink, request.data))?.[0] ?? null;
    },
    "db:manga:updateChaptersRead": async (db, request) => {
        return await db.updateMangaChapterRead(request.itemLink, [request.chapterName], request.read);
    },
    "db:manga:updateChaptersReadAll": async (db, request) => {
        return await db.updateMangaChapterRead(request.itemLink, request.chapters, request.read);
    },
    "db:manga:getBookmarks": async (db, request) => {
        return await db.db.select().from(mangaBookmarks).where(eq(mangaBookmarks.itemLink, request.itemLink));
    },
    "db:manga:addBookmark": async (db, request) => {
        const existing = await db.db
            .select()
            .from(mangaBookmarks)
            .where(and(eq(mangaBookmarks.link, request.link), eq(mangaBookmarks.page, request.page)));
        if (existing.length > 0) {
            return existing[0];
        }
        return (await db.db.insert(mangaBookmarks).values(request).returning())?.[0] ?? null;
    },
    "db:manga:deleteBookmarks": async (db, request) => {
        if (request.all) {
            await db.db.delete(mangaBookmarks).where(eq(mangaBookmarks.itemLink, request.itemLink));
            return true;
        }
        await db.db
            .delete(mangaBookmarks)
            .where(and(eq(mangaBookmarks.itemLink, request.itemLink), inArray(mangaBookmarks.id, request.ids)));
        return true;
    },
    "db:book:getProgress": async (db, request) => {
        const [item] = await db.db.select().from(bookProgress).where(eq(bookProgress.itemLink, request.itemLink));
        return item ?? null;
    },
    "db:book:updateProgress": async (db, request) => {
        return (await db.updateBookProgress(request.itemLink, request.data))?.[0];
    },
    "db:book:getBookmarks": async (db, request) => {
        return await db.db.select().from(bookBookmarks).where(eq(bookBookmarks.itemLink, request.itemLink));
    },
    "db:book:addBookmark": async (db, request) => {
        return (await db.db.insert(bookBookmarks).values(request).returning())?.[0] ?? null;
    },
    "db:book:deleteBookmarks": async (db, request) => {
        if (request.all) {
            await db.db.delete(bookBookmarks).where(eq(bookBookmarks.itemLink, request.itemLink));
            return true;
        }
        await db.db
            .delete(bookBookmarks)
            .where(and(eq(bookBookmarks.itemLink, request.itemLink), inArray(bookBookmarks.id, request.ids)));
        return true;
    },
    "db:book:getNotes": async (db, request) => {
        return await db.db.select().from(bookNotes).where(eq(bookNotes.itemLink, request.itemLink));
    },
    "db:book:addNote": async (db, request) => {
        await db.db.insert(bookNotes).values(request);
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
