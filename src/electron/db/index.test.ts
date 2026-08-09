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
import { mangaBookmarks } from "./schema";

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
});
