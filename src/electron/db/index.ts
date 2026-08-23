import fs from "node:fs";
import path from "node:path";
import type {
    AddToLibraryData,
    BookProgress,
    LibraryItem,
    MangaProgress,
    UpdateBookProgressData,
    UpdateMangaProgressData,
} from "@common/types/db";
import type { HistoryItem, Manga_BookItem } from "@common/types/legacy";
import { mainT } from "@electron/i18n/mainI18n";
import Database from "better-sqlite3";
import { eq, inArray } from "drizzle-orm";
// libsql wont work because of node/electron version issues
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app, dialog } from "electron";
import { dateFromOldDateString, electronOnly } from "../util";
import { createMainLogger } from "../util/logger";

const logger = createMainLogger("db");

import { normalizeLegacyMangaDataBeforeMigration } from "./legacyNormalize";
import { getMigrationsFolder } from "./migrations";
import * as schema from "./schema";
import { bookBookmarks, bookProgress, libraryItems, mangaBookmarks, mangaProgress } from "./schema";

electronOnly();

export const DB_PATH = app.isPackaged ? path.join(app.getPath("userData"), "data.db") : "data.db";

/**
 * better-sqlite3 `SELECT *` shape for a drizzle model: `timestamp_ms` columns are unix ms,
 * not {@link Date}. JSON columns may still be text until parsed.
 */
type SqliteSelectRow<T> = {
    [K in keyof T]: T[K] extends Date ? number : T[K] extends Date | null ? number | null : T[K];
};

type LibraryItemRow = SqliteSelectRow<LibraryItem>;
type MangaProgressRow = SqliteSelectRow<MangaProgress>;
type BookProgressRow = SqliteSelectRow<BookProgress>;

/**
 * Child tables keyed by `itemLink`. Relocate rewrites these with the library row.
 * ponytail: add a name here when a new ON DELETE CASCADE child is keyed the same way.
 */
const ITEMLINK_CHILD_TABLES = [
    "manga_progress",
    "book_progress",
    "manga_bookmarks",
    "book_bookmarks",
    "book_notes",
    "item_trackers",
    "library_item_metadata",
    "library_item_tags",
] as const;

/**
 * Rewrites every `itemLink` child of `fromLink` to `toLink`. Does not change `library_items.link`.
 */
const rewriteChildItemLinks = (sqlite: Database.Database, fromLink: string, toLink: string): void => {
    for (const table of ITEMLINK_CHILD_TABLES) {
        sqlite.prepare(`UPDATE ${table} SET itemLink = ? WHERE itemLink = ?`).run(toLink, fromLink);
    }
};

/**
 * Prefers a cover path that still exists on disk; keeper wins when both exist.
 */
const pickExistingCover = (keeperCover: string | null, discardCover: string | null): string | null => {
    if (keeperCover && fs.existsSync(keeperCover)) return keeperCover;
    if (discardCover && fs.existsSync(discardCover)) return discardCover;
    return keeperCover || discardCover;
};

/**
 * Parses a JSON object column that better-sqlite3 may return as text or an object.
 */
const parseJsonObject = (raw: unknown): Record<string, unknown> => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw === "string") {
        try {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            /* ignore */
        }
    }
    return {};
};

/**
 * Parses a JSON string-array column that better-sqlite3 may return as text or an array.
 */
const parseStringArray = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
    if (typeof raw === "string") {
        try {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
        } catch {
            /* ignore */
        }
    }
    return [];
};

/** Removes the discard row's generated WebP; keeper `id` (and its file) stays. */
const deleteCoverCacheFile = (libraryId: number): void => {
    const coverFile = path.join(app.getPath("userData"), "covers", `${libraryId}.webp`);
    try {
        if (fs.existsSync(coverFile)) fs.unlinkSync(coverFile);
    } catch (err) {
        logger.warn("relocate merge: could not remove discard cover file", { libraryId }, err);
    }
};

/**
 * Folds the row at `newLink` (discard) into the keeper at `oldLink`, then deletes discard.
 * Caller must run this with foreign keys off, inside the relocate transaction.
 *
 * @returns discard `id` when merged, or `null` when a row is missing or types differ
 */
