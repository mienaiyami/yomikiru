import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
    DbBackupImportErrorCode,
    DbBackupListItem,
    DbBackupRestoreErrorCode,
    DbBackupStatus,
} from "@common/types/ipc";
import { DB_PATH } from "@electron/db";
import { hasLibraryItemsTable, listPendingDrizzleMigrations } from "@electron/db/migrations";
import { mainT } from "@electron/i18n/mainI18n";
import { createMainLogger } from "@electron/util/logger";
import { MainSettings } from "@electron/util/mainSettings";
import Database from "better-sqlite3";
import { app, dialog, powerMonitor, shell } from "electron";

const logger = createMainLogger("dbBackup");

/** How often the due-check timer runs while the app is open. */
const DUE_CHECK_MS = 60 * 60 * 1000;

/** Matches published library DB backup files: `data-<unixMs>.db`. */
export const BACKUP_NAME_RE = /^data-(\d+)\.db$/;

/**
 * Outcome of {@link createBackup}: a published `data-<unixMs>.db`, or why none was written.
 * `inProgress` / `missingDb` are skips; `failed` is an I/O or backup() error.
 */
export type CreateBackupResult =
    | { ok: true; fileName: string }
    | { ok: false; reason: "inProgress" | "missingDb" | "failed" };

/** Options for {@link createBackup}. */
export type CreateBackupOptions = {
    /**
     * When false, skip {@link pruneBackups} after publish.
     * Pre-migrate snapshots use this so `keepCount` does not drop older copies at upgrade time.
     */
    prune?: boolean;
};

/** {@link createBackupIfDue} when the interval has not elapsed (or backups are disabled). */
export type CreateBackupIfDueResult = CreateBackupResult | { ok: false; reason: "notDue" };

/**
 * Cold-start backup result for the pre-migrate orchestrator to reuse a snapshot from this launch.
 */
export type ColdStartBackupResult = {
    snapshotted: boolean;
    fileName: string | null;
};

/**
 * Whether startup should run `migrate()`, plus tags/fileName for logs and migrate-failure recovery.
 */
export type PreMigrateBackupOutcome = {
    proceed: boolean;
    pendingTags: string[];
    snapshotFileName: string | null;
};

type RestorePending = {
    source: string;
};

/**
 * Parses a published backup filename `data-<unixMs>.db`.
 * @returns unix ms from the name, or `null` if the name is not a published backup
 */
export const parseBackupFileName = (name: string): number | null => {
    const match = BACKUP_NAME_RE.exec(name);
    if (!match) return null;
    return Number(match[1]);
};

let isBackingUp = false;
let liveSqlite: Database.Database | null = null;
let dueCheckTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<unknown> | null = null;

/** Directory for automatic library DB backups. */
export const getBackupsDir = (): string => path.join(app.getPath("userData"), "backups");

const getPendingPath = (): string => path.join(getBackupsDir(), "restore-pending.json");

