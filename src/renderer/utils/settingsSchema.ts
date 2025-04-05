import { z } from "zod";
import { saveJSONfile, settingsPath } from "./file";
import { dialogUtils } from "./dialog";

const sortTypeEnum = z.union([z.literal("normal"), z.literal("inverse")]);
const sortByEnum = z.union([z.literal("name"), z.literal("date")]);

const settingSchema = z
    .object({
        baseDir: z.string(),
        customStylesheet: z.string(),
        locationListSortType: sortTypeEnum,
        locationListSortBy: sortByEnum,
        bookListSortType: sortTypeEnum,
        bookListSortBy: sortByEnum,
        historyListSortType: sortTypeEnum,
        historyListSortBy: sortByEnum,
        /**
         * Check for new update on start of app.
         */
        updateCheckerEnabled: z.boolean(),
        // moved to main settings
        // askBeforeClosing: z.boolean(),
        skipMinorUpdate: z.boolean(),
        autoDownloadUpdate: z.boolean(),
        /**
         * Update channel to use
         */
        updateChannel: z.union([z.literal("stable"), z.literal("beta")]).default("stable"),
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
        recordChapterRead: z.boolean(),
        disableListNumbering: z.boolean(),
        /**
         * show search input for history and bookmark
         */
        showSearch: z.boolean(),

        openInZenMode: z.boolean(),
        hideCursorInZenMode: z.boolean(),
        hideOpenArrow: z.boolean(),
        /**
         * Show more data in title attr in bookmark/history tab items
         */
        showMoreDataOnItemHover: z.boolean(),
        autoRefreshSideList: z.boolean(),
        keepExtractedFiles: z.boolean(),
        checkboxReaderSetting: z.boolean(),
        syncSettings: z.boolean(),
        syncThemes: z.boolean(),

        //styles

        showPageCountInSideList: z.boolean(),
        showTextFileBadge: z.boolean(),

        //styles end

        readerSettings: z.object({
            /**
             * width of reader in percent
             */
            readerWidth: z.number().min(0),
            variableImageSize: z.boolean(),
            /**
             * * `0` - Vertical scroll
             * * `1` - Left to Right
             * * `2` - Right to Left
             */
            readerTypeSelected: z.union([z.literal(0), z.literal(1), z.literal(2)]),
            /**
             * * `0` - One page per row.
             * * `1` - Two pages per row.
             * * `2` - Two pages per row, but first row only has one.
             */
            pagesPerRowSelected: z.union([z.literal(0), z.literal(1), z.literal(2)]),
            gapBetweenRows: z.boolean(),
            sideListWidth: z.number().min(10),
            widthClamped: z.boolean(),
            gapSize: z.number(),
            showPageNumberInZenMode: z.boolean(),
            scrollSpeedA: z.number(),
            scrollSpeedB: z.number(),
            /**
             * reading direction in two pages per row
             * * `0` - ltr
             * * `1` - rtl
             */
            readingSide: z.union([z.literal(0), z.literal(1)]),
            // fitVertically: false,
            /**
             * * `0` - None
             * * `1` - Fit Vertically
             * * `2` - Fit Horizontally
             * * `3` - 1:1
             */
            fitOption: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
            disableChapterTransitionScreen: z.boolean(),
            /**
             * Decide which is enabled, maxWidth or maxHeight
             */
            maxHeightWidthSelector: z.union([z.literal("none"), z.literal("width"), z.literal("height")]),
            maxWidth: z.number().min(1),
            maxHeight: z.number().min(1),
            /**
             * to be used in `page.getViewport({ scale: | })`
             * higher scale = higher quality
             */
            pdfScale: z.number(),
            dynamicLoading: z.boolean(),
            customColorFilter: z.object({
                enabled: z.boolean(),
                /**
                 * red 0-255
                 */
                r: z.number().min(0).max(255),
                g: z.number().min(0).max(255),
                b: z.number().min(0).max(255),
                /**
                 * alpha 0-1
                 */
                a: z.number().min(0).max(1),
                blendMode: z.union([
                    z.literal("color"),
                    z.literal("color-burn"),
                    z.literal("color-dodge"),
                    z.literal("darken"),
                    z.literal("difference"),
                    z.literal("exclusion"),
                    z.literal("hard-light"),
                    z.literal("hue"),
                    z.literal("lighten"),
                    z.literal("luminosity"),
                    z.literal("multiply"),
                    z.literal("normal"),
                    z.literal("overlay"),
                    z.literal("saturation"),
                    z.literal("screen"),
                    z.literal("soft-light"),
                ]),
                // doesnt come under this.enabled
                hue: z.number(),
                saturation: z.number(),
                brightness: z.number(),
                contrast: z.number(),
            }),
            invertImage: z.boolean(),
            grayscale: z.boolean(),
            forceLowBrightness: z.object({
                enabled: z.boolean(),
                /**
                 * opacity 0-1 of overlying black div
                 */
                value: z.number(),
            }),
            settingsCollapsed: z.object({
                size: z.boolean(),
                fitOption: z.boolean(),
                readingMode: z.boolean(),
                pagePerRow: z.boolean(),
                readingSide: z.boolean(),
                scrollSpeed: z.boolean(),
                customColorFilter: z.boolean(),
                others: z.boolean(),
            }),
            focusChapterInList: z.boolean(),
            hideSideList: z.boolean(),
            autoUpdateAnilistProgress: z.boolean(),
            touchScrollMultiplier: z.number(),
        }),
        epubReaderSettings: z.object({
            /**load and show only one chapter at a time from TOC */
            loadOneChapter: z.boolean(),
            /**
             * width of reader in percent
             */
            readerWidth: z.number(),
            /**
             * font size in px.
             */
            fontSize: z.number(),
            useDefault_fontFamily: z.boolean(),
            fontFamily: z.string(),
            useDefault_lineSpacing: z.boolean(),
            /**
             * line height in em
             */
            lineSpacing: z.number(),
            useDefault_paragraphSpacing: z.boolean(),
            /**
             * gap in em
             */
            paragraphSpacing: z.number(),
            useDefault_wordSpacing: z.boolean(),
            wordSpacing: z.number(),
            useDefault_letterSpacing: z.boolean(),
            letterSpacing: z.number(),
            hyphenation: z.boolean(),
            scrollSpeedA: z.number(),
            scrollSpeedB: z.number(),
            /**
             * limit image height to 100%
             */
            limitImgHeight: z.boolean(),
            noIndent: z.boolean(),
            // all color valeus are hex
            useDefault_fontColor: z.boolean(),
            fontColor: z.string(),
            useDefault_linkColor: z.boolean(),
            useDefault_fontWeight: z.boolean(),
            fontWeight: z.number(),
            linkColor: z.string(),
            useDefault_backgroundColor: z.boolean(),
            backgroundColor: z.string(),
            useDefault_progressBackgroundColor: z.boolean(),
            progressBackgroundColor: z.string(),
            /**
             * invert and blend-difference
             */
            invertImageColor: z.boolean(),

            settingsCollapsed: z.object({
                size: z.boolean(),
                font: z.boolean(),
                styles: z.boolean(),
                scrollSpeed: z.boolean(),
            }),
            showProgressInZenMode: z.boolean(),
            forceLowBrightness: z.object({
                enabled: z.boolean(),
                /**
                 * opacity 0-1 of overlying black div
                 */
                value: z.number(),
            }),
            quickFontFamily: z.array(z.string()),
            textSelect: z.boolean(),
            /**
             * focus current chapter in sidelist, cause huge performance issue
             */
            focusChapterInList: z.boolean(),
            hideSideList: z.boolean(),
        }),
    })
    .strip()
    // it is separate do i dont leave default-less value
    .default({
        baseDir: window.electron.app.getPath("home"),
        customStylesheet: "",
        locationListSortType: "normal",
        locationListSortBy: "name",
        bookListSortType: "normal",
        bookListSortBy: "date",
        historyListSortType: "normal",
        historyListSortBy: "date",
        updateCheckerEnabled: true,
        skipMinorUpdate: false,
        autoDownloadUpdate: false,
        updateChannel: "stable",
        openDirectlyFromManga: false,
        showTabs: {
            bookmark: true,
            history: true,
        },
        useCanvasBasedReader: false,
        openOnDblClick: true,
        // disableCachingCanvas: false,
        recordChapterRead: true,
        // showPageNumOnHome: true,
        disableListNumbering: true,
        showSearch: false,
        openInZenMode: false,
        hideCursorInZenMode: false,
        hideOpenArrow: false,
        showMoreDataOnItemHover: true,
        autoRefreshSideList: false,
        keepExtractedFiles: true,
        checkboxReaderSetting: false,
        syncSettings: true,
        syncThemes: true,
        showPageCountInSideList: true,
        showTextFileBadge: true,
        readerSettings: {
            readerWidth: 60,
            variableImageSize: true,
            readerTypeSelected: 0,
            pagesPerRowSelected: 0,
            gapBetweenRows: true,
            sideListWidth: 450,
            widthClamped: true,
            gapSize: 10,
            showPageNumberInZenMode: true,
            scrollSpeedA: 5,
            scrollSpeedB: 15,
            readingSide: 1,
            fitOption: 0,
            disableChapterTransitionScreen: false,
            maxHeightWidthSelector: "none",
            maxHeight: 500,
            maxWidth: 500,
            invertImage: false,
            grayscale: false,
            pdfScale: 1.5,
            dynamicLoading: false,
            customColorFilter: {
                enabled: false,
                r: 0,
                g: 0,
                b: 0,
                a: 1,
                blendMode: "normal",
                hue: 0,
                saturation: 0,
                brightness: 0,
                contrast: 0,
            },
            forceLowBrightness: {
                enabled: false,
                value: 0.5,
            },
            settingsCollapsed: {
                size: false,
                fitOption: true,
                readingMode: false,
                pagePerRow: true,
                readingSide: true,
                scrollSpeed: true,
                customColorFilter: true,
                others: false,
            },
            focusChapterInList: true,
            hideSideList: false,
            autoUpdateAnilistProgress: false,
            touchScrollMultiplier: 1,
        },
        epubReaderSettings: {
            loadOneChapter: true,
            readerWidth: 50,
            fontSize: 20,
            useDefault_fontFamily: true,
            fontFamily: "Roboto",
            useDefault_lineSpacing: true,
            lineSpacing: 1.4,
            useDefault_paragraphSpacing: true,
            paragraphSpacing: 2,
            useDefault_wordSpacing: true,
            wordSpacing: 0,
            useDefault_letterSpacing: true,
            letterSpacing: 0,
            hyphenation: false,
            scrollSpeedA: 5,
            scrollSpeedB: 15,
            limitImgHeight: true,
            noIndent: false,

            useDefault_fontColor: true,
            fontColor: "#ffffff",
            useDefault_linkColor: false,
            linkColor: "#0073ff",
            useDefault_fontWeight: true,
            fontWeight: 500,
            useDefault_backgroundColor: true,
            backgroundColor: "#000000",
            useDefault_progressBackgroundColor: true,
            progressBackgroundColor: "#000000",

            invertImageColor: false,

            settingsCollapsed: {
                size: false,
                font: false,
                styles: true,
                scrollSpeed: true,
            },
            showProgressInZenMode: true,
            forceLowBrightness: {
                enabled: false,
                value: 0,
            },
            quickFontFamily: ["Roboto", "Cambria"],
            textSelect: true,
            focusChapterInList: true,
            hideSideList: false,
        },
    });

