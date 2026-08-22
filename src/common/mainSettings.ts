import { BUILTIN_EN_SOURCE_ID } from "@common/i18n";
import { librarySettingsSchema } from "@common/library/folders";
import { z } from "zod";

/**
 * Main-process settings persisted in `main-settings.json`.
 * `tempPath` has no schema default: callers pass the OS temp via {@link parseMainSettings}.
 */
export const mainSettingsSchema = z
    .object({
        hardwareAcceleration: z.boolean().default(true),
        tempPath: z.string(),
        /** Open files in current window and focus it when launching the app again. Disabled: open in new window. */
        openInExistingWindow: z.boolean().default(false),
        askBeforeClosing: z.boolean().default(false),
        /** When enabled, minimize sends window to system tray instead of taskbar. */
        minimizeToTray: z.boolean().default(false),

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
                intervalHours: z.number().int().min(1).default(24),
                keepCount: z.number().int().min(1).max(100).default(10),
                lastSuccessAt: z.number().int().nonnegative().default(0),
            })
            .default({}),

        /**
         * Library scan roots and Default Location (Locations tab).
         * Shallow-merge replaces this whole object; callers send the full `library` block.
         */
        library: librarySettingsSchema,
    })
    .strip();

export type MainSettingsType = z.infer<typeof mainSettingsSchema>;

/**
 * Parses stored or partial main settings. `fallbackTempPath` is used when `tempPath` is
 * missing or blank (OS temp from Electron `app.getPath("temp")`).
 */
export const parseMainSettings = (raw: unknown, fallbackTempPath: string): MainSettingsType => {
    const obj = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const parsed = mainSettingsSchema.parse({ tempPath: fallbackTempPath, ...obj });
    return parsed.tempPath.trim() ? parsed : { ...parsed, tempPath: fallbackTempPath };
};

/**
 * Schema defaults plus `tempPath`. Renderer Redux uses this before `mainSettings:get` returns.
 */
export const defaultMainSettings = (tempPath: string): MainSettingsType => parseMainSettings({}, tempPath);
