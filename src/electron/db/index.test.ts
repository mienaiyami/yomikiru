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

    it("adds a manga catalogue row without progress", async () => {
        const itemLink = path.join("testdata", "manga", "scan-only");
        const item = await dbService.addLibraryItem({
            type: "manga",
            data: {
                type: "manga",
                link: itemLink,
                title: "Unread Series",
            },
        });
        expect(item.link).toBe(itemLink);

        const progressRows = await dbService.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, itemLink));
        expect(progressRows).toEqual([]);

        await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: itemLink, title: "Unread Series" },
        });
        const stillNone = await dbService.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, itemLink));
        expect(stillNone).toEqual([]);
    });

    it("deleteProgressForLinks drops progress and keeps the catalogue row", async () => {
        const itemLink = path.join("testdata", "manga", "dummy-progress");
        await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: itemLink, title: "Dummy" },
            progress: { chapterName: "~", currentPage: 1, totalPages: 0 },
        });
        const deleted = await dbService.deleteProgressForLinks([itemLink]);
        expect(deleted).toBe(1);
        const [item] = await dbService.db.select().from(libraryItems).where(eq(libraryItems.link, itemLink));
        expect(item?.link).toBe(itemLink);
        const progressRows = await dbService.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, itemLink));
        expect(progressRows).toEqual([]);
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
        expect(await dbService.relocateLibraryItem(newLink, BOOK_LINK)).toBeNull();
        const stillManga = await dbService.db.select().from(libraryItems).where(eq(libraryItems.link, newLink));
        const stillBook = await dbService.db.select().from(libraryItems).where(eq(libraryItems.link, BOOK_LINK));
        expect(stillManga).toHaveLength(1);
        expect(stillBook).toHaveLength(1);
    });

    it("merges into an occupied path, keeping the keeper id and unioning chaptersRead", async () => {
        const keeperLink = path.join("testdata", "manga", "merge-keeper");
        const discardLink = path.join("testdata", "manga", "merge-discard");
        const keeper = await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: keeperLink, title: "Keeper Title" },
            progress: { chapterName: "ch1", currentPage: 5, totalPages: 10 },
        });
        await dbService.db
            .update(mangaProgress)
            .set({ chaptersRead: ["ch1"], lastReadAt: new Date(1_000) })
            .where(eq(mangaProgress.itemLink, keeperLink));
        await dbService.db.insert(mangaBookmarks).values({
            itemLink: keeperLink,
            chapterName: "ch1",
            page: 5,
        });

        const discard = await dbService.addLibraryItem({
            type: "manga",
            data: { type: "manga", link: discardLink, title: "Discard Title" },
            progress: { chapterName: "ch2", currentPage: 1, totalPages: 8 },
        });
        await dbService.db
            .update(mangaProgress)
            .set({ chaptersRead: ["ch2"], lastReadAt: new Date(2_000) })
            .where(eq(mangaProgress.itemLink, discardLink));
        await dbService.db.insert(mangaBookmarks).values({
            itemLink: discardLink,
            chapterName: "ch2",
            page: 1,
        });

        const [tagKeeper] = await dbService.db
            .insert(libraryTags)
            .values({ name: "MergeKeeper", color: "#111111" })
            .returning();
        const [tagDiscard] = await dbService.db
            .insert(libraryTags)
            .values({ name: "MergeDiscard", color: "#222222" })
            .returning();
        const [tagBoth] = await dbService.db
            .insert(libraryTags)
            .values({ name: "MergeBoth", color: "#333333" })
            .returning();
        await dbService.db.insert(libraryItemTags).values([
            { itemLink: keeperLink, tagId: tagKeeper.id },
            { itemLink: keeperLink, tagId: tagBoth.id },
            { itemLink: discardLink, tagId: tagDiscard.id },
            { itemLink: discardLink, tagId: tagBoth.id },
        ]);

        const merged = await dbService.relocateLibraryItem(keeperLink, discardLink);
        expect(merged?.id).toBe(keeper.id);
        expect(merged?.link).toBe(discardLink);
        expect(merged?.title).toBe("Keeper Title");

        const gone = await dbService.db.select().from(libraryItems).where(eq(libraryItems.link, keeperLink));
        expect(gone).toHaveLength(0);
        expect(discard.id).not.toBe(keeper.id);

        const [progress] = await dbService.db
            .select()
            .from(mangaProgress)
            .where(eq(mangaProgress.itemLink, discardLink));
        expect(progress?.chapterName).toBe("ch2");
        expect(progress?.currentPage).toBe(1);
        expect(progress?.chaptersRead.sort()).toEqual(["ch1", "ch2"]);

        const bookmarks = await dbService.db
            .select()
            .from(mangaBookmarks)
            .where(eq(mangaBookmarks.itemLink, discardLink));
        expect(bookmarks).toHaveLength(2);

        const tags = await dbService.db
            .select()
            .from(libraryItemTags)
            .where(eq(libraryItemTags.itemLink, discardLink));
        expect(tags.map((row) => row.tagId).sort()).toEqual(
            [tagKeeper.id, tagDiscard.id, tagBoth.id].sort(),
        );
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
