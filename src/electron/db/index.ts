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
import { eq } from "drizzle-orm";
// libsql wont work because of node/electron version issues
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app, dialog } from "electron";
import { dateFromOldDateString, electronOnly } from "../util";
import { createMainLogger } from "../util/logger";

const logger = createMainLogger("db");

import { normalizeLegacyMangaDataBeforeMigration } from "./legacyNormalize";
import * as schema from "./schema";
import { bookBookmarks, bookProgress, libraryItems, mangaBookmarks, mangaProgress } from "./schema";

electronOnly();

export const DB_PATH = app.isPackaged ? path.join(app.getPath("userData"), "data.db") : "data.db";

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

    async initialize(): Promise<void> {
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
                migrationsFolder: app.isPackaged
                    ? path.join(path.dirname(app.getAppPath()), "drizzle")
                    : "drizzle",
            });
        };

        if (needs0001) {
            logger.log("migration 0001 pending: disabling FK enforcement for table-rebuild");
            await this.withForeignKeysOffAsync(runMigrate);
            logger.log("migration 0001 complete: FK enforcement restored");
        } else {
            await runMigrate();
        }
    }
    /**
     * Inserts a library item and its progress row, or refreshes the title when the item
     * is already present.
     *
     * Re-adding is a safe no-op for everything the user or an earlier session stored.
     * Callers echo a full row back on every open - manga readers pass `author: null` and a
     * derived `cover`, which would otherwise erase a stored author and replace a custom
     * cover - so the conflict path updates only the title. Author and cover have their own
     * update path (`db:library:updateItem`). Existing progress is likewise kept rather than
     * reset to the freshly opened position.
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
            if (data.type === "manga") {
                await tx
                    .insert(mangaProgress)
                    .values({
                        itemLink: item.link,
                        ...data.progress,
                        chaptersRead: [],
                        lastReadAt: new Date(),
                    })
                    .onConflictDoNothing();
            } else {
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
     * Rewrites `library_items.link` and every child `itemLink` to `newLink`.
     * Keeps the same row `id` (cover cache stays valid). Returns null when `oldLink`
     * is missing or `newLink` is already used by another row.
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
                const conflict = this.sqlite
                    .prepare(`SELECT link FROM library_items WHERE link = ?`)
                    .get(newLink) as { link: string } | undefined;
                if (conflict) {
                    logger.warn(`relocateLibraryItem: newLink already in library (${newLink})`);
                    return false;
                }

                this.sqlite.transaction(() => {
                    this.sqlite
                        .prepare(`UPDATE manga_progress SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite
                        .prepare(`UPDATE book_progress SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite
                        .prepare(`UPDATE manga_bookmarks SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite
                        .prepare(`UPDATE book_bookmarks SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite
                        .prepare(`UPDATE book_notes SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite
                        .prepare(`UPDATE item_trackers SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite
                        .prepare(`UPDATE library_item_metadata SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite
                        .prepare(`UPDATE library_item_tags SET itemLink = ? WHERE itemLink = ?`)
                        .run(newLink, oldLink);
                    this.sqlite.prepare(`UPDATE library_items SET link = ? WHERE link = ?`).run(newLink, oldLink);
                })();
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

    async updateMangaProgress(data: UpdateMangaProgressData): Promise<MangaProgress[]> {
        const { itemLink, ...updateData } = data;
        return await this._db
            .update(mangaProgress)
            .set({
                ...updateData,
                lastReadAt: new Date(),
            })
            .where(eq(mangaProgress.itemLink, itemLink))
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

    async updateBookProgress(data: UpdateBookProgressData): Promise<BookProgress[]> {
        const { itemLink, ...updateData } = data;
        return await this._db
            .update(bookProgress)
            .set({
                ...updateData,
                lastReadAt: new Date(),
            })
            .where(eq(bookProgress.itemLink, itemLink))
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
