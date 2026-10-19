import { describe, expect, it } from "vitest";
import { SETTINGS_TABS, settingsTabIndex } from "./constants";

describe("settings constants", () => {
    it("exposes stable ordered tab keys and indices", () => {
        expect(SETTINGS_TABS.map((tab) => tab.key)).toEqual([
            "settings",
            "shortcutKeys",
            "makeTheme",
            "about",
            "extras",
        ]);
        expect(settingsTabIndex("settings")).toBe(0);
        expect(settingsTabIndex("extras")).toBe(4);
    });
});
