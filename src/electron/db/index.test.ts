import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { tmpUserData, repoRoot } = vi.hoisted(() => {
    const fsHoisted = require("node:fs") as typeof import("node:fs");
    const osHoisted = require("node:os") as typeof import("node:os");
    const pathHoisted = require("node:path") as typeof import("node:path");
    return {
        tmpUserData: fsHoisted.mkdtempSync(pathHoisted.join(osHoisted.tmpdir(), "yomikiru-dbsvc-")),
        // vitest runs with cwd = repo root
        repoRoot: process.cwd(),
    };
});

vi.mock("electron", () => ({
    app: {
        isPackaged: true,
        getPath: (name: string) => (name === "userData" ? tmpUserData : path.join(tmpUserData, name)),
        // dirname(getAppPath()) + "/drizzle" -> repo drizzle folder
        getAppPath: () => path.join(repoRoot, "package.json"),
        setPath: vi.fn(),
    },
    dialog: {
        showErrorBox: vi.fn(),
    },
    BrowserWindow: vi.fn(),
}));

/* Avoid loading util/index side effects (portable userData + electron-log setup). */
vi.mock("../util", () => ({
    electronOnly: () => undefined,
    dateFromOldDateString: (value: string) => new Date(value),
}));

vi.mock("../util/logger", () => ({
    createMainLogger: () => ({
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
    }),
}));

import { eq } from "drizzle-orm";
import { DatabaseService } from "./index";
import {
    itemTrackers,
    libraryItemMetadata,
    libraryItems,
    libraryItemTags,
    libraryTags,
    mangaBookmarks,
    mangaProgress,
} from "./schema";

/** Cross-platform sample paths for db integration tests. */
const MANGA_LINK = path.join("testdata", "manga", "series-a");
const BOOK_LINK = path.join("testdata", "books", "novel-a.epub");

