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
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
// libsql wont work because of node/electron version issues
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app, dialog } from "electron";
import { dateFromOldDateString, electronOnly } from "../util";
import { createMainLogger } from "../util/logger";

const logger = createMainLogger("db");

import * as schema from "./schema";
import { bookBookmarks, bookProgress, libraryItems, mangaBookmarks, mangaProgress } from "./schema";

electronOnly();

export const DB_PATH = app.isPackaged ? path.join(app.getPath("userData"), "data.db") : "data.db";

export class DatabaseService {
    private _db: ReturnType<typeof drizzle>;
    constructor() {
        const sqlite = new Database(DB_PATH);
        this._db = drizzle({ client: sqlite, schema });
    }

    get db(): ReturnType<typeof drizzle> {
        return this._db;
    }
    async initialize(): Promise<void> {
        // console.log("Migrating database");
        await migrate(this._db, {
            migrationsFolder: app.isPackaged ? path.join(path.dirname(app.getAppPath()), "drizzle") : "drizzle",
        });
        // console.log(this._db.all(`select unixepoch() as time`));
    }
    async addLibraryItem(data: AddToLibraryData): Promise<LibraryItem> {
        return await this._db.transaction(async (tx) => {
            const [item] = await tx
                .insert(libraryItems)
                .values(data.data)
                .onConflictDoUpdate({
                    target: [libraryItems.link],
                    set: data.data,
                })
                .returning();
            if (data.type === "manga") {
                await tx.insert(mangaProgress).values({
                    itemLink: item.link,
                    ...data.progress,
                    chaptersRead: [],
                    lastReadAt: new Date(),
                });
            } else {
                await tx.insert(bookProgress).values({
                    itemLink: item.link,
                    ...data.progress,
                    lastReadAt: new Date(),
                });
            }
            return item;
        });
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
                        await tx.insert(mangaProgress).values({
                            itemLink: newItem.link,
                            chapterName: item.data.chapterName || "Chapter 1",
                            chapterLink: item.data.link,
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
                            item = await this.addLibraryItem({
                                type: "manga",
                                data: { link: parentLink, title: title, type: "manga" },
                                progress: {
                                    chapterLink: bookmark.data.link,
                                    chapterName: bookmark.data.chapterName || "Chapter 1",
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
                        await tx.insert(mangaBookmarks).values({
                            itemLink: parentLink,
                            link: bookmark.data.link,
                            page: Math.max(1, bookmark.data.page || 1),
                            createdAt: dateFromOldDateString(bookmark.data.date),
                            chapterName: bookmark.data.chapterName || "Chapter 1",
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
                    message: "There were errors during migration.",
                    detail: `Items skipped : ${errors.length}.\nPlease check the logs.`,
                });
            }

            logger.log("JSON->SQLite migration finished");
        });
    }
}
