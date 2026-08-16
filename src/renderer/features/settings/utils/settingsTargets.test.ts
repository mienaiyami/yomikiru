import { SHORTCUT_COMMAND_MAP } from "@utils/keybindings";
import { describe, expect, it } from "vitest";
import { SETTINGS_TABS, settingsTabIndex } from "./constants";
import {
    buildShortcutSettingsTargets,
    getAllSettingsTargets,
    getSettingsTarget,
    isSettingsTargetAvailable,
    SETTINGS_TARGETS_STATIC,
} from "./settingsTargets";

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
        }
    });

    it("resolves known ids via getSettingsTarget", () => {
        expect(getSettingsTarget("setting:library")?.selector).toBe("#settings-library");
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
});
