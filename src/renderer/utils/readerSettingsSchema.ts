import { z } from "zod";

/**
 * Manga reader (image-based: comics, manhwa, manga) settings schema.
 * Aligns with libraryItems.type "manga" in electron/db/schema.ts.
 */
export const mangaReaderSettingsSchema = z.object({
    /**
     * width of reader in percent
     */
    /** Width of the reading area as a percentage of the viewport. */
    readerWidth: z.number().min(0),
    /** Allow images in the same chapter to have different display widths instead of uniform stretch. */
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
    /** Show a vertical gap between image rows. */
    gapBetweenRows: z.boolean(),
    /** Width of the chapter side-list panel in pixels. Draggable at runtime. */
    sideListWidth: z.number().min(10),
    /** Prevent the reader area from overflowing the viewport edge when readerWidth is large. */
    widthClamped: z.boolean(),
    /** Size of the vertical gap between image rows in pixels (when gapBetweenRows is true). */
    gapSize: z.number(),
    /** Overlay the current page number on the reader when zen mode is active. */
    showPageNumberInZenMode: z.boolean(),
    /** Scroll distance in pixels for the Scroll A commands (w/s/arrow keys). */
    scrollSpeedA: z.number(),
    /** Scroll distance in pixels for the Scroll B commands (Space/Shift+Space). */
    scrollSpeedB: z.number(),
    /** Use custom mouse-wheel scroll speed/duration settings instead of browser default. */
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
    /** Skip the end-of-chapter transition/summary screen when navigating to the next chapter. */
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
    /** Lazy-load images as they scroll into view instead of loading all at once. Reduces initial memory for long chapters. */
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
    /** Apply CSS invert(100%) to all images. Useful as a dark-mode toggle for black-and-white manga. */
    invertImage: z.boolean(),
    /** Apply CSS grayscale(100%) to all images. */
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
    /** Auto-scroll the side-list to keep the current chapter visible when the chapter changes. */
    focusChapterInList: z.boolean(),
    /** Start with the chapter side-list hidden (toggle with the side-list shortcut). */
    hideSideList: z.boolean(),
    /**
     * Automatically push chapter completion to AniList when the last page is reached.
     * Only fires when the item is linked in the AniList tracking store.
     */
    autoUpdateAnilistProgress: z.boolean(),
    /** Enable touch/trackpad scroll gestures in the reader. */
    enableTouchScroll: z.boolean(),
    /** Speed multiplier applied to touch/trackpad scroll distance. */
    touchScrollMultiplier: z.number(),
});

export type MangaReaderSettings = z.infer<typeof mangaReaderSettingsSchema>;

