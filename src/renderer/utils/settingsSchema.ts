import { z } from "zod";
import { dialogUtils } from "./dialog";
import { saveJSONfile, settingsPath } from "./file";
import { createRendererLogger } from "./logger";
import { LIBRARY_SCAN_MAX_DEPTH_CEILING } from "./mangaChapters";
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
        /** Sort direction for gallery tabs that show the sort control (not `continue-reading`). */
        gallerySortType: sortTypeEnum,
        /** Sort field for those tabs. `"lastRead"` orders by `progress.lastReadAt`. */
        gallerySortBy: z.union([z.literal("name"), z.literal("date"), z.literal("lastRead")]),
        /**
         * Last active tab in the gallery home view. Persisted so the app reopens
         * to the same section between launches.
         */
        galleryActiveTab: z.union([
            z.literal("continue-reading"),
            z.literal("library"),
            z.literal("bookmarks"),
            z.literal("favourites"),
        ]),
        /**
         * Library item type shown in the gallery home view. `"all"` disables the filter;
         * `"manga"` keeps `type === "manga"`, `"book"` keeps `type === "book"`.
         */
        galleryTypeFilter: z.union([z.literal("all"), z.literal("manga"), z.literal("book")]),
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
        /** Card width in em. */
        galleryItemWidth: z.number().min(10).max(30),
        /**
         * Pixel height of the gallery details metadata block (hero).
         * Shared for manga and book. `0` is auto (section uses the rem min and scrolls if taller).
         */
        galleryDetailsHeroHeight: z.number().min(0).default(0),
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
         * Extra roots Scan now / start / interval may walk. Default Location is not in this list;
         * {@link scanDefaultLocation} opts it in separately.
         */
        libraryFolders: z
            .array(
                z.object({
                    path: z.string().min(1),
                    content: z.union([z.literal("manga"), z.literal("book"), z.literal("both")]).default("both"),
                    maxDepth: z
                        .number()
                        .int()
                        .min(0)
                        .max(LIBRARY_SCAN_MAX_DEPTH_CEILING)
                        .default(LIBRARY_SCAN_MAX_DEPTH_CEILING),
                    scanOnStart: z.boolean().default(false),
                    /** Hours between automatic scans of this folder; `0` means interval scanning is off. */
                    scanIntervalHours: z.number().min(0).default(0),
                    watch: z.boolean().default(false),
                    /** Unix ms of the last completed scan of this folder; `0` means never. */
                    lastScanAtMs: z.number().min(0).default(0),
                }),
            )
            .default([]),
        /** When true, Scan now / start also walk Default Location (`baseDir`). */
        scanDefaultLocation: z.boolean().default(false),
        /**
         * Hours between automatic scans of Default Location when {@link scanDefaultLocation} is on;
         * `0` means interval scanning is off for that folder.
         */
        scanDefaultLocationIntervalHours: z.number().min(0).default(0),
        /** Unix ms of the last completed Default Location scan; `0` means never. */
        scanDefaultLocationLastAtMs: z.number().min(0).default(0),
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
        galleryActiveTab: "continue-reading",
        galleryTypeFilter: "all",
        galleryDisplayMode: "compact",
        galleryItemWidth: 16,
        galleryDetailsHeroHeight: 0,
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
        libraryFolders: [],
        scanDefaultLocation: false,
        scanDefaultLocationIntervalHours: 0,
        scanDefaultLocationLastAtMs: 0,
        keepExtractedFiles: true,
        checkboxReaderSetting: false,
        syncSettings: true,
        syncThemes: true,
        confirmDeleteItem: true,
        showPageCountInSideList: true,
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

export type LibraryFolderSetting = z.infer<typeof settingSchema>["libraryFolders"][number];
