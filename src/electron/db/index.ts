import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
// libsql wont work because of node/electron version issues
import path from "path";
import { app } from "electron";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { libraryItems, mangaProgress, bookProgress, mangaBookmarks, bookBookmarks } from "./schema";
import { HistoryItem, Manga_BookItem } from "@common/types/legacy";
import Database from "better-sqlite3";
import { dateFromOldDateString, electronOnly, log } from "../util";
import { AddToLibraryData, UpdateBookProgressData, UpdateMangaProgressData } from "@common/types/db";

electronOnly();
// todo : add proper error handling

export const DB_PATH = app.isPackaged ? path.join(app.getPath("userData"), "data.db") : "data.db";

export class DatabaseService {
    private _db: ReturnType<typeof drizzle>;
    constructor() {
        const sqlite = new Database(DB_PATH);
        this._db = drizzle({ client: sqlite, schema });
    }

    get db() {
        return this._db;
    }
    async initialize() {
        console.log("Migrating database");
        migrate(this._db, {
            migrationsFolder: app.isPackaged ? path.join(path.dirname(app.getAppPath()), "drizzle") : "drizzle",
        });
        console.log(this._db.all(`select unixepoch() as time`));
    }
    async addLibraryItem(data: AddToLibraryData) {
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

    async updateMangaProgress(data: UpdateMangaProgressData) {
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

    async updateMangaChapterRead(itemLink: string, chapterNames: string[], read: boolean) {
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

    async updateBookProgress(data: UpdateBookProgressData) {
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

    // todo: review
    // todo: add option in frontend to manually import as well
    async migrateFromJSON(historyData: HistoryItem[], bookmarkData: Manga_BookItem[]) {
        log.log(
            "Migrating from JSON " +
                historyData.length +
                " history items and " +
                bookmarkData.length +
                " bookmark items",
        );
        return await this._db.transaction(async (tx) => {
            for (const item of historyData) {
                const parentLink = item.type === "image" ? path.dirname(item.data.link) : item.data.link;
                const [existing] = await tx.select().from(libraryItems).where(eq(libraryItems.link, parentLink));
                if (existing) {
                    log.log("Item already exists", parentLink);
                    continue;
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
                        chapterName: item.data.chapterName,
                        chapterLink: item.data.link,
                        currentPage: item.data.page,
                        totalPages: item.data.pages,
                        lastReadAt: dateFromOldDateString(item.data.date),
                        chaptersRead: Array.from(new Set(item.data.chaptersRead)) || [],
                    });
                } else {
                    await tx.insert(bookProgress).values({
                        itemLink: newItem.link,
                        chapterId: item.data.chapterData?.id || "",
                        position: item.data.chapterData?.elementQueryString || "",
                        chapterName: item.data.chapterData?.chapterName,
                        lastReadAt: dateFromOldDateString(item.data.date),
                    });
                }
                console.log("Migrated history item", item.data.link);
            }

            for (const bookmark of bookmarkData) {
                const parentLink =
                    bookmark.type === "image" ? path.dirname(bookmark.data.link) : bookmark.data.link;

                let [item] = await tx.select().from(libraryItems).where(eq(libraryItems.link, parentLink));
                if (!item) {
                    log.log("Item not found for bookmark", bookmark);
                    log.log("Creating new item for bookmark");
                    if (bookmark.type === "image") {
                        item = await this.addLibraryItem({
                            type: "manga",
                            data: { link: parentLink, title: bookmark.data.mangaName, type: "manga" },
                            progress: {
                                chapterLink: bookmark.data.link,
                                chapterName: bookmark.data.chapterName,
                                currentPage: 1,
                                totalPages: bookmark.data.pages,
                            },
                        });
                    } else {
                        item = await this.addLibraryItem({
                            type: "book",
                            data: {
                                link: parentLink,
                                title: bookmark.data.title,
                                type: "book",
                                author: bookmark.data.author,
                                cover: bookmark.data.cover,
                            },
                            progress: {
                                chapterId: bookmark.data.chapterData?.id || "",
                                chapterName: bookmark.data.chapterData?.chapterName,
                                position: bookmark.data.chapterData?.elementQueryString || "",
                            },
                        });
                    }
                }
                if (bookmark.type === "image") {
                    await tx.insert(mangaBookmarks).values({
                        itemLink: parentLink,
                        link: bookmark.data.link,
                        page: bookmark.data.page,
                        createdAt: dateFromOldDateString(bookmark.data.date),
                        chapterName: bookmark.data.chapterName,
                    });
                } else {
                    await tx.insert(bookBookmarks).values({
                        itemLink: parentLink,
                        chapterId: bookmark.data.chapterData?.id || "",
                        position: bookmark.data.chapterData?.elementQueryString || "",
                        chapterName: bookmark.data.chapterData?.chapterName,
                        createdAt: dateFromOldDateString(bookmark.data.date),
                    });
                }
                console.log("Migrated bookmark", bookmark.data.link);
            }
            log.log("Migration complete");
        });
    }
}
