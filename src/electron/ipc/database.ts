import fs from "node:fs";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import type { LibraryItemWithProgress } from "@common/types/db";
import type { DatabaseChangeChannels, DatabaseChannels } from "@common/types/ipc";
import {
    AddBookBookmarkSchema,
    AddBookNoteSchema,
    AddMangaBookmarkSchema,
    AddToLibrarySchema,
    CreateLibraryTagSchema,
    DeleteLibraryTagSchema,
    RelocateLibraryItemSchema,
    RemoveItemTrackerSchema,
    SetLibraryItemMetadataSchema,
    SetLibraryItemTagsSchema,
    UpdateBookBookmarkSchema,
    UpdateBookProgressSchema,
    UpdateLibraryItemSchema,
    UpdateLibraryTagSchema,
    UpdateMangaBookmarkSchema,
    UpdateMangaProgressSchema,
    UpdateTrackerSnapshotSchema,
    UpsertItemTrackerSchema,
} from "@electron/db/validator";
import { createMainLogger } from "@electron/util/logger";
import { and, desc, eq, inArray } from "drizzle-orm";
import { app, BrowserWindow, ipcMain } from "electron";
import { type DatabaseService, DB_PATH } from "../db";
import {
    bookBookmarks,
    bookNotes,
    bookProgress,
    itemTrackers,
    libraryItemMetadata,
    libraryItems,
    libraryItemTags,
    libraryTags,
    mangaBookmarks,
    mangaProgress,
} from "../db/schema";
import { ipc } from "./utils";

const logger = createMainLogger("ipc/database");

/**
 * Copies own enumerable keys whose value is not `undefined`. Used so drizzle `.set()`
 * never receives omitted optional fields (which would be written as NULL).
 */
const omitUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
    const out: Partial<T> = {};
    for (const key of Object.keys(obj) as (keyof T)[]) {
        if (obj[key] !== undefined) out[key] = obj[key];
    }
    return out;
};

/** SQLite unique / FK failures from better-sqlite3 (`SQLITE_CONSTRAINT_*`). */
const isSqliteConstraintError = (err: unknown): boolean =>
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    String((err as { code: unknown }).code).startsWith("SQLITE_CONSTRAINT");

/**
 * Sends database change notifications to all open windows
 * @param channel The database change channel
 * @param data The data to send
 */
