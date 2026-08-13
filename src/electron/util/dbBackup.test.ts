import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { tmpUserData, dbPath, showMessageBox, relaunch, quit, powerMonitorOn, powerMonitorOff, DatabaseMock } =
    vi.hoisted(() => {
        const fsHoisted = require("node:fs") as typeof import("node:fs");
        const osHoisted = require("node:os") as typeof import("node:os");
        const pathHoisted = require("node:path") as typeof import("node:path");
        const tmp = fsHoisted.mkdtempSync(pathHoisted.join(osHoisted.tmpdir(), "yomikiru-dbbackup-"));

        /**
         * Stand-in for better-sqlite3: integrity is driven by file magic, backup is a copy.
         * Avoids Electron vs system Node ABI rebuild for this suite.
         */
        const DatabaseMock = vi.fn(function MockDatabase(
            this: {
                filePath: string;
                backup: (dest: string) => Promise<void>;
                pragma: (key: string, opts?: { simple?: boolean }) => string;
                close: () => void;
            },
            filePath: string,
        ) {
            this.filePath = filePath;
            this.backup = async (dest: string) => {
                fsHoisted.copyFileSync(filePath, dest);
            };
            this.pragma = (key: string) => {
                if (key !== "integrity_check") return "";
                const body = fsHoisted.readFileSync(filePath, "utf-8");
                return body.startsWith("OK:") ? "ok" : "fail";
            };
            this.close = vi.fn();
        });

        return {
            tmpUserData: tmp,
            dbPath: pathHoisted.join(tmp, "data.db"),
            showMessageBox: vi.fn(async () => ({ response: 0 })),
            relaunch: vi.fn(),
            quit: vi.fn(),
            powerMonitorOn: vi.fn(),
            powerMonitorOff: vi.fn(),
            DatabaseMock,
        };
    });

type DbBackupSettingsState = {
    enabled: boolean;
    intervalHours: number;
    keepCount: number;
    lastSuccessAt: number;
};

const mainSettingsState = vi.hoisted(() => {
    const state: { dbBackup: DbBackupSettingsState } = {
        dbBackup: {
            enabled: true,
            intervalHours: 1,
            keepCount: 10,
            lastSuccessAt: 0,
        },
    };
    return {
        state,
        reset: () => {
            state.dbBackup = {
                enabled: true,
                intervalHours: 1,
                keepCount: 10,
                lastSuccessAt: 0,
            };
        },
    };
});

vi.mock("better-sqlite3", () => ({
    default: DatabaseMock,
}));

vi.mock("electron", () => ({
    app: {
        isPackaged: true,
        getPath: (name: string) => (name === "userData" ? tmpUserData : path.join(tmpUserData, name)),
        relaunch,
        quit,
    },
    dialog: {
        showMessageBox,
    },
    powerMonitor: {
        on: powerMonitorOn,
        off: powerMonitorOff,
    },
}));

vi.mock("@electron/util/logger", () => ({
    createMainLogger: () => ({
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
    }),
}));

vi.mock("@electron/i18n/mainI18n", () => ({
    mainT: (key: string, opts?: { fileName?: string; error?: string }) => {
        if (opts?.fileName) return `${key}:${opts.fileName}`;
        if (opts?.error) return `${key}:${opts.error}`;
        return key;
    },
}));

vi.mock("@electron/db", () => ({
    DB_PATH: dbPath,
}));

vi.mock("@electron/util/mainSettings", () => ({
    MainSettings: {
        get settings() {
            return {
                dbBackup: { ...mainSettingsState.state.dbBackup },
            };
        },
        updateSettings: async (partial: { dbBackup?: Partial<DbBackupSettingsState> }) => {
            if (partial.dbBackup) {
                mainSettingsState.state.dbBackup = {
                    ...mainSettingsState.state.dbBackup,
                    ...partial.dbBackup,
                };
            }
        },
    },
}));