const mergeOccupiedIntoKeeper = (sqlite: Database.Database, oldLink: string, newLink: string): number | null => {
    const keeper = sqlite.prepare(`SELECT * FROM library_items WHERE link = ?`).get(oldLink) as
        | LibraryItemRow
        | undefined;
    const discard = sqlite.prepare(`SELECT * FROM library_items WHERE link = ?`).get(newLink) as
        | LibraryItemRow
        | undefined;
    if (!keeper || !discard) {
        logger.warn("relocateLibraryItem: refuse merge; keeper or discard missing", { oldLink, newLink });
        return null;
    }
    if (keeper.type !== discard.type) {
        logger.warn("relocateLibraryItem: refuse merge; types differ", {
            oldLink,
            newLink,
            keeperType: keeper.type,
            discardType: discard.type,
        });
        return null;
    }

    const title = keeper.title || discard.title;
    const author = keeper.author || discard.author;
    const cover = pickExistingCover(keeper.cover, discard.cover);
    const favouritedAt = keeper.favouritedAt != null ? keeper.favouritedAt : discard.favouritedAt;
    const note = keeper.note && keeper.note.length > 0 ? keeper.note : discard.note;
    const extra = { ...parseJsonObject(discard.extra), ...parseJsonObject(keeper.extra) };

    sqlite
        .prepare(
            `UPDATE library_items SET title = ?, author = ?, cover = ?, favouritedAt = ?, note = ?, extra = ? WHERE link = ?`,
        )
        .run(title, author, cover, favouritedAt, note, JSON.stringify(extra), oldLink);

    const keeperManga = sqlite.prepare(`SELECT * FROM manga_progress WHERE itemLink = ?`).get(oldLink) as
        | MangaProgressRow
        | undefined;
    const discardManga = sqlite.prepare(`SELECT * FROM manga_progress WHERE itemLink = ?`).get(newLink) as
        | MangaProgressRow
        | undefined;
    if (keeperManga && discardManga) {
        const keeperAt = keeperManga.lastReadAt;
        const discardAt = discardManga.lastReadAt;
        const later = discardAt > keeperAt ? discardManga : keeperManga;
        const chaptersRead = Array.from(
            new Set([
                ...parseStringArray(keeperManga.chaptersRead),
                ...parseStringArray(discardManga.chaptersRead),
            ]),
        );
        sqlite
            .prepare(
                `UPDATE manga_progress SET chapterName = ?, currentPage = ?, totalPages = ?, chaptersRead = ?, lastReadAt = ? WHERE itemLink = ?`,
            )
            .run(
                later.chapterName,
                later.currentPage,
                later.totalPages,
                JSON.stringify(chaptersRead),
                later.lastReadAt,
                oldLink,
            );
        sqlite.prepare(`DELETE FROM manga_progress WHERE itemLink = ?`).run(newLink);
    } else if (!keeperManga && discardManga) {
        sqlite.prepare(`UPDATE manga_progress SET itemLink = ? WHERE itemLink = ?`).run(oldLink, newLink);
    }

    const keeperBook = sqlite.prepare(`SELECT * FROM book_progress WHERE itemLink = ?`).get(oldLink) as
        | BookProgressRow
        | undefined;
    const discardBook = sqlite.prepare(`SELECT * FROM book_progress WHERE itemLink = ?`).get(newLink) as
        | BookProgressRow
        | undefined;
    if (keeperBook && discardBook) {
        const later = discardBook.lastReadAt > keeperBook.lastReadAt ? discardBook : keeperBook;
        sqlite
            .prepare(
                `UPDATE book_progress SET chapterId = ?, chapterName = ?, position = ?, lastReadAt = ? WHERE itemLink = ?`,
            )
            .run(later.chapterId, later.chapterName, later.position, later.lastReadAt, oldLink);
        sqlite.prepare(`DELETE FROM book_progress WHERE itemLink = ?`).run(newLink);
    } else if (!keeperBook && discardBook) {
        sqlite.prepare(`UPDATE book_progress SET itemLink = ? WHERE itemLink = ?`).run(oldLink, newLink);
    }

    /* drop discard children whose unique key already exists on keeper, then rekey the rest */
    sqlite
        .prepare(
            `DELETE FROM manga_bookmarks WHERE itemLink = ? AND EXISTS (
                SELECT 1 FROM manga_bookmarks k WHERE k.itemLink = ? AND k.chapterName = manga_bookmarks.chapterName AND k.page = manga_bookmarks.page
            )`,
        )
        .run(newLink, oldLink);
    sqlite.prepare(`UPDATE manga_bookmarks SET itemLink = ? WHERE itemLink = ?`).run(oldLink, newLink);

    sqlite
        .prepare(
            `DELETE FROM book_bookmarks WHERE itemLink = ? AND EXISTS (
                SELECT 1 FROM book_bookmarks k WHERE k.itemLink = ? AND k.chapterId = book_bookmarks.chapterId AND k.position = book_bookmarks.position
            )`,
        )
        .run(newLink, oldLink);
    sqlite.prepare(`UPDATE book_bookmarks SET itemLink = ? WHERE itemLink = ?`).run(oldLink, newLink);

    /* unique is (chapterId, range, selectedText); drop discard rows that would collide after rekey */
    sqlite
        .prepare(
            `DELETE FROM book_notes WHERE itemLink = ? AND EXISTS (
                SELECT 1 FROM book_notes k WHERE k.itemLink = ? AND k.chapterId = book_notes.chapterId AND k.range = book_notes.range AND k.selectedText = book_notes.selectedText
            )`,
        )
        .run(newLink, oldLink);
    sqlite.prepare(`UPDATE book_notes SET itemLink = ? WHERE itemLink = ?`).run(oldLink, newLink);

    sqlite
        .prepare(
            `DELETE FROM item_trackers WHERE itemLink = ? AND provider IN (SELECT provider FROM item_trackers WHERE itemLink = ?)`,
        )
        .run(newLink, oldLink);
    sqlite.prepare(`UPDATE item_trackers SET itemLink = ? WHERE itemLink = ?`).run(oldLink, newLink);

    sqlite
        .prepare(
            `DELETE FROM library_item_metadata WHERE itemLink = ? AND source IN (SELECT source FROM library_item_metadata WHERE itemLink = ?)`,
        )
        .run(newLink, oldLink);
    sqlite.prepare(`UPDATE library_item_metadata SET itemLink = ? WHERE itemLink = ?`).run(oldLink, newLink);

    sqlite
        .prepare(
            `INSERT OR IGNORE INTO library_item_tags (itemLink, tagId) SELECT ?, tagId FROM library_item_tags WHERE itemLink = ?`,
        )
        .run(oldLink, newLink);
    /* FKs are off, so CASCADE will not drop discard tags; leftover rows at newLink collide on rewrite */
    sqlite.prepare(`DELETE FROM library_item_tags WHERE itemLink = ?`).run(newLink);

    sqlite.prepare(`DELETE FROM library_items WHERE link = ?`).run(newLink);
    return discard.id;
};

