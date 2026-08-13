import {
    applyPendingRestore,
    cleanTmpFiles,
    createBackup,
    createBackupIfDue,
    getDbBackupStatus,
    importAndRestoreFromPath,
    listBackups,
    queueRestoreAndRelaunch,
    setLiveSqlite,
    startScheduler,
} from "@electron/util/dbBackup";
import type { DatabaseService } from "../db";
import { ipc } from "./utils";

/**
 * Registers library DB backup IPC and starts the due-check scheduler.
 * Call after {@link DatabaseService} is open and live sqlite is registered.
 */
export const registerDbBackupHandlers = (db: DatabaseService): void => {
    setLiveSqlite(db.sqliteDb);

    ipc.handle("dbBackup:getStatus", () => getDbBackupStatus());
    ipc.handle("dbBackup:list", () => listBackups());
    ipc.handle("dbBackup:runNow", async () => {
        const ok = await createBackup();
        return { ok };
    });
    ipc.handle("dbBackup:restore", async (_e, { fileName }) => queueRestoreAndRelaunch(fileName));
    ipc.handle("dbBackup:importAndRestore", async (_e, { absolutePath }) =>
        importAndRestoreFromPath(absolutePath),
    );

    startScheduler();
};

/**
 * Startup path before the long-lived DB opens: clear tmp, apply pending restore,
 * then cold-start backup if the interval elapsed.
 */
export const runDbBackupStartupBeforeOpen = async (): Promise<void> => {
    cleanTmpFiles();
    await applyPendingRestore();
    await createBackupIfDue();
};
