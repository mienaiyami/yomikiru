import { describe, expect, it } from "vitest";
import { reservedKeys, SHORTCUT_LIMIT } from "./constants";

describe("settings constants", () => {
    it("exposes frozen shortcut limits and reserved keys", () => {
        expect(SHORTCUT_LIMIT).toBe(4);
        expect(reservedKeys).toContain("escape");
        expect(Object.isFrozen(SHORTCUT_LIMIT)).toBe(true);
    });
});
