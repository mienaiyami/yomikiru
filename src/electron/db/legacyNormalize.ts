import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { createMainLogger } from "../util/logger";

const logger = createMainLogger("db/legacyNormalize");

type SqliteConnection = InstanceType<typeof BetterSqlite3>;

/**
 * Why `normalizeMangaBookmarksAndProgressBefore0001` exists (even when most prod rows look "clean"):
 *
 * - **chapterName backfill**: Old rows could have `chapterName` empty or `"~"`. The app resolves chapters as
 *   `path.join(itemLink, chapterName)` where `chapterName` is the direct child name. Without fixing, bookmarks
 *   or progress would point at the wrong path after `link` / `chapterLink` columns are dropped.
 * - **Bookmark dedupe**: The old unique key was `(link, page)`. The new key is `(itemLink, chapterName, page)`.
 *   Rare legacy cases (or imports) can produce two rows with the same triple but different `link`; SQLite would
 *   fail when creating the new unique index. Dedupe keeps `MIN(id)` and logs how many rows were removed.
 *
 * If every row already has a proper `chapterName` and no duplicate triples, this step only scans and exits cheaply.
 */
export function normalizeLegacyMangaDataBeforeMigration(sqlite: SqliteConnection): void {
    const table = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get("library_items") as { name: string } | undefined;
    if (!table) return;

    const libCols = sqlite.prepare(`PRAGMA table_info(library_items)`).all() as { name: string }[];
    if (libCols.some((c) => c.name === "id")) return;

    const bmCols = sqlite.prepare(`PRAGMA table_info(manga_bookmarks)`).all() as { name: string }[];
    const bmHasLink = bmCols.some((c) => c.name === "link");
    const progCols = sqlite.prepare(`PRAGMA table_info(manga_progress)`).all() as { name: string }[];
    const progHasChapterLink = progCols.some((c) => c.name === "chapterLink");

    if (!bmHasLink && !progHasChapterLink) return;

    const run = sqlite.transaction(() => {
        if (bmHasLink) {
            const before = (sqlite.prepare(`SELECT COUNT(*) AS c FROM manga_bookmarks`).get() as { c: number }).c;
            const rows = sqlite.prepare(`SELECT id, link, chapterName FROM manga_bookmarks`).all() as {
                id: number;
                link: string;
                chapterName: string;
            }[];
            const upd = sqlite.prepare(`UPDATE manga_bookmarks SET chapterName = ? WHERE id = ?`);
            for (const row of rows) {
                let cn = (row.chapterName ?? "").trim();
                if (!cn || cn === "~") cn = path.basename(row.link);
                upd.run(cn, row.id);
            }
            sqlite.exec(`
                DELETE FROM manga_bookmarks
                WHERE id NOT IN (
                    SELECT MIN(id) FROM manga_bookmarks GROUP BY itemLink, chapterName, page
                )
            `);
            const after = (sqlite.prepare(`SELECT COUNT(*) AS c FROM manga_bookmarks`).get() as { c: number }).c;
            const removed = before - after;
            if (removed > 0) {
                logger.log(`Legacy manga_bookmarks dedupe: removed ${removed} duplicate row(s) before migration`);
            }
        }
        if (progHasChapterLink) {
            const rows = sqlite.prepare(`SELECT itemLink, chapterName, chapterLink FROM manga_progress`).all() as {
                itemLink: string;
                chapterName: string;
                chapterLink: string;
            }[];
            const upd = sqlite.prepare(`UPDATE manga_progress SET chapterName = ? WHERE itemLink = ?`);
            for (const row of rows) {
                let cn = (row.chapterName ?? "").trim();
                if (!cn || cn === "~") cn = path.basename(row.chapterLink);
                upd.run(cn, row.itemLink);
            }
        }
    });
    run();
}
