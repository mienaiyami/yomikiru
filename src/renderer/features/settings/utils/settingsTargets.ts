import type readerEn from "@common/i18n/locales/en/reader.json";
import type settingsEn from "@common/i18n/locales/en/settings.json";
import type usageEn from "@common/i18n/locales/en/usage.json";
import { SHORTCUT_COMMAND_MAP } from "@utils/keybindings";
import type { SettingsTabKey } from "./constants";

type JsonPrimitive = string | number | boolean | null;

/**
 * Dot paths to string (or primitive) leaves in an i18n JSON object.
 */
type LeafKeyOf<T> = T extends JsonPrimitive
    ? never
    : T extends readonly unknown[]
      ? never
      : {
            [K in keyof T & string]: T[K] extends JsonPrimitive
                ? K
                : T[K] extends readonly unknown[]
                  ? K
                  : T[K] extends object
                    ? `${K}.${LeafKeyOf<T[K]>}`
                    : never;
        }[keyof T & string];

/**
 * Dot paths to nested objects or leaves, used for {@link SettingsTarget.contentPath}.
 */
type NestedKeyOf<T> = T extends JsonPrimitive
    ? never
    : T extends readonly unknown[]
      ? never
      : {
            [K in keyof T & string]: T[K] extends JsonPrimitive
                ? K
                : T[K] extends readonly unknown[]
                  ? K
                  : T[K] extends object
                    ? K | `${K}.${NestedKeyOf<T[K]>}`
                    : never;
        }[keyof T & string];

type SettingsNsTargetFields<Ns extends "settings" | "reader" | "usage", Catalog> = {
    /** Opaque stable id; public API for navigate, search, and SettingsLink. */
    id: string;
    tab: SettingsTabKey;
    /** CSS selector resolved inside #settings. */
    selector: string;
    /** Namespace for {@link SettingsNsTargetFields.labelKey}. */
    labelNs: Ns;
    /** i18n key under {@link SettingsNsTargetFields.labelNs}. */
    labelKey: LeafKeyOf<Catalog>;
    /**
     * Dot path(s) under {@link SettingsNsTargetFields.labelNs} whose string leaves
     * are searchable (section body / control copy), not only the display label.
     */
    contentPath?: NestedKeyOf<Catalog> | readonly NestedKeyOf<Catalog>[];
    /** Search-row group text; defaults to the tab label when omitted. */
    groupLabelKey?: LeafKeyOf<Catalog>;
    /** Extra lowercase match strings for search; not shown in UI. */
    keywords?: readonly string[];
    /** When set, search omits this entry on other platforms. */
    platform?: "win32";
};

/**
 * One navigable / searchable settings surface. Selectors stay private to the
 * catalog; callers use {@link SettingsTarget.id} only. {@link SettingsTarget.labelKey}
 * and {@link SettingsTarget.contentPath} are typed against the English catalog for
 * {@link SettingsTarget.labelNs}.
 */
export type SettingsTarget =
    | SettingsNsTargetFields<"settings", typeof settingsEn>
    | SettingsNsTargetFields<"reader", typeof readerEn>
    | SettingsNsTargetFields<"usage", typeof usageEn>;

type SettingsCatalogTarget = Extract<SettingsTarget, { labelNs: "settings" }>;
type UsageCatalogTarget = Extract<SettingsTarget, { labelNs: "usage" }>;
type ReaderCatalogTarget = Extract<SettingsTarget, { labelNs: "reader" }>;

/** CSS class applied briefly after navigate scrolls to a target. */
export const SETTINGS_TARGET_HIGHLIGHT_CLASS = "settings-target-highlight";

/** How long the navigate highlight class stays on the element. */
export const SETTINGS_TARGET_HIGHLIGHT_MS = 1000;

/**
 * Normalizes {@link SettingsTarget.contentPath} to a list of dot paths.
 */
export const settingsTargetContentPaths = (target: SettingsTarget): readonly string[] => {
    if (!target.contentPath) return [];
    return typeof target.contentPath === "string" ? [target.contentPath] : target.contentPath;
};

/**
 * Builds a Settings-tab catalog row ({@link SettingsCatalogTarget.labelNs} settings).
 */
const setting = (
    id: string,
    selector: string,
    labelKey: SettingsCatalogTarget["labelKey"],
    extra?: Partial<
        Pick<SettingsCatalogTarget, "keywords" | "platform" | "contentPath" | "groupLabelKey">
    >,
): SettingsCatalogTarget => ({
    id,
    tab: "settings",
    selector,
    labelKey,
    labelNs: "settings",
    ...extra,
});

/**
 * Settings-tab control whose search-row group is the otherSettings section title.
 */
