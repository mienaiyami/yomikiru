import type { DatabaseService } from "@electron/db";
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
import { MainSettings } from "@electron/util/mainSettings";
import { ipc } from "./utils";

let anilistLegacyTrackingImportClaimed = false;

/**
 * Registers process-wide library scan (walk + watch + interval) and the once-per-process
 * AniList legacy-tracking-import claim. Call once after the database is open.
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
    /*
     * First window only: migrate pre-SQLite AniList tracking from localStorage and
     * validate the stored token once (avoids N login-failed dialogs). Does not load
     * Redux trackers - every renderer calls fetchAllTrackers on boot.
     */
    ipc.handle("anilist:claimLegacyTrackingImport", () => {
        if (anilistLegacyTrackingImportClaimed) return false;
        anilistLegacyTrackingImportClaimed = true;
        return true;
    });
    startLibraryScanScheduler();
};

/** Stops interval + watchers on quit. */
export const stopLibraryScan = (): void => {
    stopLibraryScanScheduler();
};