export class DatabaseService {
    private readonly sqlite = new Database(DB_PATH);
    private readonly _db = drizzle({ client: this.sqlite, schema });

    get db(): ReturnType<typeof drizzle> {
        return this._db;
    }

    /** Underlying better-sqlite3 handle for online backup API. */
    get sqliteDb(): Database.Database {
        return this.sqlite;
    }

    /** Closes the SQLite connection. Safe to call once during shutdown. */
    close(): void {
        this.sqlite.close();
    }

    /**
     * Runs `fn` with `PRAGMA foreign_keys = OFF` on this connection, then restores ON in `finally`.
     * Prefer a synchronous `fn` (and better-sqlite3 transactions inside it) so the main-process
     * event loop cannot interleave other DB work while checks are disabled.
     */
    private withForeignKeysOff<T>(fn: () => T): T {
        this.sqlite.pragma("foreign_keys = OFF");
        try {
            return fn();
        } finally {
            this.sqlite.pragma("foreign_keys = ON");
        }
    }

    /**
     * Async variant of {@link withForeignKeysOff}. Safe for `await migrate()`, but yields the
     * event loop while FKs are off - only use when the work cannot stay synchronous.
     */
    private async withForeignKeysOffAsync<T>(fn: () => Promise<T>): Promise<T> {
        this.sqlite.pragma("foreign_keys = OFF");
        try {
            return await fn();
        } finally {
            this.sqlite.pragma("foreign_keys = ON");
        }
    }