const otherSetting = (
    id: string,
    selector: string,
    labelKey: SettingsCatalogTarget["labelKey"],
    extra?: Partial<Pick<SettingsCatalogTarget, "keywords" | "contentPath">>,
): SettingsCatalogTarget =>
    setting(id, selector, labelKey, { ...extra, groupLabelKey: "otherSettings.title" });

/**
 * Settings-tab control whose search-row group is the styleSettings section title.
 */
const styleSetting = (
    id: string,
    selector: string,
    labelKey: SettingsCatalogTarget["labelKey"],
    extra?: Partial<Pick<SettingsCatalogTarget, "keywords" | "contentPath">>,
): SettingsCatalogTarget =>
    setting(id, selector, labelKey, { ...extra, groupLabelKey: "styleSettings.title" });

/**
 * Builds an Extras/Usage catalog row ({@link UsageCatalogTarget.labelNs} usage).
 */
const usage = (
    id: string,
    selector: string,
    labelKey: UsageCatalogTarget["labelKey"],
    extra?: Partial<Pick<UsageCatalogTarget, "keywords" | "contentPath">>,
): UsageCatalogTarget => ({
    id,
    tab: "extras",
    selector,
    labelKey,
    labelNs: "usage",
    ...extra,
});

/**
 * Hand-maintained settings / Usage / About targets. Shortcut rows are generated
 * by {@link buildShortcutSettingsTargets}.
 */