export const pingDatabaseChange = async <T extends keyof DatabaseChangeChannels>(
    channel: T,
    // data: DatabaseChangeChannels[T]["request"],
): Promise<void> => {
    // todo: maybe send whole data on channel and then update store?
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
        if (!window.isDestroyed()) {
            try {
                // Use type assertion to resolve TypeScript error
                // This is safe because DatabaseChangeChannels should be part of MainToRendererChannels
                ipc.send(window.webContents, channel as any);
            } catch (error) {
                logger.error(`Could not broadcast DB change "${String(channel)}" to a window`, error);
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
            progress: item.type === "book" ? bookProgress : mangaProgress,
        })) as LibraryItemWithProgress[];
    },
    "db:library:addItem": async (db, request) => {
        const data = (await db.addLibraryItem(AddToLibrarySchema.parse(request))) ?? null;
        pingDatabaseChange("db:library:change");
        return data;
    },
    "db:library:updateItem": async (db, request) => {
        const { link, ...fields } = UpdateLibraryItemSchema.parse(request);
        const patch = omitUndefined(fields);
        if (Object.keys(patch).length === 0) {
            const [existing] = await db.db.select().from(libraryItems).where(eq(libraryItems.link, link));
            return existing ?? null;
        }
        const data = await db.db.update(libraryItems).set(patch).where(eq(libraryItems.link, link)).returning();

        pingDatabaseChange("db:library:change");
        return data?.[0] ?? null;
    },
    "db:library:deleteItem": async ({ db }, request) => {
        try {
            const [row] = await db.select().from(libraryItems).where(eq(libraryItems.link, request.link));
            if (row?.id != null) {
                const coverFile = path.join(app.getPath("userData"), "covers", `${row.id}.webp`);
                try {
                    if (fs.existsSync(coverFile)) fs.unlinkSync(coverFile);
                } catch (err) {
                    logger.warn(`"db:library:deleteItem": could not remove cover file for id=${row.id}`, err);
                }
            }
            await db.delete(libraryItems).where(eq(libraryItems.link, request.link));
            pingDatabaseChange("db:library:change");
            pingDatabaseChange("db:bookmark:change");
            pingDatabaseChange("db:bookNote:change");
            pingDatabaseChange("db:tracker:change");
            pingDatabaseChange("db:tag:change");
            return true;
        } catch (error) {
            logger.error('"db:library:deleteItem": delete failed', error);
            return false;
        }
    },
    "db:library:relocateItem": async (db, request) => {
        try {
            const { oldLink, newLink } = RelocateLibraryItemSchema.parse(request);
            const item = await db.relocateLibraryItem(oldLink, newLink);
            if (!item) return null;
            pingDatabaseChange("db:library:change");
            pingDatabaseChange("db:bookmark:change");
            pingDatabaseChange("db:bookNote:change");
            pingDatabaseChange("db:tracker:change");
            pingDatabaseChange("db:tag:change");
            return item;
        } catch (error) {
            logger.error('"db:library:relocateItem": relocate failed', error);
            return null;
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
    "db:library:reset": async (db) => {
        try {
            const backupPath = path.join(app.getPath("userData"), `data_backup-${Date.now()}.db`);
            await copyFile(DB_PATH, backupPath);
            // cascade delete
            await db.db.delete(libraryItems);
            return true;
        } catch (err) {
            logger.error('"db:library:reset": backup or delete failed', err);
            return false;
        }
    },
    "db:manga:getProgress": async (db, request) => {
        const [progress] = await db.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, request.itemLink));
        return progress ?? null;
    },
    "db:manga:updateProgress": async (db, request) => {
        const data = (await db.updateMangaProgress(UpdateMangaProgressSchema.parse(request)))?.[0] ?? null;
        pingDatabaseChange("db:library:change");
        return data;
    },
    "db:manga:updateChaptersRead": async (db, request) => {
        const data = await db.updateMangaChapterRead(request.itemLink, [request.chapterName], request.read);
        pingDatabaseChange("db:library:change");
        return data;
    },
    "db:manga:updateChaptersReadAll": async (db, request) => {
        const data = await db.updateMangaChapterRead(request.itemLink, request.chapters, request.read);
        pingDatabaseChange("db:library:change");
        return data;
    },
    "db:manga:getBookmarks": async (db, request) => {
        return await db.db.select().from(mangaBookmarks).where(eq(mangaBookmarks.itemLink, request.itemLink));
    },
    "db:manga:addBookmark": async (db, request) => {
        const data =
            (await db.db.insert(mangaBookmarks).values(AddMangaBookmarkSchema.parse(request)).returning())?.[0] ??
            null;
        if (data) pingDatabaseChange("db:bookmark:change");
        return data;
    },
    "db:manga:updateBookmark": async (db, request) => {
        const { id, ...patch } = UpdateMangaBookmarkSchema.parse(request);
        const data =
            (await db.db.update(mangaBookmarks).set(patch).where(eq(mangaBookmarks.id, id)).returning())?.[0] ??
            null;
        if (data) pingDatabaseChange("db:bookmark:change");
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

        pingDatabaseChange("db:bookmark:change");
        return true;
    },
    "db:book:getProgress": async (db, request) => {
        const [item] = await db.db.select().from(bookProgress).where(eq(bookProgress.itemLink, request.itemLink));
        return item ?? null;
    },
    "db:book:updateProgress": async (db, request) => {
        const data = (await db.updateBookProgress(UpdateBookProgressSchema.parse(request)))?.[0];

        pingDatabaseChange("db:library:change");
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
        if (data) pingDatabaseChange("db:bookmark:change");
        return data;
    },
    "db:book:updateBookmark": async (db, request) => {
        const { id, ...patch } = UpdateBookBookmarkSchema.parse(request);
        const data =
            (await db.db.update(bookBookmarks).set(patch).where(eq(bookBookmarks.id, id)).returning())?.[0] ??
            null;
        if (data) pingDatabaseChange("db:bookmark:change");
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

        pingDatabaseChange("db:bookmark:change");
        return true;
    },
    "db:book:getAllNotes": async (db) => {
        return (await db.db.select().from(bookNotes)) || [];
    },
    "db:book:getNotes": async (db, request) => {
        return await db.db.select().from(bookNotes).where(eq(bookNotes.itemLink, request.itemLink));
    },
    "db:book:addNote": async (db, request) => {
        const data =
            (await db.db.insert(bookNotes).values(AddBookNoteSchema.parse(request)).returning())?.[0] ?? null;
        pingDatabaseChange("db:bookNote:change");
        return data;
    },
    "db:book:updateNote": async (db, request) => {
        const data = await db.db
            .update(bookNotes)
            .set({ content: request.content, color: request.color })
            .where(eq(bookNotes.id, request.id))
            .returning();
        pingDatabaseChange("db:bookNote:change");
        return data?.[0] ?? null;
    },
    "db:book:deleteNotes": async (db, request) => {
        if (request.all) {
            await db.db.delete(bookNotes).where(eq(bookNotes.itemLink, request.itemLink));
            return true;
        }
        await db.db
            .delete(bookNotes)
            .where(and(eq(bookNotes.itemLink, request.itemLink), inArray(bookNotes.id, request.ids)));
        pingDatabaseChange("db:bookNote:change");
        return true;
    },
    "db:trackers:getAll": async (db) => {
        return await db.db.select().from(itemTrackers);
    },
    "db:trackers:upsert": async (db, request) => {
        const parsed = UpsertItemTrackerSchema.parse(request);
        const { itemLink, provider, remoteId, ...optional } = parsed;
        const patch = omitUndefined({ remoteId, ...optional });
        const [row] = await db.db
            .insert(itemTrackers)
            .values(parsed)
            .onConflictDoUpdate({
                target: [itemTrackers.itemLink, itemTrackers.provider],
                set: patch,
            })
            .returning();
        if (row) pingDatabaseChange("db:tracker:change");
        return row ?? null;
    },
    "db:trackers:remove": async (db, request) => {
        const { itemLink, provider } = RemoveItemTrackerSchema.parse(request);
        await db.db
            .delete(itemTrackers)
            .where(and(eq(itemTrackers.itemLink, itemLink), eq(itemTrackers.provider, provider)));
        pingDatabaseChange("db:tracker:change");
        return true;
    },
    "db:trackers:updateSnapshot": async (db, request) => {
        const { itemLink, provider, ...fields } = UpdateTrackerSnapshotSchema.parse(request);
        const patch = omitUndefined(fields);
        if (Object.keys(patch).length === 0) {
            const [existing] = await db.db
                .select()
                .from(itemTrackers)
                .where(and(eq(itemTrackers.itemLink, itemLink), eq(itemTrackers.provider, provider)));
            return existing ?? null;
        }
        const [row] = await db.db
            .update(itemTrackers)
            .set(patch)
            .where(and(eq(itemTrackers.itemLink, itemLink), eq(itemTrackers.provider, provider)))
            .returning();
        if (row) pingDatabaseChange("db:tracker:change");
        return row ?? null;
    },
    "db:library:getAllMetadata": async (db) => {
        return await db.db.select().from(libraryItemMetadata);
    },
    "db:library:setMetadata": async (db, request) => {
        const parsed = SetLibraryItemMetadataSchema.parse(request);
        const { itemLink, source, ...fields } = parsed;
        const patch = omitUndefined(fields);
        const [row] = await db.db
            .insert(libraryItemMetadata)
            .values({ itemLink, source, ...patch })
            .onConflictDoUpdate({
                target: [libraryItemMetadata.itemLink, libraryItemMetadata.source],
                set: Object.keys(patch).length > 0 ? patch : { source },
            })
            .returning();
        if (row) pingDatabaseChange("db:library:change");
        return row ?? null;
    },
    "db:tags:getAll": async (db) => {
        return await db.db.select().from(libraryTags);
    },
    "db:tags:create": async (db, request) => {
        const parsed = CreateLibraryTagSchema.parse(request);
        try {
            const [row] = await db.db.insert(libraryTags).values(parsed).returning();
            if (row) pingDatabaseChange("db:tag:change");
            return row ?? null;
        } catch (error) {
            if (isSqliteConstraintError(error)) {
                logger.warn("db:tags:create: constraint failed", { name: parsed.name }, error);
                return null;
            }
            throw error;
        }
    },
    "db:tags:update": async (db, request) => {
        const { id, ...fields } = UpdateLibraryTagSchema.parse(request);
        const patch = omitUndefined(fields);
        try {
            const [row] = await db.db.update(libraryTags).set(patch).where(eq(libraryTags.id, id)).returning();
            if (row) pingDatabaseChange("db:tag:change");
            return row ?? null;
        } catch (error) {
            if (isSqliteConstraintError(error)) {
                logger.warn("db:tags:update: constraint failed", { id }, error);
                return null;
            }
            throw error;
        }
    },
    "db:tags:delete": async (db, request) => {
        const { id } = DeleteLibraryTagSchema.parse(request);
        await db.db.delete(libraryTags).where(eq(libraryTags.id, id));
        pingDatabaseChange("db:tag:change");
        return true;
    },
    "db:library:getAllItemTags": async (db) => {
        return await db.db.select().from(libraryItemTags);
    },
    "db:library:setItemTags": async (db, request) => {
        const { itemLink, tagIds } = SetLibraryItemTagsSchema.parse(request);
        const uniqueIds = [...new Set(tagIds)];
        if (uniqueIds.length > 0) {
            const existing = await db.db
                .select({ id: libraryTags.id })
                .from(libraryTags)
                .where(inArray(libraryTags.id, uniqueIds));
            if (existing.length !== uniqueIds.length) {
                logger.warn("db:library:setItemTags: unknown tag id", { itemLink, uniqueIds });
                return null;
            }
        }
        try {
            await db.db.transaction(async (tx) => {
                await tx.delete(libraryItemTags).where(eq(libraryItemTags.itemLink, itemLink));
                if (uniqueIds.length > 0) {
                    await tx.insert(libraryItemTags).values(uniqueIds.map((tagId) => ({ itemLink, tagId })));
                }
            });
        } catch (error) {
            if (isSqliteConstraintError(error)) {
                logger.warn("db:library:setItemTags: constraint failed", { itemLink }, error);
                return null;
            }
            throw error;
        }
        const rows = await db.db.select().from(libraryItemTags).where(eq(libraryItemTags.itemLink, itemLink));
        pingDatabaseChange("db:tag:change");
        return rows;
    },
    // "db:migrateFromJSON": async (db, request) => {
    //     await db.migrateFromJSON(request.historyData, request.bookmarkData);
    // },
};

export const setupDatabaseHandlers = (db: DatabaseService): void => {
    for (const channel in handlers) {
        ipcMain.handle(channel, async (_, request) => {
            try {
                return await handlers[channel as keyof DatabaseChannels](db, request);
            } catch (error) {
                logger.error(`"${channel}": handler threw`, error, "request:", request);
                return null;
            }
        });
    }
};
