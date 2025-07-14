import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
// libsql wont work because of node/electron version issues
import path from "path";
import { app, dialog } from "electron";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { libraryItems, mangaProgress, bookProgress, mangaBookmarks, bookBookmarks } from "./schema";
import { HistoryItem, Manga_BookItem } from "@common/types/legacy";
import Database from "better-sqlite3";
import { dateFromOldDateString, electronOnly, log } from "../util";
import {
    AddToLibraryData,
    BookProgress,
    LibraryItem,
    MangaProgress,
    UpdateBookProgressData,
    UpdateMangaProgressData,
} from "@common/types/db";

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
            const [item] = await tx.insert(libraryItems).values(data.data).returning();
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
        log.log(
            "Migrating from JSON " +
                historyData.length +
                " history items and " +
                bookmarkData.length +
                " bookmark items",
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
                        log.log("Item already exists", parentLink);
                        historySuccess++;
                        continue;
                    }

                    // Validate required fields
                    if (!parentLink || !item.data.link) {
                        throw new Error("Missing required link data");
                    }

                    const title =
                        item.type === "image"
                            ? getTitle(item.data.mangaName, path.basename(parentLink))
                            : getTitle(item.data.title, path.basename(parentLink));

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
                    log.log("Migrated history item", item.data.link);
                } catch (error) {
                    historyFailed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    log.error("Failed to migrate history item:", item.data?.link || "unknown", errorMsg);
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
                        log.log("Item not found for bookmark", bookmark.data.link);
                        log.log("Creating new item for bookmark");

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
                    log.log("Migrated bookmark", bookmark.data.link);
                } catch (error) {
                    bookmarkFailed++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    log.error("Failed to migrate bookmark:", bookmark.data?.link || "unknown", errorMsg);
                    errors.push({
                        type: "bookmark",
                        item: bookmark,
                        error: errorMsg,
                    });
                }
            }

            log.log("Migration Summary:");
            log.log(`History Items - Success: ${historySuccess}, Failed: ${historyFailed}`);
            log.log(`Bookmarks - Success: ${bookmarkSuccess}, Failed: ${bookmarkFailed}`);

            if (errors.length > 0) {
                log.log("Migration Errors:");
                errors.forEach((err, index) => {
                    log.log(`${index + 1}. ${err.type}: ${err.error} : ${JSON.stringify(err.item)}`);
                });
                dialog.showMessageBox({
                    type: "error",
                    message: "There were errors during migration.",
                    detail: `Items skipped : ${errors.length}.\nPlease check the logs.`,
                });
            }

            log.log("Migration complete");
        });
    }
}
