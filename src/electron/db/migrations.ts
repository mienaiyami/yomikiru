import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { app } from "electron";

/**
 * One Drizzle journal file that sqlite `migrate()` would still apply.
 * `tag` comes from `_journal.json` (`readMigrationFiles` does not include it).
 */
export type PendingDrizzleMigration = {
    tag: string;
    folderMillis: number;
    hash: string;
};

type JournalFile = {
    entries: { tag: string; when: number }[];
};

/**
 * Packaged vs unpackaged path to the `drizzle/` journal folder.
 * Same resolution {@link DatabaseService.initialize} uses for `migrate()`.
 */
export const getMigrationsFolder = (): string =>
    app.isPackaged ? path.join(path.dirname(app.getAppPath()), "drizzle") : "drizzle";

/**
 * True when `library_items` exists (any schema). Used to skip a pre-migrate snapshot
 * on a first-run file that the constructor just created.
 */
export const hasLibraryItemsTable = (sqlite: Database.Database): boolean => {
    const row = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get("library_items") as { name: string } | undefined;
    return Boolean(row);
};

/**
 * Journal files that Drizzle sqlite `migrate()` would apply on this connection.
 * Matches the shipped predicate: no `__drizzle_migrations` row, or last `created_at` older than `folderMillis`.
 *
 * @throws When `meta/_journal.json` or a `.sql` file is missing/unreadable (`readMigrationFiles`).
 */
export const listPendingDrizzleMigrations = (sqlite: Database.Database): PendingDrizzleMigration[] => {
    const folder = getMigrationsFolder();
    const files = readMigrationFiles({ migrationsFolder: folder });
    const journalPath = path.join(folder, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as JournalFile;
    const tagByWhen = new Map(journal.entries.map((entry) => [entry.when, entry.tag]));

    const table = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get("__drizzle_migrations") as { name: string } | undefined;

    let lastAppliedAt: number | undefined;
    if (table) {
        const row = sqlite
            .prepare(`SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`)
            .get() as { created_at: number | string } | undefined;
        if (row) lastAppliedAt = Number(row.created_at);
    }

    return files
        .filter((migration) => lastAppliedAt === undefined || lastAppliedAt < migration.folderMillis)
        .map((migration) => ({
            tag: tagByWhen.get(migration.folderMillis) ?? String(migration.folderMillis),
            folderMillis: migration.folderMillis,
            hash: migration.hash,
        }));
};