    /**
     * Normalizes legacy manga rows, then applies pending Drizzle journal files.
     *
     * @param pendingTags journal tags the caller already detected (for apply/complete logs only;
     *   empty on everyday launches). Does not re-read the journal.
     * @throws Relays normalize or Drizzle `migrate()` failures after logging.
     */
    async initialize(pendingTags: string[] = []): Promise<void> {
        if (pendingTags.length > 0) {
            logger.log("applying drizzle migrations", { tags: pendingTags });
        }

        try {
            normalizeLegacyMangaDataBeforeMigration(this.sqlite);
        } catch (e) {
            logger.error("Legacy manga normalization failed; aborting migration", e);
            throw e;
        }

        /**
         * Migration `0001` rebuilds `library_items` via DROP + RENAME. Drizzle wraps every
         * `migrate()` call in BEGIN/COMMIT, and SQLite ignores `PRAGMA foreign_keys` inside a
         * transaction (https://www.sqlite.org/pragma.html#pragma_foreign_keys). So the PRAGMA in
         * the SQL file is a no-op and `DROP TABLE library_items` fires `ON DELETE CASCADE` on all
         * child tables (progress, bookmarks, notes), wiping user data.
         *
         * Fix: detect whether 0001 still needs to run (library_items lacks the `id` column) and
         * toggle FKs on the connection before Drizzle opens its transaction. After migrate()
         * FKs are unconditionally restored so every subsequent migration runs with full checking.
         *
         * See: https://www.sqlite.org/lang_altertable.html#making_other_kinds_of_table_schema_changes
         */
        const libCols = this.sqlite.prepare("PRAGMA table_info(library_items)").all() as { name: string }[];
        const needs0001 = libCols.length > 0 && !libCols.some((c) => c.name === "id");

        const runMigrate = async () => {
            await migrate(this._db, {
                migrationsFolder: getMigrationsFolder(),
            });
        };

        if (needs0001) {
            logger.log("migration 0001 pending: disabling FK enforcement for table-rebuild");
            await this.withForeignKeysOffAsync(runMigrate);
            logger.log("migration 0001 complete: FK enforcement restored");
        } else {
            await runMigrate();
        }

        if (pendingTags.length > 0) {
            logger.log("drizzle migrations complete", { tags: pendingTags });
        }
    }
    /**
     * Inserts a library item, optionally with a progress row, or refreshes the title when
     * the item is already present.
     *
     * Re-adding is a safe no-op for everything the user or an earlier session stored.
     * Callers echo a full row back on every open - manga readers pass `author: null` and a
     * derived `cover`, which would otherwise erase a stored author and replace a custom
     * cover - so the conflict path updates only the title. Author and cover have their own
     * update path (`db:library:updateItem`). Existing progress is likewise kept rather than
     * reset to the freshly opened position. Scan/import omit `progress` so the row stays
     * catalogue-only until the reader writes one.
     */
    async addLibraryItem(data: AddToLibraryData): Promise<LibraryItem> {
        return await this._db.transaction(async (tx) => {
            const [item] = await tx
                .insert(libraryItems)
                .values(data.data)
                .onConflictDoUpdate({
                    target: [libraryItems.link],
                    set: { title: data.data.title },
                })
                .returning();
            if (data.progress && data.type === "manga") {
                await tx
                    .insert(mangaProgress)
                    .values({
                        itemLink: item.link,
                        ...data.progress,
                        chaptersRead: [],
                        lastReadAt: new Date(),
                    })
                    .onConflictDoNothing();
            } else if (data.progress && data.type === "book") {
                await tx
                    .insert(bookProgress)
                    .values({
                        itemLink: item.link,
                        ...data.progress,
                        lastReadAt: new Date(),
                    })
                    .onConflictDoNothing();
            }
            return item;
        });
    }

