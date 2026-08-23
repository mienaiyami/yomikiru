import { describe, expect, it } from "vitest";
import { keysFor, PRESET_SLOT_COMMANDS } from "./usageKeys";

describe("usageKeys", () => {
    it("joins keys for a bound command", () => {
        expect(keysFor([{ command: "listDown", keys: ["ArrowDown", "j"] }], "listDown")).toBe("ArrowDown, j");
    });

    it("returns an empty string for an unbound command", () => {
        expect(keysFor([{ command: "listDown", keys: ["ArrowDown"] }], "listUp")).toBe("");
    });

    it("exposes preset slot commands 1-5 in display order", () => {
        expect(PRESET_SLOT_COMMANDS).toEqual([
            "selectPreset1",
            "selectPreset2",
            "selectPreset3",
            "selectPreset4",
            "selectPreset5",
        ]);
    });
});
