import readerEn from "@common/i18n/locales/en/reader.json";
import settingsEn from "@common/i18n/locales/en/settings.json";
import usageEn from "@common/i18n/locales/en/usage.json";
import { SHORTCUT_COMMAND_MAP } from "@utils/keybindings";
import { describe, expect, it } from "vitest";
import { SETTINGS_TABS, settingsTabIndex } from "./constants";
import {
    buildSettingsTargetSearchTexts,
    buildShortcutSettingsTargets,
    collectI18nStringLeaves,
    filterSettingsTargets,
    getAllSettingsTargets,
    getSettingsTarget,
    isSettingsTargetAvailable,
    SETTINGS_TARGETS_STATIC,
    type SettingsTarget,
    settingsTargetContentPaths,
} from "./settingsTargets";

const enCatalogs = { settings: settingsEn, reader: readerEn, usage: usageEn } as const;

/**
 * Walks a dotted path on an i18n JSON object. Test-only; production uses i18next.
 */
const valueAtPath = (root: unknown, path: string): unknown => {
    let cur: unknown = root;
    for (const part of path.split(".")) {
        if (cur === null || typeof cur !== "object" || !(part in cur)) return undefined;
        cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
};

const resolveLabelFromEn = (target: SettingsTarget): string =>
    String(valueAtPath(enCatalogs[target.labelNs], target.labelKey) ?? "");

const getSearchTextsFromEn = (target: SettingsTarget): string[] =>
    buildSettingsTargetSearchTexts(target, resolveLabelFromEn, (ns, path) =>
        valueAtPath(enCatalogs[ns as keyof typeof enCatalogs], path),
    );

describe("SETTINGS_TABS", () => {
    it("exposes stable ordered tab keys and indices", () => {
        expect(SETTINGS_TABS.map((t) => t.key)).toEqual([
            "settings",
            "shortcutKeys",
            "makeTheme",
            "about",
            "extras",
        ]);
        expect(settingsTabIndex("settings")).toBe(0);
        expect(settingsTabIndex("extras")).toBe(4);
        expect(SETTINGS_TABS[2]?.labelKey).toBe("tabs.makeTheme");
    });
});

describe("settingsTargets", () => {
    it("keeps static target ids unique", () => {
        const ids = SETTINGS_TARGETS_STATIC.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("generates one shortcut target per SHORTCUT_COMMAND_MAP command", () => {
        const shortcuts = buildShortcutSettingsTargets();
        expect(shortcuts).toHaveLength(SHORTCUT_COMMAND_MAP.length);
        for (const entry of SHORTCUT_COMMAND_MAP) {
            const target = shortcuts.find((t) => t.id === `shortcut:${entry.command}`);
            expect(target?.selector).toBe(`#settings-shortcut-${entry.command}`);
            expect(target?.tab).toBe("shortcutKeys");
            expect(target?.labelKey).toBe(entry.name);
            expect(target?.labelNs).toBe("reader");
            expect(valueAtPath(readerEn, entry.name)).toEqual(expect.any(String));
        }
    });

    it("places Library before Default Location so search lists the section first", () => {
        const ids = SETTINGS_TARGETS_STATIC.map((t) => t.id);
        expect(ids.indexOf("setting:library")).toBeLessThan(ids.indexOf("setting:default-location"));
        expect(ids.indexOf("setting:library-section-expanded")).toBeLessThan(
            ids.indexOf("setting:default-location"),
        );
        expect(ids.indexOf("setting:default-location")).toBeLessThan(ids.indexOf("setting:scan-default-location"));
        expect(ids.indexOf("setting:scan-default-location")).toBeLessThan(
            ids.indexOf("setting:scan-default-location-interval"),
        );
        expect(ids.indexOf("setting:scan-default-location-interval")).toBeLessThan(
            ids.indexOf("setting:library-folders"),
        );
        expect(ids.indexOf("setting:library-folders")).toBeLessThan(
            ids.indexOf("setting:library-folders-list"),
        );
        expect(ids.indexOf("setting:library-folders-list")).toBeLessThan(ids.indexOf("setting:library-scan-now"));
        expect(ids.indexOf("setting:library-scan-now")).toBeLessThan(
            ids.indexOf("setting:library-clear-unused-progress"),
        );
        expect(getSettingsTarget("setting:default-location")?.groupLabelKey).toBe("library.title");
    });

    it("resolves known ids via getSettingsTarget", () => {
        expect(getSettingsTarget("setting:library")?.selector).toBe("#settings-library");
        expect(getSettingsTarget("setting:library-section-expanded")?.selector).toBe(
            "#settings-library-section-toggle",
        );
        expect(getSettingsTarget("setting:scan-default-location")?.selector).toBe(
            "#settings-scan-default-location",
        );
        expect(getSettingsTarget("setting:scan-default-location-interval")?.selector).toBe(
            "#settings-scan-default-location-interval",
        );
        expect(getSettingsTarget("setting:library-folders")?.selector).toBe("#settings-library-folders");
        expect(getSettingsTarget("setting:library-folders-list")?.selector).toBe(
            "#settings-library-folders-list-toggle",
        );
        expect(getSettingsTarget("setting:library-scan-now")?.selector).toBe("#settings-library-scan-now");
        expect(getSettingsTarget("setting:library-clear-unused-progress")?.selector).toBe(
            "#settings-library-clear-unused-progress",
        );
        expect(getSettingsTarget("about")?.tab).toBe("about");
        expect(getSettingsTarget("missing:id")).toBeUndefined();
        expect(getAllSettingsTargets().length).toBe(SETTINGS_TARGETS_STATIC.length + SHORTCUT_COMMAND_MAP.length);
    });

    it("filters win32-only targets by platform", () => {
        const explorer = getSettingsTarget("setting:file-explorer");
        expect(explorer).toBeDefined();
        expect(isSettingsTargetAvailable(explorer!, "win32")).toBe(true);
        expect(isSettingsTargetAvailable(explorer!, "linux")).toBe(false);
        const library = getSettingsTarget("setting:library");
        expect(isSettingsTargetAvailable(library!, "linux")).toBe(true);
    });

    it("every static contentPath exists on the English catalog for its namespace", () => {
        for (const target of SETTINGS_TARGETS_STATIC) {
            for (const path of settingsTargetContentPaths(target)) {
                expect({
                    id: target.id,
                    path,
                    value: valueAtPath(enCatalogs[target.labelNs], path),
                }).toEqual({
                    id: target.id,
                    path,
                    value: expect.anything(),
                });
            }
        }
    });

    it("indexes Other Settings and Style Settings controls separately from the section heading", () => {
        expect(getSettingsTarget("setting:hardware-acceleration")?.selector).toBe(
            "#settings-hardwareAcceleration",
        );
        expect(getSettingsTarget("setting:other")?.contentPath).toBeUndefined();
        expect(getSettingsTarget("setting:location-list-numbering")?.selector).toBe(
            "#settings-locationListNumbering",
        );
        expect(getSettingsTarget("setting:style")?.contentPath).toBeUndefined();
    });

    it("does not keep the removed manga side-list book-file badge target", () => {
        expect(getSettingsTarget("setting:show-text-file-badge")).toBeUndefined();
    });
});

describe("collectI18nStringLeaves", () => {
    it("flattens nested objects and arrays into strings", () => {
        expect(collectI18nStringLeaves({ a: "one", b: { c: "two", d: ["three"] } })).toEqual([
            "one",
            "two",
            "three",
        ]);
    });
});

describe("filterSettingsTargets", () => {
    const sample: SettingsTarget[] = [
        {
            id: "setting:library",
            tab: "settings",
            selector: "#settings-library",
            labelNs: "settings",
            labelKey: "library.title",
            keywords: ["covers", "thumbnails"],
            contentPath: "library",
        },
        {
            id: "setting:anilist",
            tab: "settings",
            selector: "#settings-anilist",
            labelNs: "settings",
            labelKey: "anilist.title",
            contentPath: "anilist",
        },
        {
            id: "about",
            tab: "about",
            selector: "#settings-about",
            labelNs: "settings",
            labelKey: "tabs.about",
        },
    ];

    const content: Record<string, unknown> = {
        library: { title: "Library", clearCache: "Clear thumbnail cache" },
        anilist: {
            title: "AniList",
            autoUpdate: "Auto-Update AniList Progress",
        },
    };

    const resolveLabel = (t: SettingsTarget) => {
        if (t.id === "about") return "About";
        if (t.id === "setting:anilist") return "AniList";
        return "Library";
    };

    const getSearchTexts = (target: SettingsTarget) =>
        buildSettingsTargetSearchTexts(target, resolveLabel, (_ns, path) => content[path]);

    it("returns empty for blank query", () => {
        expect(filterSettingsTargets(sample, "", getSearchTexts)).toEqual([]);
        expect(filterSettingsTargets(sample, "   ", getSearchTexts)).toEqual([]);
    });

    it("matches label case-insensitively", () => {
        expect(filterSettingsTargets(sample, "LIB", getSearchTexts).map((t) => t.id)).toEqual(["setting:library"]);
        expect(filterSettingsTargets(sample, "about", getSearchTexts).map((t) => t.id)).toEqual(["about"]);
    });

    it("matches keywords without requiring label hit", () => {
        expect(filterSettingsTargets(sample, "thumbnails", getSearchTexts).map((t) => t.id)).toEqual([
            "setting:library",
        ]);
    });

    it("matches contentPath body copy", () => {
        expect(filterSettingsTargets(sample, "auto", getSearchTexts).map((t) => t.id)).toEqual([
            "setting:anilist",
        ]);
        expect(filterSettingsTargets(sample, "thumbnail cache", getSearchTexts).map((t) => t.id)).toEqual([
            "setting:library",
        ]);
    });

    it("does not fuzzy-match unrelated strings", () => {
        expect(filterSettingsTargets(sample, "xyzzy", getSearchTexts)).toEqual([]);
    });

    it("does not match the Other Settings heading on a child control query", () => {
        const ids = filterSettingsTargets(
            SETTINGS_TARGETS_STATIC,
            "hardware acceleration",
            getSearchTextsFromEn,
        ).map((t) => t.id);
        expect(ids).toContain("setting:hardware-acceleration");
        expect(ids).not.toContain("setting:other");
    });
});