    /**
     * Deletes manga and book progress rows for `links` without removing catalogue items.
     * Empty `links` is a no-op. Used by Settings clear-unused-progress and home Remove Progress.
     */
    async deleteProgressForLinks(links: readonly string[]): Promise<number> {
        if (links.length === 0) return 0;
        const unique = [...new Set(links)];
        return await this._db.transaction(async (tx) => {
            const manga = await tx
                .delete(mangaProgress)
                .where(inArray(mangaProgress.itemLink, unique))
                .returning();
            const books = await tx.delete(bookProgress).where(inArray(bookProgress.itemLink, unique)).returning();
            return manga.length + books.length;
        });
    }

    /**
     * Rewrites `library_items.link` and every child `itemLink` to `newLink`.
     * Keeps the same row `id` (cover cache stays valid). When `newLink` is already
     * occupied by the same type, merges discard into keeper then rewrites. Returns
     * null when `oldLink` is missing or types differ.
     *
     * Existence/conflict checks and the rewrite run inside one sync
     * {@link withForeignKeysOff} + better-sqlite3 transaction so other IPC cannot
     * interleave while FKs are off. (SQLite also ignores `PRAGMA foreign_keys`
     * inside a transaction.)
     */
    async relocateLibraryItem(oldLink: string, newLink: string): Promise<LibraryItem | null> {
        if (oldLink === newLink) {
            const [same] = await this._db.select().from(libraryItems).where(eq(libraryItems.link, oldLink));
            return same ?? null;
        }

        try {
            const relocated = this.withForeignKeysOff(() => {
                const source = this.sqlite.prepare(`SELECT link FROM library_items WHERE link = ?`).get(oldLink) as
                    | { link: string }
                    | undefined;
                if (!source) {
                    logger.warn(`relocateLibraryItem: no library row for oldLink=${oldLink}`);
                    return false;
                }
                const conflict = this.sqlite.prepare(`SELECT id FROM library_items WHERE link = ?`).get(newLink) as
                    | { id: number }
                    | undefined;

                let discardedId: number | null = null;
                this.sqlite.transaction(() => {
                    if (conflict) {
                        discardedId = mergeOccupiedIntoKeeper(this.sqlite, oldLink, newLink);
                        if (discardedId == null) return;
                    }
                    rewriteChildItemLinks(this.sqlite, oldLink, newLink);
                    this.sqlite.prepare(`UPDATE library_items SET link = ? WHERE link = ?`).run(newLink, oldLink);
                })();
                if (conflict && discardedId == null) return false;
                if (discardedId != null) deleteCoverCacheFile(discardedId);
                return true;
            });
            if (!relocated) return null;
        } catch (err) {
            logger.error("relocateLibraryItem: transaction failed", { oldLink, newLink }, err);
            return null;
        }

        const [item] = await this._db.select().from(libraryItems).where(eq(libraryItems.link, newLink));
        return item ?? null;
    }

    /**
     * Persists manga progress, creating the child row when a catalogue-only scan item
     * is opened for the first time and updating it on later reader saves.
     */
    async updateMangaProgress(data: UpdateMangaProgressData): Promise<MangaProgress[]> {
        const { itemLink, ...updateData } = data;
        if (data.chapterName === undefined) throw new Error("Cannot create manga progress without a chapter name");
        return await this._db
            .insert(mangaProgress)
            .values({
                itemLink,
                chapterName: data.chapterName,
                currentPage: data.currentPage,
                chaptersRead: data.chaptersRead ?? [],
                totalPages: data.totalPages,
                lastReadAt: new Date(),
            })
            .onConflictDoUpdate({
                target: mangaProgress.itemLink,
                set: { ...updateData, lastReadAt: new Date() },
            })
            .returning();
    }

