import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";

const { repoRoot } = vi.hoisted(() => ({
    repoRoot: process.cwd(),
}));

vi.mock("electron", () => ({
    app: {
        isPackaged: true,
        getAppPath: () => path.join(repoRoot, "package.json"),
    },
}));

import { getMigrationsFolder, hasLibraryItemsTable, listPendingDrizzleMigrations } from "./migrations";

const journalPath = path.join(repoRoot, "drizzle", "meta", "_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: { tag: string; when: number }[];
};
const journalTags = journal.entries.map((entry) => entry.tag);
const lastEntry = journal.entries[journal.entries.length - 1];
const secondLastEntry = journal.entries[journal.entries.length - 2];

type ProbeSqliteOpts = {
    tables: string[];
    lastCreatedAt?: number;
};

/**
 * Stand-in for better-sqlite3 that only implements the two `prepare().get()` shapes the probe uses.
 * Avoids the Electron vs system Node ABI rebuild required by native sqlite in this suite.
 */
const createProbeSqlite = (opts: ProbeSqliteOpts): Database.Database =>
    ({
        prepare: (sql: string) => ({
            get: (name?: string) => {
                if (sql.includes("sqlite_master")) {
                    return opts.tables.includes(String(name)) ? { name } : undefined;
                }
                if (sql.includes("__drizzle_migrations") && sql.includes("created_at")) {
                    if (opts.lastCreatedAt === undefined) return undefined;
                    return { created_at: opts.lastCreatedAt };
                }
                return undefined;
            },
        }),
    }) as unknown as Database.Database;

describe("getMigrationsFolder", () => {
    it("resolves the repo drizzle folder when packaged mock points at package.json", () => {
        expect(getMigrationsFolder()).toBe(path.join(repoRoot, "drizzle"));
        expect(fs.existsSync(path.join(getMigrationsFolder(), "meta", "_journal.json"))).toBe(true);
    });
});

describe("hasLibraryItemsTable", () => {
    it("is false until library_items is present", () => {
        expect(hasLibraryItemsTable(createProbeSqlite({ tables: [] }))).toBe(false);
        expect(hasLibraryItemsTable(createProbeSqlite({ tables: ["library_items"] }))).toBe(true);
    });
});

describe("listPendingDrizzleMigrations", () => {
    it("returns every journal tag when __drizzle_migrations is missing", () => {
        const pending = listPendingDrizzleMigrations(createProbeSqlite({ tables: [] }));
        expect(pending.map((row) => row.tag)).toEqual(journalTags);
        expect(pending.length).toBeGreaterThan(0);
    });

    it("returns only later tags when last created_at matches the second-newest journal when", () => {
        if (!secondLastEntry || !lastEntry) throw new Error("journal must have at least two entries");
        const pending = listPendingDrizzleMigrations(
            createProbeSqlite({
                tables: ["__drizzle_migrations"],
                lastCreatedAt: secondLastEntry.when,
            }),
        );
        expect(pending.map((row) => row.tag)).toEqual(
            journal.entries.filter((entry) => entry.when > secondLastEntry.when).map((entry) => entry.tag),
        );
        expect(pending.some((row) => row.tag === lastEntry.tag)).toBe(true);
    });

    it("returns an empty list when last created_at is at least the newest journal when", () => {
        if (!lastEntry) throw new Error("journal must have entries");
        expect(
            listPendingDrizzleMigrations(
                createProbeSqlite({
                    tables: ["__drizzle_migrations"],
                    lastCreatedAt: lastEntry.when,
                }),
            ),
        ).toEqual([]);
    });
});
