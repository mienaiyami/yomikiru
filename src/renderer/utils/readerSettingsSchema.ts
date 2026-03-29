import { z } from "zod";

/**
 * Manga reader (image-based: comics, manhwa, manga) settings schema.
 * Aligns with libraryItems.type "manga" in electron/db/schema.ts.
 */
export const mangaReaderSettingsSchema = z.object({
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
    overrideMouseWheelSpeed: z.boolean(),
    /**
     * duration of mouse wheel scroll in ms
     */
    mouseWheelScrollDuration: z.number(),
    /**
     * multiplier for mouse wheel scroll speed
     */
    mouseWheelScrollSpeed: z.number(),
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
        preset: z.boolean().default(false),
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
    enableTouchScroll: z.boolean(),
    touchScrollMultiplier: z.number(),
});

export type MangaReaderSettings = z.infer<typeof mangaReaderSettingsSchema>;

export const defaultMangaReaderSettings: MangaReaderSettings = {
    readerWidth: 60,
    variableImageSize: false,
    readerTypeSelected: 0,
    pagesPerRowSelected: 0,
    gapBetweenRows: false,
    sideListWidth: 450,
    widthClamped: true,
    gapSize: 10,
    showPageNumberInZenMode: true,
    scrollSpeedA: 5,
    scrollSpeedB: 15,
    overrideMouseWheelSpeed: false,
    mouseWheelScrollSpeed: 0.5,
    mouseWheelScrollDuration: 300,
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
        preset: false,
        size: false,
        fitOption: true,
        readingMode: false,
        pagePerRow: true,
        readingSide: true,
        scrollSpeed: true,
        customColorFilter: true,
        others: false,
    },
    focusChapterInList: false,
    hideSideList: false,
    autoUpdateAnilistProgress: false,
    enableTouchScroll: false,
    touchScrollMultiplier: 5,
};

/**
 * Book reader (EPUB/text-based) settings schema.
 * Aligns with libraryItems.type "book" in electron/db/schema.ts.
 */
export const bookReaderSettingsSchema = z.object({
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
    /** Page/canvas behind the EPUB content column (see `--epub-background-color` on `section.main`). */
    backgroundColor: z.string(),
    useDefault_progressBackgroundColor: z.boolean(),
    progressBackgroundColor: z.string(),
    /**
     * invert and blend-difference
     */
    invertImageColor: z.boolean(),

    settingsCollapsed: z.object({
        preset: z.boolean().default(false),
        size: z.boolean(),
        font: z.boolean(),
        styles: z.boolean(),
        contentFrame: z.boolean(),
        background: z.boolean(),
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
    /** Reading background settings: wallpaper and layer overlay (fixed behind content). */
    backgroundImage: z.object({
        enabled: z.boolean(),
        path: z.string(),
        dimIntensity: z.number(),
        brightness: z.number(),
        contrast: z.number(),
        layer: z.object({
            enabled: z.boolean(),
            color: z.string(),
            opacity: z.number(),
        }),
    }),
    /**
     * Content column frame: text column background, horizontal padding, optional border around `.cont`.
     */
    contentFrame: z.object({
        useDefault_contentBackgroundColor: z.boolean(),
        /** Background of the text column; separate from page background for wallpaper/transparency. */
        contentBackgroundColor: z.string(),
        paddingInline: z.number(),
        border: z.object({
            enabled: z.boolean(),
            width: z.number(),
            style: z.union([z.literal("solid"), z.literal("dashed"), z.literal("dotted"), z.literal("double")]),
            color: z.string(),
        }),
    }),
    /**
     * When true, reader color settings (those not left at default) override matching declarations
     * from EPUB-authored CSS so they take effect on books that ship strong inline or stylesheet colors.
     */
    overrideEpubColors: z.boolean(),
});

export type BookReaderSettings = z.infer<typeof bookReaderSettingsSchema>;

export const defaultBookReaderSettings: BookReaderSettings = {
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
        preset: false,
        size: false,
        font: false,
        styles: true,
        contentFrame: true,
        background: true,
        scrollSpeed: true,
    },
    showProgressInZenMode: true,
    forceLowBrightness: {
        enabled: false,
        value: 0,
    },
    quickFontFamily: ["Roboto", "Cambria"],
    textSelect: true,
    focusChapterInList: false,
    hideSideList: false,
    backgroundImage: {
        enabled: false,
        path: "",
        dimIntensity: 0,
        brightness: 100,
        contrast: 100,
        layer: {
            enabled: false,
            color: "#FF0000",
            opacity: 0.3,
        },
    },
    contentFrame: {
        useDefault_contentBackgroundColor: true,
        contentBackgroundColor: "#000000",
        paddingInline: 10,
        border: {
            enabled: false,
            width: 1,
            style: "solid",
            color: "#FF0000",
        },
    },
    overrideEpubColors: false,
};
