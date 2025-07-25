import { app } from "electron";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { log } from ".";
import { ipc } from "@electron/ipc/utils";
import { WindowManager } from "./window";

const mainSettingsSchema = z
    .object({
        hardwareAcceleration: z.boolean().default(true),
        tempPath: z.string().default(app.getPath("temp")),
        openInExistingWindow: z.boolean().default(false),
        askBeforeClosing: z.boolean().default(false),

        //app updates
        checkForUpdates: z.boolean().default(true),
        skipPatch: z.boolean().default(false),
        autoDownload: z.boolean().default(false),
        channel: z.enum(["stable", "beta"]).default("stable"),
    })
    .strip();

export type MainSettingsType = z.infer<typeof mainSettingsSchema>;

const oldHWAPath = path.join(app.getPath("userData"), "DISABLE_HARDWARE_ACCELERATION");
const oldTempPath = path.join(app.getPath("userData"), "TEMP_PATH");
const oldOpenInExistingWindowPath = path.join(app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW");

export class MainSettings {
    private static settings: MainSettingsType;
    private static readonly settingsPath = path.join(app.getPath("userData"), "main-settings.json");

    private static makeMainSettingsJson(): MainSettingsType {
        const defaultSettings = mainSettingsSchema.parse({});
        fs.writeFileSync(this.settingsPath, JSON.stringify(defaultSettings, null, 2));
        return defaultSettings;
    }

    private static parseMainSettings(): MainSettingsType {
        try {
            if (!fs.existsSync(this.settingsPath)) {
                return this.makeMainSettingsJson();
            }

            const parsedJSON = JSON.parse(fs.readFileSync(this.settingsPath, "utf-8"));
            return mainSettingsSchema.parse(parsedJSON);
        } catch (err) {
            console.error("Error parsing main settings:", err);
            return this.makeMainSettingsJson();
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

    public static getSettings(): MainSettingsType {
        return { ...this.settings };
    }

    public static async updateSettings(newSettings: Partial<MainSettingsType>): Promise<void> {
        this.settings = mainSettingsSchema.parse({ ...this.settings, ...newSettings });
        await fs.promises.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
        this.applySettings(this.settings);
    }

    public static initialize(): void {
        this.settings = this.parseMainSettings();
        this.applySettings(this.settings);
        this.registerIpcHandlers();
    }

    /**
     * Migrate from old file per settings based settings
     */
    public static migrate(): void {
        try {
            const newSettings = this.makeMainSettingsJson();

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

            this.updateSettings(newSettings);
        } catch (err) {
            log.error("Error migrating main settings:", err);
        }
    }

    private static registerIpcHandlers(): void {
        ipc.handle("mainSettings:get", () => this.getSettings());
        ipc.handle("mainSettings:update", async (_, newSettings: Partial<MainSettingsType>) => {
            await this.updateSettings(newSettings);
            const windows = WindowManager.getAllWindows();
            windows.forEach((window) => {
                ipc.send(window.webContents, "mainSettings:sync", this.getSettings());
            });
            // return this.getSettings();
        });
    }
}

MainSettings.initialize();
/**
 * Migrate from old file per settings based settings
 */
if ([oldHWAPath, oldTempPath, oldOpenInExistingWindowPath].some((p) => fs.existsSync(p))) {
    log.info("Migrating from old main settings.");
    MainSettings.migrate();
}
