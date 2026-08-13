import fs from "node:fs";
import path from "node:path";
import { BUILTIN_EN_SOURCE_ID } from "@common/i18n";
import { ipc } from "@electron/ipc/utils";
import { app } from "electron";
import { z } from "zod";
import { createMainLogger } from "./logger";

const logger = createMainLogger("MainSettings");

import { TrayManager } from "./tray";
import { WindowManager } from "./window";

const mainSettingsSchema = z
    .object({
        hardwareAcceleration: z.boolean().default(true),
        tempPath: z.string().default(app.getPath("temp")),
        /** Open files in current window and focus it when launching the app again. Disabled: open in new window. */
        openInExistingWindow: z.boolean().default(false),
        askBeforeClosing: z.boolean().default(false),
        /** When enabled, minimize sends window to system tray instead of taskbar. */
        minimizeToTray: z.boolean().default(false),

        //app updates
        checkForUpdates: z.boolean().default(true),
        skipPatch: z.boolean().default(false),
        autoDownload: z.boolean().default(false),
        channel: z.enum(["stable", "beta"]).default("stable"),

        /**
         * Active language source id (`builtin:en` or `pack:<packId>`).
         * Mutate only via `i18n:setSource` so menus and both i18n instances stay in sync.
         */
        languageSourceId: z.string().default(BUILTIN_EN_SOURCE_ID),

        /**
         * Automatic SQLite library backups under userData/backups/.
         * Interval is hours; keepCount is how many newest `data-*.db` files to keep after a backup publish;
         * lastSuccessAt is unix ms and only advances on success.
         */
        dbBackup: z
            .object({
                enabled: z.boolean().default(true),
                intervalHours: z.number().int().min(1).default(168),
                keepCount: z.number().int().min(1).max(100).default(10),
                lastSuccessAt: z.number().int().nonnegative().default(0),
            })
            .default({}),
    })
    .strip();

export type MainSettingsType = z.infer<typeof mainSettingsSchema>;

const oldHWAPath = path.join(app.getPath("userData"), "DISABLE_HARDWARE_ACCELERATION");
const oldTempPath = path.join(app.getPath("userData"), "TEMP_PATH");
const oldOpenInExistingWindowPath = path.join(app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW");

export class MainSettings {
    private static _settings: MainSettingsType;
    private static readonly settingsPath = path.join(app.getPath("userData"), "main-settings.json");

    private static makeMainSettingsJson(): MainSettingsType {
        const defaultSettings = mainSettingsSchema.parse({});
        fs.writeFileSync(MainSettings.settingsPath, JSON.stringify(defaultSettings, null, 2));
        return defaultSettings;
    }

    private static parseMainSettings(): MainSettingsType {
        try {
            if (!fs.existsSync(MainSettings.settingsPath)) {
                return MainSettings.makeMainSettingsJson();
            }

            const parsedJSON = JSON.parse(fs.readFileSync(MainSettings.settingsPath, "utf-8"));
            return mainSettingsSchema.parse(parsedJSON);
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
