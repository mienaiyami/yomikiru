import { describe, expect, it } from "vitest";
import { reservedKeys, SHORTCUT_LIMIT, TAB_INFO } from "./constants";

describe("settings constants", () => {
    it("exposes frozen tab indices and shortcut limits", () => {
        expect(TAB_INFO.settings[0]).toBe(0);
        expect(TAB_INFO.extras[1]).toBe("tabs.extras");
        expect(SHORTCUT_LIMIT).toBe(4);
        expect(reservedKeys).toContain("escape");
        expect(Object.isFrozen(TAB_INFO)).toBe(true);
        expect(Object.isFrozen(SHORTCUT_LIMIT)).toBe(true);
    });
});