import type Database from "better-sqlite3";
import {
    applyPendingRestore,
    cleanTmpFiles,
    createBackup,
    createBackupIfDue,
    getBackupsDir,
    getDbBackupStatus,
    isBackupDue,
    listBackups,
    parseBackupFileName,
    BACKUP_NAME_RE,
    pruneBackups,
    importAndRestoreFromPath,
    queueRestoreAndRelaunch,
    setLiveSqlite,
    startScheduler,
    stopScheduler,
} from "./dbBackup";

const backupsDir = (): string => getBackupsDir();
const pendingPath = (): string => path.join(backupsDir(), "restore-pending.json");

/** Writes a fake DB file. Prefix `OK:` passes mocked integrity_check. */
const writeMarkerDb = (filePath: string, marker: string, intact = true): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${intact ? "OK" : "BAD"}:${marker}`, "utf-8");
};

const readMarker = (filePath: string): string => {
    const body = fs.readFileSync(filePath, "utf-8");
    const idx = body.indexOf(":");
    return idx >= 0 ? body.slice(idx + 1) : body;
};

const writePublishedBackup = (createdAtMs: number, marker: string, intact = true): string => {
    const dir = backupsDir();
    fs.mkdirSync(dir, { recursive: true });
    const name = `data-${createdAtMs}.db`;
    writeMarkerDb(path.join(dir, name), marker, intact);
    return name;
};

const resetWorkspace = (): void => {
    mainSettingsState.reset();
    setLiveSqlite(null);
    DatabaseMock.mockClear();
    showMessageBox.mockClear();
    relaunch.mockClear();
    quit.mockClear();
    powerMonitorOn.mockClear();
    powerMonitorOff.mockClear();

    for (const name of ["data.db", "data.db.tmp"]) {
        const p = path.join(tmpUserData, name);
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    }
    const dir = path.join(tmpUserData, "backups");
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

describe("dbBackup", () => {
    describe("parseBackupFileName", () => {
        it("returns unix ms for published backup names", () => {
            expect(parseBackupFileName("data-1723089012000.db")).toBe(1723089012000);
            expect(parseBackupFileName("data-0.db")).toBe(0);
        });

        it("rejects tmp, pending, and unrelated names", () => {
            expect(parseBackupFileName("data-1723089012000.db.tmp")).toBeNull();
            expect(parseBackupFileName("restore-pending.json")).toBeNull();
            expect(parseBackupFileName("data.db")).toBeNull();
            expect(parseBackupFileName("data-abc.db")).toBeNull();
            expect(BACKUP_NAME_RE.test("data-1.db")).toBe(true);
            expect(BACKUP_NAME_RE.test("data-1.db.tmp")).toBe(false);
        });
    });

    beforeEach(async () => {
        await stopScheduler();
        resetWorkspace();
    });

    afterEach(async () => {
        await stopScheduler();
        setLiveSqlite(null);
    });

    afterAll(() => {
        try {
            fs.rmSync(tmpUserData, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    describe("list / prune / cleanTmp", () => {
        it("lists published backups newest-first and ignores tmp/pending", () => {
            writePublishedBackup(1000, "a");
            writePublishedBackup(3000, "c");
            writePublishedBackup(2000, "b");
            fs.writeFileSync(path.join(backupsDir(), "data-9999.db.tmp"), "tmp");
            fs.writeFileSync(pendingPath(), JSON.stringify({ source: "data-1000.db" }));

            const listed = listBackups();
            expect(listed.map((i) => i.fileName)).toEqual(["data-3000.db", "data-2000.db", "data-1000.db"]);
            expect(listed.every((i) => i.byteSize > 0)).toBe(true);
        });

        it("prunes using dbBackup.keepCount and leaves pending + tmp alone", () => {
            mainSettingsState.state.dbBackup.keepCount = 3;
            for (let i = 1; i <= 5; i++) {
                writePublishedBackup(i * 1000, `m${i}`);
            }
            fs.writeFileSync(path.join(backupsDir(), "data-1.db.tmp"), "tmp");
            fs.writeFileSync(pendingPath(), "{}");

            pruneBackups();

            expect(listBackups()).toHaveLength(3);
            expect(listBackups().map((i) => i.createdAtMs)).toEqual([5000, 4000, 3000]);
            expect(fs.existsSync(path.join(backupsDir(), "data-1.db.tmp"))).toBe(true);
            expect(fs.existsSync(pendingPath())).toBe(true);
        });

        it("cleanTmpFiles removes only data-*.db.tmp", () => {
            writePublishedBackup(1000, "keep");
            fs.writeFileSync(path.join(backupsDir(), "data-1000.db.tmp"), "tmp");
            fs.writeFileSync(path.join(backupsDir(), "other.tmp"), "other");
            fs.writeFileSync(pendingPath(), "{}");

            cleanTmpFiles();

            expect(fs.existsSync(path.join(backupsDir(), "data-1000.db.tmp"))).toBe(false);
            expect(fs.existsSync(path.join(backupsDir(), "data-1000.db"))).toBe(true);
            expect(fs.existsSync(path.join(backupsDir(), "other.tmp"))).toBe(true);
            expect(fs.existsSync(pendingPath())).toBe(true);
        });
    });

    describe("due / status", () => {
        it("isBackupDue is false when disabled", () => {
            mainSettingsState.state.dbBackup.enabled = false;
            mainSettingsState.state.dbBackup.lastSuccessAt = 0;
            expect(isBackupDue()).toBe(false);
        });

        it("isBackupDue respects intervalHours since lastSuccessAt", () => {
            mainSettingsState.state.dbBackup.enabled = true;
            mainSettingsState.state.dbBackup.intervalHours = 2;
            mainSettingsState.state.dbBackup.lastSuccessAt = Date.now() - 3_600_000;
            expect(isBackupDue()).toBe(false);

            mainSettingsState.state.dbBackup.lastSuccessAt = Date.now() - 3 * 3_600_000;
            expect(isBackupDue()).toBe(true);
        });

        it("getDbBackupStatus mirrors settings and idle flag", () => {
            mainSettingsState.state.dbBackup = {
                enabled: false,
                intervalHours: 24,
                keepCount: 15,
                lastSuccessAt: 42,
            };
            expect(getDbBackupStatus()).toEqual({
                enabled: false,
                intervalHours: 24,
                keepCount: 15,
                lastSuccessAt: 42,
                isBackingUp: false,
            });
        });
    });

    describe("createBackup", () => {
        it("skips when data.db is missing and does not bump lastSuccessAt", async () => {
            const ok = await createBackup();
            expect(ok).toBe(false);
            expect(mainSettingsState.state.dbBackup.lastSuccessAt).toBe(0);
            expect(listBackups()).toHaveLength(0);
        });

        it("publishes data-<unixMs>.db, prunes, and advances lastSuccessAt", async () => {
            writeMarkerDb(dbPath, "live-v1");
            const keep = mainSettingsState.state.dbBackup.keepCount;
            for (let i = 1; i <= keep; i++) {
                writePublishedBackup(i * 1000, `old${i}`);
            }

            const before = Date.now();
            const ok = await createBackup();
            const after = Date.now();

            expect(ok).toBe(true);
            expect(listBackups()).toHaveLength(keep);
            const newest = listBackups()[0];
            expect(newest).toBeDefined();
            expect(newest!.createdAtMs).toBeGreaterThanOrEqual(before);
            expect(newest!.createdAtMs).toBeLessThanOrEqual(after);
            expect(readMarker(path.join(backupsDir(), newest!.fileName))).toBe("live-v1");
            expect(mainSettingsState.state.dbBackup.lastSuccessAt).toBe(newest!.createdAtMs);
            expect(fs.existsSync(path.join(backupsDir(), "data-1000.db"))).toBe(false);
            expect(fs.readdirSync(backupsDir()).some((n) => n.endsWith(".tmp"))).toBe(false);
            /* live DB must remain readable and unchanged after a successful backup */
            expect(readMarker(dbPath)).toBe("live-v1");
        });

        it("uses live sqlite handle when registered", async () => {
            writeMarkerDb(dbPath, "owned-path");
            const livePath = path.join(tmpUserData, "live-source.db");
            writeMarkerDb(livePath, "from-live");
            const live = {
                backup: async (dest: string) => {
                    fs.copyFileSync(livePath, dest);
                },
            } as unknown as Database.Database;
            setLiveSqlite(live);

            expect(await createBackup()).toBe(true);
            const newest = listBackups()[0]!;
            expect(readMarker(path.join(backupsDir(), newest.fileName))).toBe("from-live");
            expect(DatabaseMock).not.toHaveBeenCalled();
        });

        it("does not bump lastSuccessAt when backup() fails and leaves no tmp", async () => {
            writeMarkerDb(dbPath, "live");
            const failing = {
                backup: vi.fn(async () => {
                    throw new Error("backup boom");
                }),
            } as unknown as Database.Database;
            setLiveSqlite(failing);

            const ok = await createBackup();
            expect(ok).toBe(false);
            expect(mainSettingsState.state.dbBackup.lastSuccessAt).toBe(0);
            expect(listBackups()).toHaveLength(0);
            expect(fs.existsSync(backupsDir()) ? fs.readdirSync(backupsDir()) : []).toEqual([]);
        });

        it("rejects overlapping createBackup while one is in flight", async () => {
            writeMarkerDb(dbPath, "live");
            let release!: () => void;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const slow = {
                backup: vi.fn(async (dest: string) => {
                    await gate;
                    fs.copyFileSync(dbPath, dest);
                }),
            } as unknown as Database.Database;
            setLiveSqlite(slow);

            const first = createBackup();
            await vi.waitFor(() => expect(slow.backup).toHaveBeenCalled());
            const second = await createBackup();
            expect(second).toBe(false);
            release();
            expect(await first).toBe(true);
        });

        it("createBackupIfDue no-ops when not due", async () => {
            writeMarkerDb(dbPath, "live");
            mainSettingsState.state.dbBackup.lastSuccessAt = Date.now();
            mainSettingsState.state.dbBackup.intervalHours = 168;
            expect(await createBackupIfDue()).toBe(false);
            expect(listBackups()).toHaveLength(0);
        });

        it("createBackupIfDue runs when due", async () => {
            writeMarkerDb(dbPath, "live");
            mainSettingsState.state.dbBackup.lastSuccessAt = 0;
            mainSettingsState.state.dbBackup.intervalHours = 1;
            expect(await createBackupIfDue()).toBe(true);
            expect(listBackups()).toHaveLength(1);
        });
    });

    describe("importAndRestoreFromPath", () => {
        it("rejects missing files without writing pending", async () => {
            const res = await importAndRestoreFromPath(path.join(tmpUserData, "nope.db"));
            expect(res).toEqual({ ok: false, code: "notFound" });
            expect(fs.existsSync(pendingPath())).toBe(false);
            expect(quit).not.toHaveBeenCalled();
        });

        it("rejects corrupt files without copying into backups", async () => {
            const external = path.join(tmpUserData, "external-bad.db");
            writeMarkerDb(external, "bad", false);
            const res = await importAndRestoreFromPath(external);
            expect(res.ok).toBe(false);
            if (!res.ok) expect(res.code).toBe("integrityFailed");
            expect(listBackups()).toHaveLength(0);
            expect(quit).not.toHaveBeenCalled();
        });

        it("copies an external db into backups then queues restore", async () => {
            const external = path.join(tmpUserData, "external-good.db");
            writeMarkerDb(external, "imported");
            const before = Date.now();
            const res = await importAndRestoreFromPath(external);
            expect(res).toEqual({ ok: true });
            const listed = listBackups();
            expect(listed).toHaveLength(1);
            expect(listed[0]!.createdAtMs).toBeGreaterThanOrEqual(before);
            expect(readMarker(path.join(backupsDir(), listed[0]!.fileName))).toBe("imported");
            expect(JSON.parse(fs.readFileSync(pendingPath(), "utf-8"))).toEqual({
                source: listed[0]!.fileName,
            });
            expect(relaunch).toHaveBeenCalledTimes(1);
            expect(quit).toHaveBeenCalledTimes(1);
        });
    });

    describe("queueRestoreAndRelaunch", () => {
        it("rejects invalid names without writing pending or quitting", async () => {
            writePublishedBackup(1000, "a");
            const res = await queueRestoreAndRelaunch("not-a-backup.db");
            expect(res).toEqual({ ok: false, code: "invalidName" });
            expect(fs.existsSync(pendingPath())).toBe(false);
            expect(relaunch).not.toHaveBeenCalled();
            expect(quit).not.toHaveBeenCalled();
        });

        it("strips path segments so ../ cannot escape the backups directory", async () => {
            writePublishedBackup(1000, "a");
            const res = await queueRestoreAndRelaunch(path.join("..", "data-1000.db"));
            expect(res).toEqual({ ok: true });
            expect(JSON.parse(fs.readFileSync(pendingPath(), "utf-8"))).toEqual({ source: "data-1000.db" });
            expect(relaunch).toHaveBeenCalledTimes(1);
            expect(quit).toHaveBeenCalledTimes(1);
        });

        it("rejects missing backup files", async () => {
            const res = await queueRestoreAndRelaunch("data-999.db");
            expect(res).toEqual({ ok: false, code: "notFound" });
            expect(quit).not.toHaveBeenCalled();
        });

        it("writes restore-pending.json then relaunches and quits", async () => {
            const name = writePublishedBackup(1000, "snap");
            const res = await queueRestoreAndRelaunch(name);
            expect(res).toEqual({ ok: true });
            expect(JSON.parse(fs.readFileSync(pendingPath(), "utf-8"))).toEqual({ source: name });
            expect(relaunch).toHaveBeenCalledTimes(1);
            expect(quit).toHaveBeenCalledTimes(1);
        });
    });

    describe("applyPendingRestore", () => {
        it("is a no-op without pending file", async () => {
            writeMarkerDb(dbPath, "live");
            await applyPendingRestore();
            expect(readMarker(dbPath)).toBe("live");
            expect(showMessageBox).not.toHaveBeenCalled();
        });

        it("clears unreadable pending without touching live DB", async () => {
            writeMarkerDb(dbPath, "live");
            fs.mkdirSync(backupsDir(), { recursive: true });
            fs.writeFileSync(pendingPath(), "{not-json");

            await applyPendingRestore();

            expect(fs.existsSync(pendingPath())).toBe(false);
            expect(readMarker(dbPath)).toBe("live");
            expect(showMessageBox).not.toHaveBeenCalled();
        });

        it("missing source: dialog, clear pending, leave live DB unchanged", async () => {
            writeMarkerDb(dbPath, "live");
            fs.mkdirSync(backupsDir(), { recursive: true });
            fs.writeFileSync(pendingPath(), JSON.stringify({ source: "data-404.db" }));

            await applyPendingRestore();

            expect(fs.existsSync(pendingPath())).toBe(false);
            expect(readMarker(dbPath)).toBe("live");
            expect(showMessageBox).toHaveBeenCalledTimes(1);
        });

        it("integrity failure: dialog, clear pending, leave live DB unchanged (no relaunch loop)", async () => {
            writeMarkerDb(dbPath, "live");
            const corruptName = writePublishedBackup(5000, "corrupt", false);
            fs.writeFileSync(pendingPath(), JSON.stringify({ source: corruptName }));

            await applyPendingRestore();

            expect(fs.existsSync(pendingPath())).toBe(false);
            expect(readMarker(dbPath)).toBe("live");
            expect(showMessageBox).toHaveBeenCalledTimes(1);
            expect(listBackups().some((i) => i.fileName === corruptName)).toBe(true);
        });

        it("restores marker content and clears pending", async () => {
            writeMarkerDb(dbPath, "live-before");
            const source = writePublishedBackup(2000, "from-backup");
            fs.writeFileSync(pendingPath(), JSON.stringify({ source }));

            await applyPendingRestore();

            expect(fs.existsSync(pendingPath())).toBe(false);
            expect(readMarker(dbPath)).toBe("from-backup");
            expect(fs.existsSync(`${dbPath}.tmp`)).toBe(false);
            expect(showMessageBox).not.toHaveBeenCalled();
            expect(
                listBackups().some((i) => readMarker(path.join(backupsDir(), i.fileName)) === "live-before"),
            ).toBe(true);
        });

        it("keeps pending when staging fails so next launch can retry", async () => {
            writeMarkerDb(dbPath, "live");
            const source = writePublishedBackup(2000, "from-backup");
            fs.writeFileSync(pendingPath(), JSON.stringify({ source }));
            /* directory at stage path makes unlink/copy fail */
            fs.mkdirSync(`${dbPath}.tmp`);

            await applyPendingRestore();

            expect(fs.existsSync(pendingPath())).toBe(true);
            expect(readMarker(dbPath)).toBe("live");
            expect(showMessageBox).toHaveBeenCalledTimes(1);
        });

        it("stages so restoring the oldest of a full set still applies (C2)", async () => {
            writeMarkerDb(dbPath, "current-live");
            const keep = mainSettingsState.state.dbBackup.keepCount;
            for (let i = 1; i <= keep; i++) {
                writePublishedBackup(i * 1000, `snap-${i}`);
            }
            const oldest = "data-1000.db";
            fs.writeFileSync(pendingPath(), JSON.stringify({ source: oldest }));

            await applyPendingRestore();

            expect(readMarker(dbPath)).toBe("snap-1");
            expect(fs.existsSync(pendingPath())).toBe(false);
            /* restore no longer prunes; originals + safety copy may exceed keepCount */
            expect(fs.existsSync(path.join(backupsDir(), oldest))).toBe(true);
            expect(listBackups().length).toBe(keep + 1);
        });

        it("probing restores does not delete older originals (safety copies stay newest)", async () => {
            writeMarkerDb(dbPath, "live-0");
            const keep = mainSettingsState.state.dbBackup.keepCount;
            for (let i = 1; i <= keep; i++) {
                writePublishedBackup(i * 1000, `snap-${i}`);
            }

            fs.writeFileSync(pendingPath(), JSON.stringify({ source: "data-3000.db" }));
            await applyPendingRestore();
            expect(readMarker(dbPath)).toBe("snap-3");
            expect(listBackups().map((i) => i.fileName)).toEqual(
                expect.arrayContaining([
                    "data-1000.db",
                    "data-2000.db",
                    "data-3000.db",
                    "data-4000.db",
                    "data-5000.db",
                ]),
            );

            fs.writeFileSync(pendingPath(), JSON.stringify({ source: "data-2000.db" }));
            await applyPendingRestore();
            expect(readMarker(dbPath)).toBe("snap-2");
            expect(fs.existsSync(path.join(backupsDir(), "data-1000.db"))).toBe(true);
            expect(fs.existsSync(path.join(backupsDir(), "data-2000.db"))).toBe(true);
            expect(fs.existsSync(path.join(backupsDir(), "data-3000.db"))).toBe(true);
            expect(listBackups().length).toBe(keep + 2);
        });
    });

    describe("scheduler", () => {
        it("startScheduler registers interval + resume; stopScheduler removes them", async () => {
            startScheduler();
            expect(powerMonitorOn).toHaveBeenCalledWith("resume", expect.any(Function));

            await stopScheduler();
            expect(powerMonitorOff).toHaveBeenCalledWith("resume", expect.any(Function));
        });
    });
});