export const SETTINGS_TARGETS_STATIC: readonly SettingsTarget[] = [
    setting("setting:default-location", "#settings-default-location", "defaultLocation.title", {
        keywords: ["base dir", "home folder"],
        contentPath: "defaultLocation",
    }),
    setting("setting:theme", "#settings-theme", "theme.title", { contentPath: "theme" }),
    setting("setting:copy-theme", "#settings-copyTheme", "theme.copyCurrent", {
        keywords: ["clipboard", "share theme"],
    }),
    setting("setting:language", "#settings-language", "language.title", { contentPath: "language" }),
    setting("setting:reader-presets", "#settings-reader-presets", "readerPresets.title", {
        keywords: ["preset"],
        contentPath: "readerPresets",
    }),
    setting("setting:file-explorer", "#settings-fileExplorerOption", "fileExplorer.title", {
        platform: "win32",
        keywords: ["context menu", "shell"],
        contentPath: "fileExplorer",
    }),
    setting("setting:anilist", "#settings-anilist", "anilist.title", {
        keywords: ["tracking"],
        contentPath: "anilist",
    }),
    setting("setting:library", "#settings-library", "library.title", {
        keywords: ["covers", "thumbnails"],
        contentPath: "library",
    }),
    setting("setting:db-backup", "#settings-dbBackup", "dbBackup.title", {
        keywords: ["backup", "restore", "database"],
        contentPath: "dbBackup",
    }),
    setting("setting:pdf", "#settings-pdfScale", "pdf.title", { keywords: ["pdf"], contentPath: "pdf" }),
    setting("setting:custom-stylesheet", "#settings-customStylesheet", "customStylesheet.title", {
        keywords: ["css"],
        contentPath: "customStylesheet",
    }),
    setting("setting:custom-temp", "#settings-customTempFolder", "tempFolder.title", {
        keywords: ["temp", "cache"],
        contentPath: "tempFolder",
    }),
    setting("setting:keep-extracted", "#settings-keepExtractedFiles", "tempFolder.keepTempFiles", {
        keywords: ["temp files", "extract"],
    }),
    setting("setting:other", "#settings-otherSettings", "otherSettings.title"),
    otherSetting(
        "setting:hardware-acceleration",
        "#settings-hardwareAcceleration",
        "otherSettings.hardwareAcceleration",
        { contentPath: "otherSettings.hardwareAccelerationDesc" },
    ),
    otherSetting(
        "setting:confirm-close-window",
        "#settings-confirmCloseWindow",
        "otherSettings.confirmCloseWindow",
        { contentPath: "otherSettings.confirmCloseWindowDesc" },
    ),
    otherSetting("setting:minimize-to-tray", "#settings-minimizeToTray", "otherSettings.minimizeToTray", {
        contentPath: "otherSettings.minimizeToTrayDesc",
        keywords: ["tray"],
    }),
    otherSetting(
        "setting:use-existing-window",
        "#settings-useExistingWindow",
        "otherSettings.useExistingWindow",
        { contentPath: "otherSettings.useExistingWindowDesc" },
    ),
    otherSetting("setting:open-on-dblclick", "#settings-openOnDblClick", "otherSettings.openOnDblClick", {
        contentPath: "otherSettings.openOnDblClickDesc",
    }),
    otherSetting("setting:sync-settings", "#settings-syncSettings", "otherSettings.syncSettings", {
        contentPath: "otherSettings.syncSettingsDesc",
    }),
    otherSetting("setting:sync-themes", "#settings-syncThemes", "otherSettings.syncThemes", {
        contentPath: "otherSettings.syncThemesDesc",
    }),
    otherSetting(
        "setting:open-directly-from-manga",
        "#settings-openDirectlyFromManga",
        "otherSettings.chapterOpeningShortcut",
        { contentPath: "otherSettings.chapterOpeningShortcutDesc" },
    ),
    otherSetting(
        "setting:bookmark-history-search",
        "#settings-bookmarkHistorySearch",
        "otherSettings.bookmarkHistorySearch",
        { contentPath: "otherSettings.bookmarkHistorySearchDesc" },
    ),
    otherSetting(
        "setting:classic-list-checkboxes",
        "#settings-classicListCheckboxes",
        "otherSettings.classicListCheckboxes",
        {
            keywords: ["multi-select", "checkbox"],
            contentPath: "otherSettings.classicListCheckboxesDesc",
        },
    ),
    otherSetting(
        "setting:confirm-side-list-delete",
        "#settings-confirmSideListDelete",
        "otherSettings.confirmSideListDelete",
        {
            contentPath: [
                "otherSettings.confirmSideListDeleteDesc1",
                "otherSettings.confirmSideListDeleteDesc2",
            ],
        },
    ),
    otherSetting("setting:auto-zen-mode", "#settings-autoZenMode", "otherSettings.autoZenMode", {
        contentPath: "otherSettings.autoZenModeDesc",
    }),
    otherSetting("setting:zen-mode-cursor", "#settings-zenModeCursor", "otherSettings.zenModeCursor", {
        contentPath: "otherSettings.zenModeCursorDesc",
    }),
    otherSetting(
        "setting:auto-refresh-side-list",
        "#settings-autoRefreshSideList",
        "otherSettings.autoRefreshSideList",
        { contentPath: "otherSettings.autoRefreshSideListDesc" },
    ),
    otherSetting(
        "setting:canvas-based-rendering",
        "#settings-canvasBasedRendering",
        "otherSettings.canvasBasedRendering",
        {
            contentPath: [
                "otherSettings.canvasBasedRenderingDesc1",
                "otherSettings.canvasBasedRenderingDesc2",
            ],
        },
    ),
    otherSetting(
        "setting:dynamic-image-loading",
        "#settings-dynamicImageLoading",
        "otherSettings.dynamicImageLoading",
        {
            contentPath: [
                "otherSettings.dynamicImageLoadingDesc1",
                "otherSettings.dynamicImageLoadingDesc2",
            ],
        },
    ),
    otherSetting("setting:auto-focus-chapter", "#settings-autoFocusChapter", "otherSettings.autoFocusChapter", {
        contentPath: "otherSettings.autoFocusChapterDesc",
    }),
    otherSetting(
        "setting:epub-auto-focus-chapter",
        "#settings-epubAutoFocusChapter",
        "otherSettings.epubAutoFocusChapter",
    ),
    otherSetting(
        "setting:epub-load-by-chapter",
        "#settings-epubLoadByChapter",
        "otherSettings.epubLoadByChapter",
        {
            contentPath: ["otherSettings.epubLoadByChapterDesc1", "otherSettings.epubLoadByChapterDesc2"],
        },
    ),
    otherSetting(
        "setting:epub-disable-text-select",
        "#settings-epubDisableTextSelect",
        "otherSettings.epubDisableTextSelect",
        { contentPath: "otherSettings.epubDisableTextSelectDesc" },
    ),
    setting("setting:style", "#settings-styleSettings", "styleSettings.title"),
    styleSetting(
        "setting:location-list-numbering",
        "#settings-locationListNumbering",
        "styleSettings.locationListNumbering",
        { contentPath: "styleSettings.locationListNumberingDesc" },
    ),
    styleSetting(
        "setting:chapter-transition",
        "#settings-chapterTransition",
        "styleSettings.chapterTransition",
        { contentPath: "styleSettings.chapterTransitionDesc" },
    ),
    styleSetting(
        "setting:more-info-on-hover",
        "#settings-moreInfoOnHover",
        "styleSettings.moreInfoOnHover",
        { contentPath: "styleSettings.moreInfoOnHoverDesc" },
    ),
    styleSetting(
        "setting:reader-settings-checkbox",
        "#settings-readerSettingsCheckbox",
        "styleSettings.readerSettingsCheckbox",
        { contentPath: "styleSettings.readerSettingsCheckboxDesc" },
    ),
    styleSetting(
        "setting:show-page-count-in-side-list",
        "#settings-showPageCountInSideList",
        "styleSettings.showPageCountInSideList",
    ),
    styleSetting(
        "setting:show-text-file-badge",
        "#settings-showTextFileBadge",
        "styleSettings.showTextFileBadge",
    ),
    setting("setting:reset", "#settings-reset", "reset.title", {
        keywords: ["danger", "wipe"],
        contentPath: "reset",
    }),

    { id: "about", tab: "about", selector: "#settings-about", labelKey: "tabs.about", labelNs: "settings" },

    usage("usage:language", "#settings-usage-language", "language.title", { contentPath: "language" }),
    usage("usage:db-backup", "#settings-usage-dbBackup", "dbBackup.title", {
        keywords: ["backup"],
        contentPath: "dbBackup",
    }),
    usage("usage:search-shortcut-keys", "#settings-usage-searchShortcutKeys", "searchShortcuts.title", {
        keywords: ["search", "shortcut"],
        contentPath: "searchShortcuts",
    }),
    usage(
        "usage:open-directly-from-manga",
        "#settings-usage-openDirectlyFromManga",
        "homeLocation.openDirectly.link",
        { contentPath: "homeLocation.openDirectly" },
    ),
    usage("usage:library", "#settings-usage-library", "covers.title", {
        keywords: ["covers"],
        contentPath: "covers",
    }),
    {
        id: "usage:copy-theme",
        tab: "extras",
        selector: "#settings-usage-copyTheme",
        labelKey: "theme.copyCurrent",
        labelNs: "settings",
        keywords: ["theme", "clipboard"],
    },
    usage("usage:reader-presets", "#settings-usage-readerPresets", "readerPresets.title", {
        contentPath: "readerPresets",
    }),
    usage("usage:pdf-scale", "#settings-usage-pdfScale", "pdfScale.link", {
        keywords: ["pdf"],
        contentPath: "pdfScale",
    }),
    usage("usage:anilist", "#settings-usage-anilist", "anilist.title", { contentPath: "anilist" }),
    usage("usage:epub-background", "#settings-usage-epubBackground", "epubBackground.title", {
        contentPath: "epubBackground",
    }),
    {
        id: "usage:custom-stylesheet",
        tab: "extras",
        selector: "#settings-usage-customStylesheet",
        labelKey: "customStylesheet.title",
        labelNs: "settings",
        keywords: ["css"],
        contentPath: "customStylesheet",
    },
];

