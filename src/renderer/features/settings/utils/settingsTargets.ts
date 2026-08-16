import { SHORTCUT_COMMAND_MAP } from "@utils/keybindings";
import type { SettingsTabKey } from "./constants";

/**
 * One navigable / searchable settings surface. Selectors stay private to the
 * catalog; callers use {@link SettingsTarget.id} only.
 */
export type SettingsTarget = {
    /** Opaque stable id; public API for navigate, search, and SettingsLink. */
    id: string;
    tab: SettingsTabKey;
    /** CSS selector resolved inside `#settings`. */
    selector: string;
    /** i18n key under `labelNs` (default `settings`). */
    labelKey: string;
    /** Namespace for {@link SettingsTarget.labelKey}. */
    labelNs?: "settings" | "reader" | "usage";
    /** Extra lowercase match strings for search; not shown in UI. */
    keywords?: readonly string[];
    /** When set, search omits this entry on other platforms. */
    platform?: "win32";
};

/** CSS class applied briefly after navigate scrolls to a target. */
export const SETTINGS_TARGET_HIGHLIGHT_CLASS = "settings-target-highlight";

/** How long the navigate highlight class stays on the element. */
export const SETTINGS_TARGET_HIGHLIGHT_MS = 1000;

const setting = (
    id: string,
    selector: string,
    labelKey: string,
    extra?: Partial<Pick<SettingsTarget, "keywords" | "platform">>,
): SettingsTarget => ({
    id,
    tab: "settings",
    selector,
    labelKey,
    labelNs: "settings",
    ...extra,
});

const usage = (id: string, selector: string, labelKey: string, keywords?: readonly string[]): SettingsTarget => ({
    id,
    tab: "extras",
    selector,
    labelKey,
    labelNs: "usage",
    keywords,
});

/**
 * Hand-maintained settings / Usage / About targets. Shortcut rows are generated
 * by {@link buildShortcutSettingsTargets}.
 */
export const SETTINGS_TARGETS_STATIC: readonly SettingsTarget[] = [
    setting("setting:default-location", "#settings-default-location", "defaultLocation.title", {
        keywords: ["base dir", "home folder"],
    }),
    setting("setting:theme", "#settings-theme", "theme.title"),
    setting("setting:copy-theme", "#settings-copyTheme", "theme.copyCurrent", {
        keywords: ["clipboard", "share theme"],
    }),
    setting("setting:language", "#settings-language", "language.title"),
    setting("setting:reader-presets", "#settings-reader-presets", "readerPresets.title", {
        keywords: ["preset"],
    }),
    setting("setting:file-explorer", "#settings-fileExplorerOption", "fileExplorer.title", {
        platform: "win32",
        keywords: ["context menu", "shell"],
    }),
    setting("setting:anilist", "#settings-anilist", "anilist.title", { keywords: ["anilist", "tracking"] }),
    setting("setting:library", "#settings-library", "library.title", { keywords: ["covers", "thumbnails"] }),
    setting("setting:db-backup", "#settings-dbBackup", "dbBackup.title", {
        keywords: ["backup", "restore", "database"],
    }),
    setting("setting:pdf", "#settings-pdfScale", "pdf.title", { keywords: ["pdf"] }),
    setting("setting:custom-stylesheet", "#settings-customStylesheet", "customStylesheet.title", {
        keywords: ["css"],
    }),
    setting("setting:custom-temp", "#settings-customTempFolder", "tempFolder.title", {
        keywords: ["temp", "cache"],
    }),
    setting("setting:keep-extracted", "#settings-keepExtractedFiles", "tempFolder.keepTempFiles", {
        keywords: ["temp files", "extract"],
    }),
    setting("setting:other", "#settings-otherSettings", "otherSettings.title"),
    setting(
        "setting:open-directly-from-manga",
        "#settings-openDirectlyFromManga",
        "otherSettings.chapterOpeningShortcut",
    ),
    setting(
        "setting:classic-list-checkboxes",
        "#settings-classicListCheckboxes",
        "otherSettings.classicListCheckboxes",
        { keywords: ["multi-select", "checkbox"] },
    ),
    setting("setting:style", "#settings-styleSettings", "styleSettings.title"),
    setting("setting:reset", "#settings-reset", "reset.title", { keywords: ["danger", "wipe"] }),

    { id: "about", tab: "about", selector: "#settings-about", labelKey: "tabs.about", labelNs: "settings" },

    usage("usage:language", "#settings-usage-language", "language.title"),
    usage("usage:db-backup", "#settings-usage-dbBackup", "dbBackup.title", ["backup"]),
    usage("usage:search-shortcut-keys", "#settings-usage-searchShortcutKeys", "searchShortcuts.title", [
        "search",
        "shortcut",
    ]),
    usage(
        "usage:open-directly-from-manga",
        "#settings-usage-openDirectlyFromManga",
        "homeLocation.openDirectly.link",
    ),
    usage("usage:library", "#settings-usage-library", "covers.title", ["covers"]),
    {
        id: "usage:copy-theme",
        tab: "extras",
        selector: "#settings-usage-copyTheme",
        labelKey: "theme.copyCurrent",
        labelNs: "settings",
        keywords: ["theme", "clipboard"],
    },
    usage("usage:reader-presets", "#settings-usage-readerPresets", "readerPresets.title"),
    usage("usage:pdf-scale", "#settings-usage-pdfScale", "pdfScale.link", ["pdf"]),
    usage("usage:anilist", "#settings-usage-anilist", "anilist.title"),
    usage("usage:epub-background", "#settings-usage-epubBackground", "epubBackground.title"),
    {
        id: "usage:custom-stylesheet",
        tab: "extras",
        selector: "#settings-usage-customStylesheet",
        labelKey: "customStylesheet.title",
        labelNs: "settings",
        keywords: ["css"],
    },
];

/**
 * Builds one `shortcut:<command>` target per {@link SHORTCUT_COMMAND_MAP} entry.
 */
export const buildShortcutSettingsTargets = (): SettingsTarget[] =>
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
