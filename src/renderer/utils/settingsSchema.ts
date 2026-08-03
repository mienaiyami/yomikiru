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
        baseDir: z.string(),
        customStylesheet: z.string(),
        /**
         * Home view mode: classic or gallery
         */
        homeViewMode: viewModeEnum,
        locationListSortType: sortTypeEnum,
        locationListSortBy: sortByEnum,
        bookListSortType: sortTypeEnum,
        bookListSortBy: sortByEnum,
        historyListSortType: sortTypeEnum,
        historyListSortBy: sortByEnum,
        gallerySortType: sortTypeEnum,
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
        showTabs: z.object({
            bookmark: z.boolean(),
            history: z.boolean(),
        }),
        useCanvasBasedReader: z.boolean(),
        openOnDblClick: z.boolean(),
        disableListNumbering: z.boolean(),
        /**
         * show search input for history and bookmark
         */
        showSearch: z.boolean(),
        /**
         * Show multi-select checkboxes on classic home Bookmark / History rows.
         */
        enableClassicListCheckboxes: z.boolean(),

        openInZenMode: z.boolean(),
        hideCursorInZenMode: z.boolean(),
        /**
         * Show more data in title attr in bookmark/history tab items
         */
        showMoreDataOnItemHover: z.boolean(),
        autoRefreshSideList: z.boolean(),
        keepExtractedFiles: z.boolean(),
        checkboxReaderSetting: z.boolean(),
        syncSettings: z.boolean(),
        syncThemes: z.boolean(),
        /**
         * Confirm before deleting item from history/bookmark/note
         * only in side list
         * always true on home page
         */
        confirmDeleteItem: z.boolean(),

        //styles

        showPageCountInSideList: z.boolean(),
        showTextFileBadge: z.boolean(),

        //styles end

        readerSettings: mangaReaderSettingsSchema,
        epubReaderSettings: bookReaderSettingsSchema,
        mangaReaderPresetId: z.string(),
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