    async updateMangaChapterRead(itemLink: string, chapterNames: string[], read: boolean): Promise<string[]> {
        return await this._db.transaction(async (tx) => {
            const [progress] = await tx.select().from(mangaProgress).where(eq(mangaProgress.itemLink, itemLink));
            if (!progress) {
                throw new Error("Progress not found");
            }
            const chaptersRead = progress.chaptersRead || [];
            if (read) {
                progress.chaptersRead = Array.from(new Set([...chaptersRead, ...chapterNames]));
            } else {
                if (chapterNames.length === 0) progress.chaptersRead = [];
                else progress.chaptersRead = chaptersRead.filter((c) => !chapterNames.includes(c));
            }
            return (
                await tx
                    .update(mangaProgress)
                    .set({ chaptersRead: progress.chaptersRead })
                    .where(eq(mangaProgress.itemLink, itemLink))
                    .returning()
            )[0].chaptersRead;
        });
    }

    /**
     * Persists book progress, creating the child row when a catalogue-only scan item
     * is opened for the first time and updating it on later reader saves.
     */
    async updateBookProgress(data: UpdateBookProgressData): Promise<BookProgress[]> {
        const { itemLink, ...updateData } = data;
        if (data.chapterId === undefined || data.position === undefined) {
            throw new Error("Cannot create book progress without a chapter and position");
        }
        return await this._db
            .insert(bookProgress)
            .values({
                itemLink,
                chapterId: data.chapterId,
                chapterName: data.chapterName,
                position: data.position,
                lastReadAt: new Date(),
            })
            .onConflictDoUpdate({
                target: bookProgress.itemLink,
                set: { ...updateData, lastReadAt: new Date() },
            })
            .returning();
    }