export const defaultMangaReaderSettings: MangaReaderSettings = {
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
    focusChapterInList: true,
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
    /** When true, the EPUB's own font-family is used; false overrides with fontFamily. */
    useDefault_fontFamily: z.boolean(),
    /** Font family override name (applied when useDefault_fontFamily is false). */
    fontFamily: z.string(),
    /** When true, EPUB CSS line-height is used; false overrides with lineSpacing. */
    useDefault_lineSpacing: z.boolean(),
    /**
     * line height in em
     */
    lineSpacing: z.number(),
    /** When true, EPUB CSS paragraph margin is used; false overrides with paragraphSpacing. */
    useDefault_paragraphSpacing: z.boolean(),
    /** Gap between paragraphs in em (applied when useDefault_paragraphSpacing is false). */
    paragraphSpacing: z.number(),
    /** When true, EPUB CSS word-spacing is used; false overrides with wordSpacing. */
    useDefault_wordSpacing: z.boolean(),
    /** Word spacing override in em (applied when useDefault_wordSpacing is false). */
    wordSpacing: z.number(),
    /** When true, EPUB CSS letter-spacing is used; false overrides with letterSpacing. */
    useDefault_letterSpacing: z.boolean(),
    /** Letter spacing override in em (applied when useDefault_letterSpacing is false). */
    letterSpacing: z.number(),
    /** Enable CSS hyphenation on long words. */
    hyphenation: z.boolean(),
    /** Scroll distance in pixels for Scroll A commands (w/s/arrow keys). */
    scrollSpeedA: z.number(),
    /** Scroll distance in pixels for Scroll B commands (Space/Shift+Space). */
    scrollSpeedB: z.number(),
    /** Cap EPUB image height at 100vh so images never push text off screen. */
    limitImgHeight: z.boolean(),
    /** Remove CSS first-line indent from paragraphs. */
    noIndent: z.boolean(),
    // all color values are hex
    /** When true, EPUB CSS text color is used; false overrides with fontColor. */
    useDefault_fontColor: z.boolean(),
    /** Text color override hex string (applied when useDefault_fontColor is false). */
    fontColor: z.string(),
    /** When true, EPUB CSS link color is used; false overrides with linkColor. */
    useDefault_linkColor: z.boolean(),
    /** When true, EPUB CSS font-weight is used; false overrides with fontWeight. */
    useDefault_fontWeight: z.boolean(),
    /** Font weight override (applied when useDefault_fontWeight is false). */
    fontWeight: z.number(),
    /** Link color override hex string (applied when useDefault_linkColor is false). */
    linkColor: z.string(),
    /** When true, EPUB CSS background-color is used; false overrides with backgroundColor. */
    useDefault_backgroundColor: z.boolean(),
    /** Page/canvas behind the EPUB content column (see `--epub-background-color` on `section.main`). */
    backgroundColor: z.string(),
    /** When true, EPUB CSS is used for the progress bar background; false overrides with progressBackgroundColor. */
    useDefault_progressBackgroundColor: z.boolean(),
    /** Background color for the reading progress bar area (hex). */
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
    /** Show reading progress percentage overlay when zen mode is active. */
    showProgressInZenMode: z.boolean(),
    forceLowBrightness: z.object({
        enabled: z.boolean(),
        /**
         * opacity 0-1 of overlying black div
         */
        value: z.number(),
    }),
    /** Font families shown in the quick-switch font picker inside the reader. */
    quickFontFamily: z.array(z.string()),
    /** Allow text selection in the EPUB content (required for notes/highlights). */
    textSelect: z.boolean(),
    /**
     * Auto-scroll the side-list to keep the current chapter visible.
     * NOTE: can cause a performance issue with very large TOCs.
     */
    focusChapterInList: z.boolean(),
    /** Start with the chapter side-list hidden. */
    hideSideList: z.boolean(),
    /** Reading background settings: wallpaper and layer overlay (fixed behind content). */
    /** Reading background settings: wallpaper and layer overlay (fixed behind content). */
    backgroundImage: z.object({
        enabled: z.boolean(),
        /** Absolute path to the wallpaper image file. */
        path: z.string(),
        /** Opacity (0-1) of the black dim overlay on top of the wallpaper. */
        dimIntensity: z.number(),
        /** CSS brightness filter value applied to the wallpaper (0-200, 100 = no change). */
        brightness: z.number(),
        /** CSS contrast filter value applied to the wallpaper (0-200, 100 = no change). */
        contrast: z.number(),
        /** Solid color overlay rendered between the wallpaper and the text column. */
        layer: z.object({
            enabled: z.boolean(),
            color: z.string(),
            /** Opacity (0-1) of the color overlay layer. */
            opacity: z.number(),
        }),
    }),
    /**
     * Content column frame: text column background, horizontal padding, optional border around `.cont`.
     */
    /**
     * Content column frame: text column background, horizontal padding, optional border around `.cont`.
     * Separate from the page background so the text area can be opaque while the wallpaper shows around it.
     */
    contentFrame: z.object({
        /** When true, uses the page background color for the text column; false uses contentBackgroundColor. */
        useDefault_contentBackgroundColor: z.boolean(),
        /** Background of the text column; separate from page background for wallpaper/transparency. */
        contentBackgroundColor: z.string(),
        /** Horizontal padding inside the text column in em. */
        paddingInline: z.number(),
        /** Optional decorative border drawn around the text column. */
        border: z.object({
            enabled: z.boolean(),
            /** Border width in pixels. */
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
    focusChapterInList: true,
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