const ensureBackupsDir = (): string => {
    const dir = getBackupsDir();
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

/**
 * Registers the long-lived app DB for periodic online backups.
 * Pass `null` after close.
 */
export const setLiveSqlite = (db: Database.Database | null): void => {
    liveSqlite = db;
};

/**
 * Snapshot of schedule settings plus whether a backup is currently running.
 * Used by `dbBackup:getStatus` IPC (and tests); Settings UI mostly reads Redux `mainSettings.dbBackup`.
 */
export const getDbBackupStatus = (): DbBackupStatus => ({
    ...MainSettings.settings.dbBackup,
    isBackingUp,
});

/** True when backups are enabled and the interval since last success has elapsed. */
export const isBackupDue = (): boolean => {
    const { dbBackup } = MainSettings.settings;
    if (!dbBackup.enabled) return false;
    return Date.now() - dbBackup.lastSuccessAt >= dbBackup.intervalHours * 3_600_000;
};

/** Lists published backups newest-first (excludes `*.tmp`). */
export const listBackups = (): DbBackupListItem[] => {
    const dir = getBackupsDir();
    if (!fs.existsSync(dir)) return [];
    const items: DbBackupListItem[] = [];
    for (const name of fs.readdirSync(dir)) {
        const createdAtMs = parseBackupFileName(name);
        if (createdAtMs === null) continue;
        const full = path.join(dir, name);
        try {
            const st = fs.statSync(full);
            if (!st.isFile()) continue;
            items.push({
                fileName: name,
                createdAtMs,
                byteSize: st.size,
            });
        } catch {
            /* skip unreadable entries */
        }
    }
    return items.sort((a, b) => b.createdAtMs - a.createdAtMs);
};

/** Deletes leftover `data-*.db.tmp` publish files and a stray live-DB stage file. */
export const cleanTmpFiles = (): void => {
    const dir = getBackupsDir();
    if (fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
            if (!name.startsWith("data-") || !name.endsWith(".db.tmp")) continue;
            try {
                fs.unlinkSync(path.join(dir, name));
            } catch (err) {
                logger.warn("failed to remove leftover backup tmp", { name }, err);
            }
        }
    }
    /* restore stages next to live DB as data.db.tmp */
    const stageTmp = `${DB_PATH}.tmp`;
    if (fs.existsSync(stageTmp)) {
        try {
            fs.unlinkSync(stageTmp);
        } catch (err) {
            logger.warn("failed to remove leftover restore stage tmp", { stageTmp }, err);
        }
    }
};

/**
 * Keeps the newest `dbBackup.keepCount` `data-*.db` files; deletes the rest.
 * Does not touch `*.tmp` or `restore-pending.json`.
 * Restore/import may temporarily exceed this until the next {@link createBackup}.
 */
export const pruneBackups = (): void => {
    const keep = MainSettings.settings.dbBackup.keepCount;
    const items = listBackups();
    for (const extra of items.slice(keep)) {
        try {
            fs.unlinkSync(path.join(getBackupsDir(), extra.fileName));
        } catch (err) {
            logger.warn("failed to prune backup", { fileName: extra.fileName }, err);
        }
    }
};

type IntegrityResult = { ok: true } | { ok: false; reason: string };

/**
 * Opens `dbFile` readonly and runs `PRAGMA integrity_check`.
 * Used before restore/import so a corrupt snapshot never replaces the live DB.
 */
const runIntegrityCheck = (dbFile: string): IntegrityResult => {
    let db: Database.Database | null = null;
    try {
        db = new Database(dbFile, { readonly: true, fileMustExist: true });
        const result = db.pragma("integrity_check", { simple: true });
        if (result === "ok") return { ok: true };
        return { ok: false, reason: String(result) };
    } catch (err) {
        logger.error("integrity_check failed to run", { dbFile }, err);
        return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    } finally {
        db?.close();
    }
};

/**
 * Writes a consistent snapshot via better-sqlite3 online backup into `userData/backups/`.
 * Uses the live connection when set; otherwise opens a short-lived handle on {@link DB_PATH}.
 * Success still bumps `dbBackup.lastSuccessAt` (including pre-migrate snapshots).
 */
export const createBackup = async (options?: CreateBackupOptions): Promise<CreateBackupResult> => {
    const shouldPrune = options?.prune !== false;
    if (isBackingUp) {
        logger.warn("backup skipped; already in progress");
        return { ok: false, reason: "inProgress" };
    }
    if (!fs.existsSync(DB_PATH)) {
        logger.log("backup skipped; data.db missing");
        return { ok: false, reason: "missingDb" };
    }

    isBackingUp = true;
    const work = (async (): Promise<CreateBackupResult> => {
        const dir = ensureBackupsDir();
        const ms = Date.now();
        const finalName = `data-${ms}.db`;
        const tmpPath = path.join(dir, `${finalName}.tmp`);
        const finalPath = path.join(dir, finalName);

        let owned: Database.Database | null = null;
        const source = liveSqlite;
        try {
            if (!source) {
                owned = new Database(DB_PATH, { readonly: true, fileMustExist: true });
            }
            const db = source ?? owned;
            if (!db) {
                logger.error("backup aborted; no sqlite handle");
                return { ok: false, reason: "failed" };
            }
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            await db.backup(tmpPath);
            fs.renameSync(tmpPath, finalPath);
            if (shouldPrune) pruneBackups();
            await MainSettings.updateSettings({
                dbBackup: {
                    ...MainSettings.settings.dbBackup,
                    lastSuccessAt: ms,
                },
            });
            logger.log("backup published", { finalName });
            return { ok: true, fileName: finalName };
        } catch (err) {
            logger.error("backup failed", err);
            try {
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            } catch {
                /* ignore */
            }
            return { ok: false, reason: "failed" };
        } finally {
            owned?.close();
        }
    })();

    inFlight = work;
    try {
        return await work;
    } finally {
        if (inFlight === work) inFlight = null;
        isBackingUp = false;
    }
};