    async migrateFromJSON(historyData: HistoryItem[], bookmarkData: Manga_BookItem[]): Promise<void> {
        logger.log(
            `JSON->SQLite migration: ${historyData.length} history row(s), ${bookmarkData.length} bookmark row(s)`,
        );

        let historySuccess = 0;
        let historyFailed = 0;
        let bookmarkSuccess = 0;
        let bookmarkFailed = 0;
        const errors: Array<{ type: string; item: any; error: string }> = [];

        // Ensure title is never null/undefined/empty
        const getTitle = (title: string | undefined | null, fallback: string): string => {
            return title && title.trim().length > 0 ? title.trim() : fallback;
        };

        return await this._db.transaction(async (tx) => {
            for (const item of historyData) {
                try {
                    const parentLink = item.type === "image" ? path.dirname(item.data.link) : item.data.link;

                    const [existing] = await tx
                        .select()
                        .from(libraryItems)
                        .where(eq(libraryItems.link, parentLink));
                    if (existing) {
                        logger.log(`History import skipped (library item already exists): "${parentLink}"`);
                        historySuccess++;
                        continue;
                    }

                    // Validate required fields
                    if (!parentLink || !item.data.link) {
                        throw new Error("Missing required link data");
                    }

                    const [newItem] = await tx
                        .insert(libraryItems)
                        .values({
                            type: item.type === "image" ? "manga" : "book",
                            link: parentLink,
                            title: item.type === "image" ? item.data.mangaName : item.data.title,
                            author: item.type === "image" ? undefined : item.data.author,
                            cover: item.type === "image" ? undefined : item.data.cover,
                            createdAt: dateFromOldDateString(item.data.date),
                        })
                        .returning();

                    if (item.type === "image") {
                        const chapterName = item.data.chapterName?.trim() || path.basename(item.data.link);
                        await tx.insert(mangaProgress).values({
                            itemLink: newItem.link,
                            chapterName,
                            currentPage: Math.max(1, item.data.page || 1),
                            totalPages: Math.max(1, item.data.pages || 1),
                            lastReadAt: dateFromOldDateString(item.data.date),
                            chaptersRead: Array.from(new Set(item.data.chaptersRead)) || [],
                        });
                    } else {
                        await tx.insert(bookProgress).values({
                            itemLink: newItem.link,
                            chapterId: item.data.chapterData?.id || "chapter-1",
                            position: item.data.chapterData?.elementQueryString || "body",
                            chapterName: item.data.chapterData?.chapterName || "Chapter 1",
                            lastReadAt: dateFromOldDateString(item.data.date),
                        });
                    }

                    historySuccess++;
                    logger.log(`History row imported: "${item.data.link}"`);
                } catch (error) {
                    historyFailed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    logger.error(`History row failed (${item.data?.link ?? "unknown link"}):`, errorMsg);
                    errors.push({
                        type: "history",
                        item,
                        error: errorMsg,
                    });
                }
            }

            for (const bookmark of bookmarkData) {
                try {
                    const parentLink =
                        bookmark.type === "image" ? path.dirname(bookmark.data.link) : bookmark.data.link;

                    if (!parentLink || !bookmark.data.link) {
                        throw new Error("Missing required link data");
                    }

                    let [item] = await tx.select().from(libraryItems).where(eq(libraryItems.link, parentLink));
                    if (!item) {
                        logger.log(
                            `Bookmark import: no library row for "${bookmark.data.link}", creating item first`,
                        );

                        if (bookmark.type === "image") {
                            const title = getTitle(bookmark.data.mangaName, path.basename(parentLink));
                            const chapterName =
                                bookmark.data.chapterName?.trim() || path.basename(bookmark.data.link);
                            item = await this.addLibraryItem({
                                type: "manga",
                                data: { link: parentLink, title: title, type: "manga" },
                                progress: {
                                    chapterName,
                                    currentPage: Math.max(1, bookmark.data.page || 1),
                                    totalPages: Math.max(1, bookmark.data.pages || 1),
                                },
                            });
                        } else {
                            const title = getTitle(bookmark.data.title, path.basename(parentLink));
                            item = await this.addLibraryItem({
                                type: "book",
                                data: {
                                    link: parentLink,
                                    title: title,
                                    type: "book",
                                    author: bookmark.data.author,
                                    cover: bookmark.data.cover,
                                },
                                progress: {
                                    chapterId: bookmark.data.chapterData?.id || "chapter-1",
                                    chapterName: bookmark.data.chapterData?.chapterName || "Chapter 1",
                                    position: bookmark.data.chapterData?.elementQueryString || "body",
                                },
                            });
                        }
                    }

                    if (bookmark.type === "image") {
                        const chapterName = bookmark.data.chapterName?.trim() || path.basename(bookmark.data.link);
                        await tx.insert(mangaBookmarks).values({
                            itemLink: parentLink,
                            page: Math.max(1, bookmark.data.page || 1),
                            createdAt: dateFromOldDateString(bookmark.data.date),
                            chapterName,
                        });
                    } else {
                        await tx.insert(bookBookmarks).values({
                            itemLink: parentLink,
                            chapterId: bookmark.data.chapterData?.id || "chapter-1",
                            position: bookmark.data.chapterData?.elementQueryString || "body",
                            chapterName: bookmark.data.chapterData?.chapterName || "Chapter 1",
                            createdAt: dateFromOldDateString(bookmark.data.date),
                        });
                    }

                    bookmarkSuccess++;
                    logger.log(`Bookmark row imported: "${bookmark.data.link}"`);
                } catch (error) {
                    bookmarkFailed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    logger.error(`Bookmark row failed (${bookmark.data?.link ?? "unknown link"}):`, errorMsg);
                    errors.push({
                        type: "bookmark",
                        item: bookmark,
                        error: errorMsg,
                    });
                }
            }

            logger.log("Migration Summary:");
            logger.log(`History Items - Success: ${historySuccess}, Failed: ${historyFailed}`);
            logger.log(`Bookmarks - Success: ${bookmarkSuccess}, Failed: ${bookmarkFailed}`);

            if (errors.length > 0) {
                logger.log(`Migration failures (first ${errors.length} collected):`);
                errors.forEach((err, index) => {
                    logger.log(`${index + 1}. [${err.type}] ${err.error}`, err.item);
                });
                dialog.showMessageBox({
                    type: "error",
                    message: mainT("migrate.partialErrors", { ns: "electron" }),
                    detail: mainT("migrate.partialErrorsDetail", {
                        ns: "electron",
                        count: errors.length,
                    }),
                });
            }

            logger.log("JSON->SQLite migration finished");
        });
    }
}
