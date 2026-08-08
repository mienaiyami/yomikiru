import { z } from "zod";
import { dialogUtils } from "./dialog";
import { saveJSONfile, settingsPath } from "./file";
import { createRendererLogger } from "./logger";
import { getValueFromDeepObject } from "./objectPath";
import { USER_PRESET_BOOK_ID, USER_PRESET_MANGA_ID } from "./readerPresets";
import {
    bookReaderSettingsSchema,
    defaultBookReaderSettings,
    defaultMangaReaderSettings,
    mangaReaderSettingsSchema,
} from "./readerSettingsSchema";
import { readJsonFileWithRetrySync } from "./readJsonFileWithRetry";
import { repairZodInputWithDefaults } from "./zodRepair";

const log = createRendererLogger("settingsSchema");

const sortTypeEnum = z.union([z.literal("normal"), z.literal("inverse")]);
const sortByEnum = z.union([z.literal("name"), z.literal("date")]);
const viewModeEnum = z.union([z.literal("classic"), z.literal("gallery")]);

const settingSchema = z
    .object({
        /** Root directory shown in the LocationsTab file browser. */
        baseDir: z.string(),
        /** Absolute path to a user CSS file injected into document.head. Empty string = disabled. */
        customStylesheet: z.string(),
        /** Home view mode: classic (three-panel list) or gallery (cover grid). */
        homeViewMode: viewModeEnum,
        /** Sort direction for the classic Locations list. */
        locationListSortType: sortTypeEnum,
        /** Sort field for the classic Locations list. */
        locationListSortBy: sortByEnum,
        /** Sort direction for the classic Book list. */
        bookListSortType: sortTypeEnum,
        /** Sort field for the classic Book list. */
        bookListSortBy: sortByEnum,
        /** Sort direction for the classic History list. */
        historyListSortType: sortTypeEnum,
        /** Sort field for the classic History list. */
        historyListSortBy: sortByEnum,
        /** Sort direction for the gallery Library tab. */
        gallerySortType: sortTypeEnum,
        /** Sort field for the gallery Library tab. `"lastRead"` orders by most-recently-opened. */
        gallerySortBy: z.union([z.literal("name"), z.literal("date"), z.literal("lastRead")]),
        /**
         * Sort field for the gallery "Continue Reading" tab. Persisted separately
         * from the main library sort so the two tabs can have independent ordering.
         */
        continueReadingSortBy: z.union([z.literal("name"), z.literal("lastRead")]),
        /** Sort direction for the gallery "Continue Reading" tab. */
        continueReadingSortType: sortTypeEnum,
        /**
         * Last active tab in the gallery home view. Persisted so the app reopens
         * to the same section between launches.
         */
        galleryActiveTab: z.union([z.literal("continue-reading"), z.literal("library"), z.literal("favourites")]),
        /**
         * `normal` - normal grid view with title and cover
         * `compact` - compact grid view with title and cover (title overlapped on cover)
         * `cover-only` - compact grid view with only cover
         * `list` - list view with title and cover
         */
        galleryDisplayMode: z.union([
            z.literal("normal"),
            z.literal("compact"),
            z.literal("cover-only"),
            z.literal("list"),
        ]),
        /**
         * width of gallery item in em
         */
        galleryItemWidth: z.number().min(10).max(30),
        /**
         * Open chapter in reader directly, one folder inside of base manga dir.
         */
        openDirectlyFromManga: z.boolean(),
        /** Whether each collapsible classic-view panel is expanded. */
        showTabs: z.object({
            bookmark: z.boolean(),
            history: z.boolean(),
        }),
        /**
         * Render images onto `<canvas>` elements instead of `<img>`.
         * Produces sharper output on HiDPI displays at the cost of higher memory usage.
         */
        useCanvasBasedReader: z.boolean(),
        /** Require double-click to open items in classic lists. False = single-click opens. */
        openOnDblClick: z.boolean(),
        /** Hide the numeric row-index prefix on classic list items. */
        disableListNumbering: z.boolean(),
        /** Show the search input bar in classic History and Bookmark lists. */
        showSearch: z.boolean(),
        /** Show multi-select checkboxes on classic home Bookmark / History rows. */
        enableClassicListCheckboxes: z.boolean(),

        /** Open the reader in zen / fullscreen mode automatically on every launch. */
        openInZenMode: z.boolean(),
        /** Hide the cursor after it becomes idle while zen mode is active. */
        hideCursorInZenMode: z.boolean(),
        /** Show extended tooltip (date, note) on classic list bookmark/history rows. */
        showMoreDataOnItemHover: z.boolean(),
        /** Re-scan the chapter list each time the reader window gains focus. */
        autoRefreshSideList: z.boolean(),
        /**
         * Cache extracted EPUB/ZIP content in the temp directory between sessions.
         * When false, the temp folder is deleted when the reader closes.
         */
        keepExtractedFiles: z.boolean(),
        /** Render reader setting toggles as checkboxes instead of toggle switches. */
        checkboxReaderSetting: z.boolean(),
        /** Reload settings.json and shortcuts.json when changed by another window. */
        syncSettings: z.boolean(),
        /** Reload themes.json when changed by another window. */
        syncThemes: z.boolean(),
        /**
         * Confirm before deleting item from history/bookmark/note in the reader side list.
         * Deletion from the home page always confirms regardless of this setting.
         */
        confirmDeleteItem: z.boolean(),

        /** Show page count badge on chapter rows in the manga reader side-list. */
        showPageCountInSideList: z.boolean(),
        /** Show the "EPUB" type badge on book items in classic lists. */
        showTextFileBadge: z.boolean(),

        readerSettings: mangaReaderSettingsSchema,
        epubReaderSettings: bookReaderSettingsSchema,
        /** Id of the active manga reader preset; applied to `readerSettings` on selection. */
        mangaReaderPresetId: z.string(),
        /** Id of the active book reader preset; applied to `epubReaderSettings` on selection. */
        bookReaderPresetId: z.string(),
    })
    .strip()
    // it is separate do i dont leave default-less value
    .default({
        baseDir: window.electron.app.getPath("home"),
        customStylesheet: "",
        homeViewMode: "classic",
        locationListSortType: "normal",
        locationListSortBy: "name",
        bookListSortType: "normal",
        bookListSortBy: "date",
        historyListSortType: "normal",
        historyListSortBy: "date",
        gallerySortType: "normal",
        gallerySortBy: "name",
        continueReadingSortBy: "lastRead",
        continueReadingSortType: "normal",
        galleryActiveTab: "continue-reading",
        galleryDisplayMode: "normal",
        galleryItemWidth: 16,
        openDirectlyFromManga: false,
        showTabs: {
            bookmark: true,
            history: true,
        },
        useCanvasBasedReader: false,
        openOnDblClick: true,
        disableListNumbering: true,
        showSearch: true,
        enableClassicListCheckboxes: true,
        openInZenMode: false,
        hideCursorInZenMode: false,
        showMoreDataOnItemHover: true,
        autoRefreshSideList: false,
        keepExtractedFiles: true,
        checkboxReaderSetting: false,
        syncSettings: true,
        syncThemes: true,
        confirmDeleteItem: true,
        showPageCountInSideList: true,
        showTextFileBadge: true,
        readerSettings: defaultMangaReaderSettings,
        epubReaderSettings: defaultBookReaderSettings,
        mangaReaderPresetId: USER_PRESET_MANGA_ID,
        bookReaderPresetId: USER_PRESET_BOOK_ID,
    });