/** Cold-start / resume / timer entry: backup only when due and enabled. */
export const createBackupIfDue = async (): Promise<CreateBackupIfDueResult> => {
    if (!isBackupDue()) return { ok: false, reason: "notDue" };
    return createBackup();
};

/**
 * If Drizzle has pending journal files and `library_items` exists, snapshot before normalize/migrate.
 * Ignores `dbBackup.enabled`. Reuses {@link ColdStartBackupResult} from this launch when `snapshotted`.
 *
 * @returns `proceed: false` only when the user chooses Quit after a snapshot failure
 */
export const backupIfPendingMigrations = async (
    sqlite: Database.Database,
    cold: ColdStartBackupResult,
): Promise<PreMigrateBackupOutcome> => {
    let pendingTags: string[];
    try {
        pendingTags = listPendingDrizzleMigrations(sqlite).map((row) => row.tag);
    } catch (err) {
        logger.error("could not list pending drizzle migrations; skipping pre-migrate backup", err);
        return { proceed: true, pendingTags: [], snapshotFileName: cold.fileName };
    }

    if (!hasLibraryItemsTable(sqlite)) {
        logger.log("pre-migrate backup skipped", { reason: "first-run", tags: pendingTags });
        return { proceed: true, pendingTags, snapshotFileName: cold.fileName };
    }

    if (pendingTags.length === 0) {
        return { proceed: true, pendingTags: [], snapshotFileName: cold.fileName };
    }

    logger.log("pending drizzle migrations; taking pre-migrate backup", { tags: pendingTags });

    if (cold.snapshotted && cold.fileName) {
        logger.log("reusing cold-start backup from this launch", {
            tags: pendingTags,
            fileName: cold.fileName,
        });
        return { proceed: true, pendingTags, snapshotFileName: cold.fileName };
    }

    const result = await createBackup({ prune: false });
    if (result.ok) {
        logger.log("pre-migrate backup published", { tags: pendingTags, fileName: result.fileName });
        return { proceed: true, pendingTags, snapshotFileName: result.fileName };
    }

    logger.error("pre-migrate backup failed", { tags: pendingTags, reason: result.reason });
    const choice = await dialog.showMessageBox({
        type: "warning",
        title: mainT("dbBackup.preMigrateBackupFailedTitle", { ns: "electron" }),
        message: mainT("dbBackup.preMigrateBackupFailedMessage", { ns: "electron" }),
        buttons: [
            mainT("dbBackup.continueWithoutBackup", { ns: "electron" }),
            mainT("dbBackup.quit", { ns: "electron" }),
        ],
        defaultId: 1,
        cancelId: 1,
    });
    if (choice.response === 0) {
        logger.warn("continuing schema migrate without pre-migrate backup", { tags: pendingTags });
        return { proceed: true, pendingTags, snapshotFileName: null };
    }
    return { proceed: false, pendingTags, snapshotFileName: null };
};

/**
 * Dialog after `migrate()` throws: restore the pre-migrate snapshot, open `backups/`, or quit.
 * Restore uses {@link queueRestoreAndRelaunch} (relaunch + quit). Other choices do not quit; the caller should.
 */
