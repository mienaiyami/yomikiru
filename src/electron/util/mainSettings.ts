import fs from "node:fs";
import path from "node:path";
import { libraryFoldersNeedHeal } from "@common/library/folders";
import {
    type MainSettingsType,
    mainSettingsSchema,
    parseMainSettings as parseMainSettingsJson,
} from "@common/mainSettings";
import { ipc } from "@electron/ipc/utils";
import { app } from "electron";
import { createMainLogger } from "./logger";

const logger = createMainLogger("MainSettings");

import { TrayManager } from "./tray";
import { WindowManager } from "./window";

export type { MainSettingsType };

const oldHWAPath = path.join(app.getPath("userData"), "DISABLE_HARDWARE_ACCELERATION");
const oldTempPath = path.join(app.getPath("userData"), "TEMP_PATH");
const oldOpenInExistingWindowPath = path.join(app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW");

export class MainSettings {
    private static _settings: MainSettingsType;
    private static readonly settingsPath = path.join(app.getPath("userData"), "main-settings.json");
    /** Optional hook after a successful persist (library-folder watchers). Must not import this module. */
    private static afterUpdate: (() => void) | null = null;

    /**
     * Registers a callback run after every {@link updateSettings} write.
     * Used so library-folder watchers can resync without a MainSettings <-> scan import cycle.
     */
    public static setAfterUpdate(fn: () => void): void {
        MainSettings.afterUpdate = fn;
    }

    private static makeMainSettingsJson(): MainSettingsType {
        const defaultSettings = parseMainSettingsJson({}, app.getPath("temp"));
        fs.writeFileSync(MainSettings.settingsPath, JSON.stringify(defaultSettings, null, 2));
        return defaultSettings;
    }

    private static parseMainSettings(): MainSettingsType {
        try {
            if (!fs.existsSync(MainSettings.settingsPath)) {
                return MainSettings.makeMainSettingsJson();
            }

            const parsedJSON = JSON.parse(fs.readFileSync(MainSettings.settingsPath, "utf-8")) as {
                library?: { folders?: unknown };
            };
            const parsed = parseMainSettingsJson(parsedJSON, app.getPath("temp"));
            /* persist when the loader restored the one-flagged-row invariant */
            if (libraryFoldersNeedHeal(parsedJSON?.library?.folders)) {
                fs.writeFileSync(MainSettings.settingsPath, JSON.stringify(parsed, null, 2));
            }
            return parsed;
        } catch (err) {
            logger.error("main-settings.json is invalid or unreadable; recreating defaults", err);
            return MainSettings.makeMainSettingsJson();
        }
    }

    private static applySettings(currentSettings: MainSettingsType): void {
        if (!currentSettings.hardwareAcceleration && !app.isReady()) {
            app.disableHardwareAcceleration();
        }

        if (currentSettings.tempPath !== app.getPath("temp")) {
            app.setPath("temp", currentSettings.tempPath);
            if (!fs.existsSync(currentSettings.tempPath)) {
                fs.mkdirSync(currentSettings.tempPath, { recursive: true });
            }
        }
    }

    public static get settings(): MainSettingsType {
        return { ...MainSettings._settings };
    }

    public static async updateSettings(newSettings: Partial<MainSettingsType>): Promise<void> {
        MainSettings._settings = mainSettingsSchema.parse({ ...MainSettings._settings, ...newSettings });
        await fs.promises.writeFile(MainSettings.settingsPath, JSON.stringify(MainSettings._settings, null, 2));
        MainSettings.applySettings(MainSettings._settings);
        /* keep renderer Redux in sync when lastSuccessAt advances from backup, not only IPC updates */
        for (const window of WindowManager.getAllWindows()) {
            ipc.send(window.webContents, "mainSettings:sync", MainSettings.settings);
        }
        MainSettings.afterUpdate?.();
    }

    public static initialize(): void {
        MainSettings._settings = MainSettings.parseMainSettings();
        MainSettings.applySettings(MainSettings._settings);
        MainSettings.registerIpcHandlers();
    }

    /**
     * Migrate from old file per settings based settings
     */
    public static migrate(): void {
        try {
            const newSettings = MainSettings.makeMainSettingsJson();

            if (fs.existsSync(oldHWAPath)) {
                newSettings.hardwareAcceleration = false;
                fs.rmSync(oldHWAPath, { force: true });
            }

            if (fs.existsSync(oldTempPath)) {
                newSettings.tempPath = fs.readFileSync(oldTempPath, "utf-8");
                fs.rmSync(oldTempPath, { force: true });
            } else {
                newSettings.tempPath = app.getPath("temp");
            }

            if (fs.existsSync(oldOpenInExistingWindowPath)) {
                newSettings.openInExistingWindow = true;
                fs.rmSync(oldOpenInExistingWindowPath, { force: true });
            }

            MainSettings.updateSettings(newSettings);
        } catch (err) {
            logger.error("Migration from legacy main-settings files failed", err);
        }
    }

    private static registerIpcHandlers(): void {
        ipc.handle("mainSettings:get", () => MainSettings.settings);
        ipc.handle("mainSettings:update", async (_, newSettings: Partial<MainSettingsType>) => {
            /* languageSourceId is owned by i18n:setSource - ignore if sent here */
            const { languageSourceId: _ignored, ...rest } = newSettings;
            await MainSettings.updateSettings(rest);
            TrayManager.setMinimizeToTray(MainSettings.settings.minimizeToTray);
        });
    }
}

MainSettings.initialize();
/**
 * Migrate from old file per settings based settings
 */
if ([oldHWAPath, oldTempPath, oldOpenInExistingWindowPath].some((p) => fs.existsSync(p))) {
    logger.info("Migrating legacy per-flag main settings into main-settings.json");
    MainSettings.migrate();
}