/**
 * Builds one `shortcut:<command>` target per {@link SHORTCUT_COMMAND_MAP} entry.
 */
export const buildShortcutSettingsTargets = (): ReaderCatalogTarget[] =>
    SHORTCUT_COMMAND_MAP.map((entry) => ({
        id: `shortcut:${entry.command}`,
        tab: "shortcutKeys" as const,
        selector: `#settings-shortcut-${entry.command}`,
        labelKey: entry.name,
        labelNs: "reader" as const,
        keywords: [entry.command],
    }));

/**
 * Full catalog: static entries plus generated shortcut rows.
 */
export const getAllSettingsTargets = (): SettingsTarget[] => [
    ...SETTINGS_TARGETS_STATIC,
    ...buildShortcutSettingsTargets(),
];

/**
 * Looks up a catalog entry by opaque id.
 */
export const getSettingsTarget = (id: string): SettingsTarget | undefined =>
    getAllSettingsTargets().find((target) => target.id === id);

/**
 * Whether a target should appear in search on the given platform.
 * Navigate may still be attempted for an explicit id.
 */
export const isSettingsTargetAvailable = (
    target: SettingsTarget,
    platform: NodeJS.Platform = process.platform,
): boolean => !target.platform || target.platform === platform;

/**
 * Flattens nested i18n `returnObjects` values into searchable string leaves.
 */
export const collectI18nStringLeaves = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(collectI18nStringLeaves);
    if (value !== null && typeof value === "object") {
        return Object.values(value).flatMap(collectI18nStringLeaves);
    }
    return [];
};

/**
 * Builds every string used to match a target: display label, keywords, and
 * optional {@link SettingsTarget.contentPath} leaves from the active locale.
 */
export const buildSettingsTargetSearchTexts = (
    target: SettingsTarget,
    resolveLabel: (target: SettingsTarget) => string,
    resolveContentPath: (ns: string, path: string) => unknown,
): string[] => {
    const ns = target.labelNs;
    const texts = [resolveLabel(target), ...(target.keywords ?? [])];
    for (const path of settingsTargetContentPaths(target)) {
        texts.push(...collectI18nStringLeaves(resolveContentPath(ns, path)));
    }
    return texts;
};

/**
 * Case-insensitive substring match on texts from {@link buildSettingsTargetSearchTexts}.
 * Empty / whitespace query returns no hits (caller shows no dropdown).
 * Caller should pass already platform-filtered targets.
 */
export const filterSettingsTargets = (
    targets: readonly SettingsTarget[],
    query: string,
    getSearchTexts: (target: SettingsTarget) => readonly string[],
): SettingsTarget[] => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return targets.filter((target) =>
        getSearchTexts(target).some((text) => text.toLowerCase().includes(needle)),
    );
};
