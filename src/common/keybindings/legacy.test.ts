import { describe, expect, it } from "vitest";
import { parsePhysicalBindingString } from "./binding";
import { parseHistoricalKeyString, withShift } from "./legacy";
import type { LogicalKeyTrigger } from "./types";
import { keyModifiers } from "./types";

describe("parseHistoricalKeyString", () => {
    it("keeps character identity as a logical trigger when the physical code is not proved", () => {
        expect(parseHistoricalKeyString("A")).toEqual({
            ok: true,
            trigger: {
                kind: "logicalKey",
                key: "A",
                ...keyModifiers(),
            } satisfies LogicalKeyTrigger,
        });
        expect(parseHistoricalKeyString("/")).toEqual({
            ok: true,
            trigger: {
                kind: "logicalKey",
                key: "/",
                ...keyModifiers(),
            },
        });
    });

    it("preserves a literal space character and treats empty as unbound", () => {
        expect(parseHistoricalKeyString(" ")).toEqual({
            ok: true,
            trigger: {
                kind: "logicalKey",
                key: " ",
                ...keyModifiers(),
            },
        });
        expect(parseHistoricalKeyString("")).toEqual({ ok: false, reason: "empty" });
    });
});

describe("withShift", () => {
    it("adds Shift to an unshifted physical trigger and returns null when already shifted", () => {
        const parsed = parsePhysicalBindingString("a");
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(withShift(parsed.trigger)).toEqual({
            kind: "keyboard",
            code: "KeyA",
            ...keyModifiers({ shift: true }),
        });
        expect(withShift({ kind: "keyboard", code: "KeyA", ...keyModifiers({ shift: true }) })).toBeNull();
    });
});