export const handleFailedSchemaMigrate = async (snapshotFileName: string | null): Promise<void> => {
    const hasSnapshot = Boolean(snapshotFileName && BACKUP_NAME_RE.test(snapshotFileName));
    const buttons = hasSnapshot
        ? [
              mainT("dbBackup.restoreSnapshot", { ns: "electron" }),
              mainT("dbBackup.openBackupsFolder", { ns: "electron" }),
              mainT("dbBackup.quit", { ns: "electron" }),
          ]
        : [mainT("dbBackup.openBackupsFolder", { ns: "electron" }), mainT("dbBackup.quit", { ns: "electron" })];

    const res = await dialog.showMessageBox({
        type: "error",
        title: mainT("dbBackup.preMigrateMigrateFailedTitle", { ns: "electron" }),
        message: snapshotFileName
            ? mainT("dbBackup.preMigrateMigrateFailedMessage", {
                  ns: "electron",
                  fileName: snapshotFileName,
              })
            : mainT("dbBackup.preMigrateMigrateFailedMessageNoSnapshot", { ns: "electron" }),
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1,
    });

    if (hasSnapshot && snapshotFileName && res.response === 0) {
        await queueRestoreAndRelaunch(snapshotFileName);
        return;
    }
    const openIdx = hasSnapshot ? 1 : 0;
    if (res.response === openIdx) {
        const dir = getBackupsDir();
        fs.mkdirSync(dir, { recursive: true });
        await shell.openPath(dir);
    }
};

/**
 * Applies `restore-pending.json` if present. Order: integrity -> safety copy -> stage.
 * Clears pending on missing source / integrity failure (no relaunch loop).
 * On staging failure, keeps pending so the next launch can retry.
 * Does not prune backups (safety copies are newest and would drop older originals while probing).
 */
export const applyPendingRestore = async (): Promise<void> => {
    const pendingPath = getPendingPath();
    if (!fs.existsSync(pendingPath)) return;

    let pending: RestorePending;
    try {
        pending = JSON.parse(fs.readFileSync(pendingPath, "utf-8")) as RestorePending;
    } catch (err) {
        logger.error("restore-pending.json unreadable; clearing", err);
        try {
            fs.unlinkSync(pendingPath);
        } catch {
            /* ignore */
        }
        return;
    }

    const sourceName = path.basename(pending.source || "");
    const sourcePath = path.join(getBackupsDir(), sourceName);
    const clearPending = () => {
        try {
            fs.unlinkSync(pendingPath);
        } catch {
            /* ignore */
        }
    };

    if (!BACKUP_NAME_RE.test(sourceName) || !fs.existsSync(sourcePath)) {
        logger.error("restore source missing", { sourceName });
        await dialog.showMessageBox({
            type: "error",
            title: mainT("dbBackup.restoreFailedTitle", { ns: "electron" }),
            message: mainT("dbBackup.sourceMissing", { ns: "electron", fileName: sourceName }),
        });
        clearPending();
        return;
    }

    const integrity = runIntegrityCheck(sourcePath);
    if (!integrity.ok) {
        logger.error("restore aborted; integrity_check failed", { sourceName, reason: integrity.reason });
        await dialog.showMessageBox({
            type: "error",
            title: mainT("dbBackup.restoreFailedTitle", { ns: "electron" }),
            message: mainT("dbBackup.integrityFailed", {
                ns: "electron",
                fileName: sourceName,
                reason: integrity.reason,
            }),
        });
        clearPending();
        return;
    }

    try {
        ensureBackupsDir();
        if (fs.existsSync(DB_PATH)) {
            const safetyName = `data-${Date.now()}.db`;
            await fsp.copyFile(DB_PATH, path.join(getBackupsDir(), safetyName));
        }

        /* stage next to live DB then rename - same volume, atomic replace */
        const stageTmp = `${DB_PATH}.tmp`;
        if (fs.existsSync(stageTmp)) fs.unlinkSync(stageTmp);
        await fsp.copyFile(sourcePath, stageTmp);
        fs.renameSync(stageTmp, DB_PATH);

        /* do not prune here - safety copies are newest and would delete older originals while probing restores */
        clearPending();
        logger.log("restore applied", { sourceName });
    } catch (err) {
        /* keep pending so next launch can retry a transient FS failure */
        logger.error("restore staging failed; leaving pending for retry", err);
        try {
            const stageTmp = `${DB_PATH}.tmp`;
            if (fs.existsSync(stageTmp)) fs.unlinkSync(stageTmp);
        } catch {
            /* ignore */
        }
        await dialog.showMessageBox({
            type: "error",
            title: mainT("dbBackup.restoreFailedTitle", { ns: "electron" }),
            message: mainT("dbBackup.stageFailed", { ns: "electron", error: String(err) }),
        });
    }
};

