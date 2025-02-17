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
import { electronOnly } from "../util";

electronOnly();
// todo : add proper error handling

export class DatabaseService {
    private _db: ReturnType<typeof drizzle>;
    // private client: ReturnType<typeof createClient>;
    constructor() {
        // const dbPath = `file:${path.join(app.getPath("userData"), "data.db")}`;
        // const dbPath = "file:data.db";
        const sqlite = new Database(app.isPackaged ? path.join(app.getPath("userData"), "data.db") : "data.db");
        this._db = drizzle({ client: sqlite, schema, logger: true });
        // this.client = createClient({
        //     url: dbPath,
        // });
        // this._db = drizzle(dbPath);
    }

    get db() {
        return this._db;
    }
    async initialize() {
        // todo add this to webpack copy
        migrate(this._db, {
            migrationsFolder: path.resolve("./drizzle"),
        });
        console.log(this._db.all(`select unixepoch() as time`));
    }

    async addLibraryItem(
        data: typeof libraryItems.$inferInsert,
        {
            chapterLink,
            totalPages,
            currentPage = 1,
        }: {
            chapterLink: string;
            totalPages: number;
            currentPage?: number;
        }
    ) {
        return await this._db.transaction(async (tx) => {
            const [item] = await tx.insert(libraryItems).values(data).returning();
            if (item.type === "manga") {
                await tx.insert(mangaProgress).values({
                    itemLink: item.link,
                    chapterLink,
                    currentPage,
                    chaptersRead: [],
                    totalPages,
                    lastReadAt: new Date(),
                    chapterName: path.basename(chapterLink),
                });
            }
            return item;
        });
    }

    async updateMangaProgress(
        itemLink: string,
        data: Partial<Omit<typeof mangaProgress.$inferInsert, "itemLink">>
    ) {
        data = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        // todo : check if works fine
        return await this._db
            .update(mangaProgress)
            .set(data)
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

    async updateBookProgress(itemLink: string, data: Partial<Omit<typeof bookProgress.$inferInsert, "itemLink">>) {
        data = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
        return await this._db
            .update(bookProgress)
            .set(data)
            .where(eq(bookProgress.itemLink, itemLink))
            .returning();
    }

    // todo: review
    async migrateFromJSON(historyData: HistoryItem[], bookmarkData: Manga_BookItem[]) {
        return await this._db.transaction(async (tx) => {
            for (const item of historyData) {
                // todo: use defined addLibraryItem
                const [newItem] = await tx
                    .insert(libraryItems)
                    .values({
                        type: item.type === "image" ? "manga" : "book",
                        link: item.type === "image" ? item.data.mangaName : item.data.link,
                        title: item.type === "image" ? item.data.mangaName : item.data.title,
                        author: item.type === "image" ? undefined : item.data.author,
                        cover: item.type === "image" ? undefined : item.data.cover,
                        ...(item.data.date ? { createdAt: new Date(item.data.date) } : {}),
                    })
                    .returning();

                if (item.type === "image") {
                    await tx.insert(mangaProgress).values({
                        itemLink: newItem.link,
                        chapterName: item.data.chapterName,
                        chapterLink: item.data.link,
                        currentPage: item.data.page,
                        totalPages: item.data.pages,
                        lastReadAt: new Date(item.data.date || 0),
                        chaptersRead: Array.from(new Set(item.data.chaptersRead)) || [],
                    });
                } else {
                    await tx.insert(bookProgress).values({
                        itemLink: newItem.link,
                        chapterId: item.data.chapterData.id,
                        chapterName: item.data.chapterData.chapterName,
                        position: item.data.chapterData.elementQueryString,
                        lastReadAt: new Date(item.data.date || 0),
                    });
                }
            }

            for (const bookmark of bookmarkData) {
                const parentLink =
                    bookmark.type === "image" ? path.dirname(bookmark.data.link) : bookmark.data.link;
                let [item] = await tx.select().from(libraryItems).where(eq(libraryItems.link, parentLink));
                if (!item) {
                    console.log("Item not found for bookmark", bookmark);
                    console.log("Creating new item for bookmark");
                    const [newItem] = await tx
                        .insert(libraryItems)
                        .values({
                            type: bookmark.type === "image" ? "manga" : "book",
                            link: parentLink,
                            title: bookmark.type === "image" ? bookmark.data.mangaName : bookmark.data.title,
                            author: bookmark.type === "image" ? undefined : bookmark.data.author,
                            cover: bookmark.type === "image" ? undefined : bookmark.data.cover,
                        })
                        .returning();
                    //! todo: use defined addLibraryItem
                    item = newItem;
                }
                if (bookmark.type === "image") {
                    await tx.insert(mangaBookmarks).values({
                        itemLink: item.link,
                        link: bookmark.data.link,
                        page: bookmark.data.page,
                        createdAt: new Date(bookmark.data.date || 0),
                    });
                } else {
                    await tx.insert(bookBookmarks).values({
                        itemLink: item.link,
                        chapterId: bookmark.data.chapterData.id,
                        position: bookmark.data.chapterData.elementQueryString,
                        title: bookmark.data.chapterData.chapterName,
                        createdAt: new Date(bookmark.data.date || 0),
                    });
                }
            }
        });
    }
}