const makeSettingsJson = () => {
    saveJSONfile(settingsPath, settingSchema.parse(undefined));
};
let settingNotFound = false;
if (!window.fs.existsSync(settingsPath)) {
    dialogUtils.warn({ message: "No settings found, Select manga folder to make default in settings" });
    settingNotFound = true;
    makeSettingsJson();
}

const parseAppSettings = (): z.infer<typeof settingSchema> => {
    const defaultSettings = settingSchema.parse(undefined);
    if (settingNotFound) {
        settingNotFound = false;
        return defaultSettings;
    }

    const getValueFromDeepObject = (obj: any, keys: (string | number)[]) => {
        let result = obj;
        for (const key of keys) {
            if (result && Object.hasOwn(result, key)) {
                result = result[key];
            } else {
                return undefined; // Key doesn't exist in the object
            }
        }
        return result;
    };
    const setValueFromDeepObject = (obj: any, keys: (string | number)[], value: any) => {
        let main = obj;
        let i;
        for (i = 0; i < keys.length - 1; i++) {
            main = main[keys[i]];
        }
        main[keys[i]] = value;
    };

    try {
        //todo test for empty;
        const parsedJSON = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
        return settingSchema
            .catch(({ error, input }) => {
                const location = [] as string[];
                const defaultSettings = settingSchema.parse(undefined);
                const fixed = { ...input };
                error.issues.forEach((e) => {
                    location.push(e.path.join("."));
                    setValueFromDeepObject(fixed, e.path, getValueFromDeepObject(defaultSettings, e.path));
                });
                dialogUtils.warn({
                    message: `Some settings are invalid or new settings added. Re-writing settings.`,
                });
                window.logger.log("appSettings invalid at :", location);
                saveJSONfile(settingsPath, fixed);
                return fixed as z.infer<typeof settingSchema>;
            })
            .parse(parsedJSON);
    } catch (err) {
        window.logger.error(err);
        window.logger.log(window.fs.readFileSync(settingsPath, "utf-8"));
        dialogUtils.customError({ message: "Unable to parse settings.json. Remaking." });
        makeSettingsJson();
        return defaultSettings;
    }
};

export { settingSchema, parseAppSettings, makeSettingsJson };