/**
 * Queues a restore of `fileName` (must be `data-<unixMs>.db` under backups/) and relaunches.
 * Uses {@link app.quit} so `before-quit` can close SQLite.
 */
export const queueRestoreAndRelaunch = async (
    fileName: string,
): Promise<{ ok: true } | { ok: false; code: DbBackupRestoreErrorCode }> => {
    const base = path.basename(fileName);
    if (!BACKUP_NAME_RE.test(base)) {
        return { ok: false, code: "invalidName" };
    }
    const sourcePath = path.join(getBackupsDir(), base);
    if (!fs.existsSync(sourcePath)) {
        return { ok: false, code: "notFound" };
    }

    ensureBackupsDir();
    const pending: RestorePending = { source: base };
    fs.writeFileSync(getPendingPath(), JSON.stringify(pending, null, 2), "utf-8");
    app.relaunch();
    app.quit();
    return { ok: true };
};

/**
 * Imports an external SQLite file: integrity-check, copy into `backups/` as `data-<ms>.db`,
 * then queue the normal restore + relaunch path.
 * Does not prune after copy (same reason as restore: probing must not drop older originals).
 */
export const importAndRestoreFromPath = async (
    absolutePath: string,
): Promise<{ ok: true } | { ok: false; code: DbBackupImportErrorCode; reason?: string }> => {
    const resolved = path.resolve(absolutePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return { ok: false, code: "notFound" };
    }

    const integrity = runIntegrityCheck(resolved);
    if (!integrity.ok) {
        logger.error("import aborted; integrity_check failed", { resolved, reason: integrity.reason });
        return { ok: false, code: "integrityFailed", reason: integrity.reason };
    }

    const dir = ensureBackupsDir();
    const ms = Date.now();
    const finalName = `data-${ms}.db`;
    const finalPath = path.join(dir, finalName);
    try {
        await fsp.copyFile(resolved, finalPath);
    } catch (err) {
        logger.error("import backup copy failed", { resolved }, err);
        try {
            if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        } catch {
            /* ignore */
        }
        return { ok: false, code: "copyFailed" };
    }

    const queued = await queueRestoreAndRelaunch(finalName);
    if (queued.ok) return queued;
    /* finalName is always a valid published backup name we just wrote */
    if (queued.code === "notFound") return { ok: false, code: "notFound" };
    return { ok: false, code: "copyFailed" };
};

const onPowerResume = (): void => {
    void createBackupIfDue();
};

/** Starts the hourly due-check and a resume hook for post-sleep catch-up. */
export const startScheduler = (): void => {
    stopSchedulerTimersOnly();
    dueCheckTimer = setInterval(() => {
        void createBackupIfDue();
    }, DUE_CHECK_MS);
    /* unref so the timer alone does not keep the process alive on quit */
    dueCheckTimer.unref?.();

    powerMonitor.off("resume", onPowerResume);
    powerMonitor.on("resume", onPowerResume);
};

const stopSchedulerTimersOnly = (): void => {
    if (dueCheckTimer) {
        clearInterval(dueCheckTimer);
        dueCheckTimer = null;
    }
};

/**
 * Stops timers and waits for an in-flight backup before shutdown closes SQLite.
 */
export const stopScheduler = async (): Promise<void> => {
    stopSchedulerTimersOnly();
    powerMonitor.off("resume", onPowerResume);
    if (inFlight) {
        try {
            await inFlight;
        } catch {
            /* already logged in createBackup */
        }
    }
};
