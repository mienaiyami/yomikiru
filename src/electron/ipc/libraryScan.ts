import type { DatabaseService } from "@electron/db";
import { MainSettings } from "@electron/util/mainSettings";
import {
    cancelLibraryScan,
    getLibraryScanStatus,
    notifyLibraryScanRendererReady,
    onMainLibrarySettingsChanged,
    setLibraryScanDatabase,
    startLibraryScan,
    startLibraryScanScheduler,
    stopLibraryScanScheduler,
} from "@electron/util/libraryScan";
import { ipc } from "./utils";

let anilistStartupImportClaimed = false;

/**
 * Registers process-wide library scan (walk + watch + interval) and the AniList
 * once-per-app import claim. Call once after the database is open.
 */
export const registerLibraryScanHandlers = (db: DatabaseService): void => {
    setLibraryScanDatabase(db);
    MainSettings.setAfterUpdate(onMainLibrarySettingsChanged);
    ipc.handle("libraryScan:start", (_event, request) => startLibraryScan(request));
    ipc.handle("libraryScan:cancel", () => {
        cancelLibraryScan();
    });
    ipc.handle("libraryScan:getStatus", () => getLibraryScanStatus());
    ipc.handle("libraryScan:rendererReady", () => {
        notifyLibraryScanRendererReady();
    });
    ipc.handle("anilist:claimStartupImport", () => {
        if (anilistStartupImportClaimed) return false;
        anilistStartupImportClaimed = true;
        return true;
    });
    startLibraryScanScheduler();
};

/** Stops interval + watchers on quit. */
export const stopLibraryScan = (): void => {
    stopLibraryScanScheduler();
};
