import { ipcMain } from "electron";
import type { DatabaseChannels, IpcChannel } from "@common/types/ipc";
import { DatabaseService } from "../db";
import { electronOnly } from "../util";
import { bookBookmarks, bookNotes, bookProgress, libraryItems, mangaBookmarks, mangaProgress } from "../db/schema";
import { eq } from "drizzle-orm";

electronOnly();

// type Handler<T extends IpcChannel> = (
//     request: DatabaseChannels[T]["request"]
// ) => Promise<DatabaseChannels[T]["response"]>;

// function handle<T extends IpcChannel>(channel: T, handler: Handler<T>) {
//     ipcMain.handle(channel, async (_, request) => {
//         try {
//             return await handler(request);
//         } catch (error) {
//             console.error(`Error in IPC channel "${channel}":`, error);
//             throw error;
//         }
//     });
// }

const handlers = {
    "db:library:getItem": async (db, request) => {
        const [item] = await db.db.select().from(libraryItems).where(eq(libraryItems.link, request.link));
        return item;
    },
    "db:library:getWholeAndProgress": async (db, _) => {
        const itemsWithProgress = await db.db
            .select({
                item: libraryItems,
                mangaProgress,
                bookProgress,
            })
            .from(libraryItems)
            .leftJoin(mangaProgress, eq(libraryItems.link, mangaProgress.itemLink))
            .leftJoin(bookProgress, eq(libraryItems.link, bookProgress.itemLink));
        return itemsWithProgress;
    },
    "db:library:addItem": async (db, request) => {
        return await db.addLibraryItem(request.data, request.progress);
    },
    "db:manga:getProgress": async (db, request) => {
        const [progress] = await db.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, request.itemLink));
        return progress;
    },
    "db:manga:updateProgress": async (db, request) => {
        await db.updateMangaProgress(request.itemLink, request.data);
    },
    "db:manga:getBookmarks": async (db, request) => {
        return await db.db.select().from(mangaBookmarks).where(eq(mangaBookmarks.itemLink, request.itemLink));
    },
    "db:manga:addBookmark": async (db, request) => {
        return await db.db.insert(mangaBookmarks).values(request);
    },
    "db:book:getProgress": async (db, request) => {
        const [item] = await db.db.select().from(bookProgress).where(eq(bookProgress.itemLink, request.itemLink));
        return item;
    },
    "db:book:updateProgress": async (db, request) => {
        await db.updateBookProgress(request.itemLink, request.data);
    },
    "db:book:getBookmarks": async (db, request) => {
        return await db.db.select().from(bookBookmarks).where(eq(bookBookmarks.itemLink, request.itemLink));
    },
    "db:book:addBookmark": async (db, request) => {
        return await db.db.insert(bookBookmarks).values(request);
    },
    "db:book:getNotes": async (db, request) => {
        return await db.db.select().from(bookNotes).where(eq(bookNotes.itemLink, request.itemLink));
    },
    "db:book:addNote": async (db, request) => {
        return await db.db.insert(bookNotes).values(request);
    },
    "db:migrateFromJSON": async (db, request) => {
        await db.migrateFromJSON(request.historyData, request.bookmarkData);
    },
} satisfies {
    [K in IpcChannel]: (
        db: DatabaseService,
        request: DatabaseChannels[K]["request"]
    ) => Promise<DatabaseChannels[K]["response"]>;
};
export function setupDatabaseHandlers(db: DatabaseService) {
    for (const channel in handlers) {
        ipcMain.handle(channel, async (_, request) => {
            try {
                return await handlers[channel as IpcChannel](db, request);
            } catch (error) {
                console.error(`Error in IPC channel "${channel}":`, error);
                throw error;
            }
        });
    }
}