describe("DatabaseService", () => {
    const dbService = new DatabaseService();

    beforeAll(async () => {
        await dbService.initialize();
    });

    afterAll(() => {
        try {
            fs.rmSync(tmpUserData, { recursive: true, force: true });
        } catch {
            /* windows: better-sqlite3 may still hold the file until process exit */
        }
    });

    it("adds a manga library item with progress in a transaction", async () => {
        const item = await dbService.addLibraryItem({
            type: "manga",
            data: {
                type: "manga",
                link: MANGA_LINK,
                title: "Series A",
            },
            progress: {
                chapterName: "ch1",
                currentPage: 2,
                totalPages: 12,
            },
        });
        expect(item.link).toBe(MANGA_LINK);
        expect(item.type).toBe("manga");

        const [progress] = await dbService.updateMangaProgress({
            itemLink: item.link,
            currentPage: 5,
            chapterName: "ch2",
        });
        expect(progress?.currentPage).toBe(5);
        expect(progress?.chapterName).toBe("ch2");
    });

    it("keeps stored author, cover, and progress when an existing item is re-added", async () => {
        const itemLink = path.join("testdata", "manga", "re-add");
        await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: itemLink, title: "Old Title" },
            progress: { chapterName: "ch5", currentPage: 7, totalPages: 20 },
        });
        await dbService.db
            .update(libraryItems)
            .set({ author: "Stored Author", cover: path.join("custom", "cover.png") })
            .where(eq(libraryItems.link, itemLink));

        /* Readers echo a whole row back on open: manga always sends a null author and a derived cover. */
        const readded = await dbService.addLibraryItem({
            type: "manga",
            data: {
                type: "manga",
                link: itemLink,
                title: "New Title",
                author: null,
                cover: path.join("derived", "cover.png"),
            },
            progress: { chapterName: "ch1", currentPage: 1, totalPages: 20 },
        });

        expect(readded.title).toBe("New Title");
        expect(readded.author).toBe("Stored Author");
        expect(readded.cover).toBe(path.join("custom", "cover.png"));

        const [progress] = await dbService.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, itemLink));
        expect(progress?.chapterName).toBe("ch5");
        expect(progress?.currentPage).toBe(7);
    });

    it("updating only title does not null author, note, or extra", async () => {
        const itemLink = path.join("testdata", "manga", "partial-update");
        await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: itemLink, title: "Before" },
            progress: { chapterName: "ch1", currentPage: 1, totalPages: 3 },
        });
        await dbService.db
            .update(libraryItems)
            .set({ author: "Keep Me", note: "a note", extra: { k: 1 } })
            .where(eq(libraryItems.link, itemLink));

        /* omitted keys stay stored; IPC also strips explicit undefined via omitUndefined */
        await dbService.db.update(libraryItems).set({ title: "After" }).where(eq(libraryItems.link, itemLink));

        const [row] = await dbService.db.select().from(libraryItems).where(eq(libraryItems.link, itemLink));
        expect(row?.title).toBe("After");
        expect(row?.author).toBe("Keep Me");
        expect(row?.note).toBe("a note");
        expect(row?.extra).toEqual({ k: 1 });
        expect(row?.favouritedAt).toBeNull();
    });

    it("adds a book library item and updates progress", async () => {
        const item = await dbService.addLibraryItem({
            type: "book",
            data: {
                type: "book",
                link: BOOK_LINK,
                title: "Novel A",
            },
            progress: {
                chapterId: "c1",
                chapterName: "One",
                position: "body>p:nth-child(1)",
            },
        });
        expect(item.type).toBe("book");

        const [progress] = await dbService.updateBookProgress({
            itemLink: item.link,
            position: "body>p:nth-child(9)",
            chapterId: "c2",
        });
        expect(progress?.position).toBe("body>p:nth-child(9)");
        expect(progress?.chapterId).toBe("c2");
    });

    it("relocates a manga library path and rewrites progress and bookmark itemLink", async () => {
        const oldLink = path.join("testdata", "manga", "relocate-old");
        const newLink = path.join("testdata", "manga", "relocate-new");
        const item = await dbService.addLibraryItem({
            type: "manga",
            data: {
                type: "manga",
                link: oldLink,
                title: "Relocate Me",
            },
            progress: {
                chapterName: "ch1",
                currentPage: 3,
                totalPages: 10,
            },
        });
        const idBefore = item.id;
        await dbService.db.insert(mangaBookmarks).values({
            itemLink: oldLink,
            chapterName: "ch1",
            page: 3,
        });

        const relocated = await dbService.relocateLibraryItem(oldLink, newLink);
        expect(relocated?.link).toBe(newLink);
        expect(relocated?.id).toBe(idBefore);

        const [progress] = await dbService.updateMangaProgress({
            itemLink: newLink,
            currentPage: 4,
            chapterName: "ch1",
        });
        expect(progress?.itemLink).toBe(newLink);
        expect(progress?.currentPage).toBe(4);

        const bookmarks = await dbService.db
            .select()
            .from(mangaBookmarks)
            .where(eq(mangaBookmarks.itemLink, newLink));
        expect(bookmarks).toHaveLength(1);
        expect(bookmarks[0]?.chapterName).toBe("ch1");

        expect(await dbService.relocateLibraryItem(oldLink, path.join("testdata", "manga", "gone"))).toBeNull();
        expect(await dbService.relocateLibraryItem(newLink, MANGA_LINK)).toBeNull();
    });

    it("updates a manga bookmark chapterName in place (locate-chapter rewrite)", async () => {
        const itemLink = path.join("testdata", "manga", "bookmark-update");
        await dbService.addLibraryItem({
            type: "manga",
            data: {
                type: "manga",
                link: itemLink,
                title: "Bookmark Update",
            },
            progress: {
                chapterName: "old-ch",
                currentPage: 1,
                totalPages: 5,
            },
        });
        const [bookmark] = await dbService.db
            .insert(mangaBookmarks)
            .values({
                itemLink,
                chapterName: "old-ch",
                page: 2,
            })
            .returning();

        const [updated] = await dbService.db
            .update(mangaBookmarks)
            .set({ chapterName: "new-ch" })
            .where(eq(mangaBookmarks.id, bookmark.id))
            .returning();

        expect(updated?.chapterName).toBe("new-ch");
        expect(updated?.page).toBe(2);
        expect(updated?.itemLink).toBe(itemLink);
    });

    it("rewrites tracker and metadata itemLink on relocate and cascades on delete", async () => {
        const oldLink = path.join("testdata", "manga", "tracker-old");
        const newLink = path.join("testdata", "manga", "tracker-new");
        await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: oldLink, title: "Tracked" },
            progress: { chapterName: "ch1", currentPage: 1, totalPages: 2 },
        });
        await dbService.db.insert(itemTrackers).values({
            itemLink: oldLink,
            provider: "anilist",
            remoteId: "99",
        });
        await dbService.db.insert(libraryItemMetadata).values({
            itemLink: oldLink,
            source: "user",
            description: "note",
        });

        const relocated = await dbService.relocateLibraryItem(oldLink, newLink);
        expect(relocated?.link).toBe(newLink);

        const trackers = await dbService.db.select().from(itemTrackers).where(eq(itemTrackers.itemLink, newLink));
        expect(trackers).toHaveLength(1);
        expect(trackers[0]?.remoteId).toBe("99");

        const meta = await dbService.db
            .select()
            .from(libraryItemMetadata)
            .where(eq(libraryItemMetadata.itemLink, newLink));
        expect(meta).toHaveLength(1);
        expect(meta[0]?.description).toBe("note");

        await dbService.db.delete(libraryItems).where(eq(libraryItems.link, newLink));
        expect(await dbService.db.select().from(itemTrackers).where(eq(itemTrackers.itemLink, newLink))).toEqual(
            [],
        );
        expect(
            await dbService.db.select().from(libraryItemMetadata).where(eq(libraryItemMetadata.itemLink, newLink)),
        ).toEqual([]);
    });

    it("enforces case-insensitive unique tag names and rewrites assignments on relocate", async () => {
        const oldLink = path.join("testdata", "manga", "tag-old");
        const newLink = path.join("testdata", "manga", "tag-new");
        await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: oldLink, title: "Tagged" },
            progress: { chapterName: "ch1", currentPage: 1, totalPages: 2 },
        });
        const [tag] = await dbService.db
            .insert(libraryTags)
            .values({ name: "Ongoing", color: "#2563eb" })
            .returning();
        await dbService.db.insert(libraryItemTags).values({ itemLink: oldLink, tagId: tag.id });

        await expect(
            dbService.db.insert(libraryTags).values({ name: "ongoing", color: "#dc2626" }),
        ).rejects.toThrow();

        const relocated = await dbService.relocateLibraryItem(oldLink, newLink);
        expect(relocated?.link).toBe(newLink);
        const assignments = await dbService.db
            .select()
            .from(libraryItemTags)
            .where(eq(libraryItemTags.itemLink, newLink));
        expect(assignments).toHaveLength(1);
        expect(assignments[0]?.tagId).toBe(tag.id);

        await dbService.db.delete(libraryItems).where(eq(libraryItems.link, newLink));
        expect(
            await dbService.db.select().from(libraryItemTags).where(eq(libraryItemTags.itemLink, newLink)),
        ).toEqual([]);
        expect(await dbService.db.select().from(libraryTags).where(eq(libraryTags.id, tag.id))).toHaveLength(1);

        await dbService.db.delete(libraryTags).where(eq(libraryTags.id, tag.id));
    });

    it("rejects a second tracker row for the same item and provider", async () => {
        const itemLink = path.join("testdata", "manga", "tracker-unique");
        await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: itemLink, title: "Unique" },
            progress: { chapterName: "ch1", currentPage: 1, totalPages: 2 },
        });
        await dbService.db.insert(itemTrackers).values({
            itemLink,
            provider: "anilist",
            remoteId: "1",
        });
        await expect(
            dbService.db.insert(itemTrackers).values({
                itemLink,
                provider: "anilist",
                remoteId: "2",
            }),
        ).rejects.toThrow();
    });
});