export const defaultSettings = settingSchema.parse(undefined);

const makeSettingsJson = () => {
    saveJSONfile(settingsPath, defaultSettings);
};
let settingNotFound = false;
if (!window.fs.existsSync(settingsPath)) {
    // dialogUtils.warn({ message: "No settings found, Select manga folder to make default in settings" });
    settingNotFound = true;
    makeSettingsJson();
}

const parseAppSettings = (): z.infer<typeof settingSchema> => {
    if (settingNotFound) {
        settingNotFound = false;
        return defaultSettings;
    }

    try {
        const parsedJSON = readJsonFileWithRetrySync(settingsPath, {
            maxAttempts: 10,
            onRetry: (attempt, error) => {
                log.log(`settings.json read retry ${attempt}/10`, error);
            },
        });
        const first = settingSchema.safeParse(parsedJSON);
        if (first.success) return first.data;

        log.log(
            "settings.json failed validation; paths with issues:",
            first.error.issues.map((e) => e.path.join(".")),
        );

        const repaired = repairZodInputWithDefaults(settingSchema, parsedJSON, (path) =>
            getValueFromDeepObject(defaultSettings, path),
        );
        if (!repaired.success) {
            log.error("settings.json could not be repaired with defaults; remaking file");
            dialogUtils.customError({ message: "Unable to parse settings.json. Remaking." });
            makeSettingsJson();
            return defaultSettings;
        }
        dialogUtils.warn({
            message: `Some settings are invalid or new settings added. Re-writing settings.`,
        });
        saveJSONfile(settingsPath, repaired.data);
        return repaired.data;
    } catch (err) {
        log.error("settings.json read or parse threw; remaking file", err);
        dialogUtils.customError({ message: "Unable to parse settings.json. Remaking." });
        makeSettingsJson();
        return defaultSettings;
    }
};

export { settingSchema, parseAppSettings, makeSettingsJson };
