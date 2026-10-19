import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { normalizeLegacyMangaDataBeforeMigration } from "./legacyNormalize";

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

/**
 * Opens a temp sqlite file and tracks the directory for cleanup.
 */
const openTempDb = (): Database.Database => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-legacy-"));
    tempDirs.push(dir);
    return new Database(path.join(dir, "legacy.db"));
};

describe("normalizeLegacyMangaDataBeforeMigration", () => {
    it("no-ops when library_items is missing or already migrated (has id)", () => {
        const db = openTempDb();
        normalizeLegacyMangaDataBeforeMigration(db);
        db.exec(`CREATE TABLE library_items (id INTEGER PRIMARY KEY, link TEXT)`);
        normalizeLegacyMangaDataBeforeMigration(db);
        db.close();
    });

    it("backfills bookmark chapterName from link basename and dedupes", () => {
        const db = openTempDb();
        /* path.join so path.basename works on both win32 and linux CI */
        const itemLink = path.join("testdata", "manga", "series");
        const chapterLinkA = path.join(itemLink, "ch01");
        const chapterLinkB = path.join(itemLink, "other", "ch01");
        const progressChapterLink = path.join(itemLink, "ch02");

        db.exec(`
            CREATE TABLE library_items (link TEXT PRIMARY KEY);
            CREATE TABLE manga_bookmarks (
                id INTEGER PRIMARY KEY,
                itemLink TEXT,
                link TEXT,
                chapterName TEXT,
                page INTEGER
            );
            CREATE TABLE manga_progress (
                itemLink TEXT PRIMARY KEY,
                chapterName TEXT,
                chapterLink TEXT
            );
        `);
        db.prepare(`INSERT INTO library_items (link) VALUES (?)`).run(itemLink);
        db.prepare(
            `INSERT INTO manga_bookmarks (id, itemLink, link, chapterName, page) VALUES (?, ?, ?, ?, ?)`,
        ).run(1, itemLink, chapterLinkA, "~", 1);
        db.prepare(
            `INSERT INTO manga_bookmarks (id, itemLink, link, chapterName, page) VALUES (?, ?, ?, ?, ?)`,
        ).run(2, itemLink, chapterLinkB, "~", 1);
        db.prepare(`INSERT INTO manga_progress (itemLink, chapterName, chapterLink) VALUES (?, ?, ?)`).run(
            itemLink,
            "",
            progressChapterLink,
        );

        normalizeLegacyMangaDataBeforeMigration(db);

        const bookmarks = db.prepare(`SELECT id, chapterName FROM manga_bookmarks ORDER BY id`).all() as {
            id: number;
            chapterName: string;
        }[];
        /* Both become chapterName "ch01" + same itemLink/page -> dedupe keeps MIN(id) */
        expect(bookmarks).toEqual([{ id: 1, chapterName: "ch01" }]);

        const progress = db.prepare(`SELECT chapterName FROM manga_progress`).get() as { chapterName: string };
        expect(progress.chapterName).toBe("ch02");
        db.close();
    });
});
