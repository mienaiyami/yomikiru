import { describe, expect, it } from "vitest";
import { parsePhysicalBindingString } from "./binding";
import { applyKeymapEdit, effectiveBindingsFor, emptyKeymapDocument } from "./edit";
import type { BindingTrigger } from "./types";

/**
 * Parses a known-good physical combination used as a test fixture.
 *
 * @throws {Error} If `raw` is not a valid physical binding string
 */
const mustParse = (raw: string): BindingTrigger => {
    const parsed = parsePhysicalBindingString(raw);
    if (!parsed.ok) throw new Error(`expected physical binding ${raw}`);
    return parsed.trigger;
};

describe("applyKeymapEdit", () => {
    it("adds a binding as an explicit override and bumps revision", () => {
        const document = emptyKeymapDocument();
        const expected = effectiveBindingsFor(document, "navToHome", "win32");
        const result = applyKeymapEdit(
            document,
            { type: "addBinding", commandId: "navToHome", trigger: mustParse("g"), expectedBindings: expected },
            "win32",
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.changed).toBe(true);
        expect(result.document.revision).toBe(1);
        expect(result.document.overrides.navToHome).toEqual([...expected, mustParse("g")]);
    });

    it("treats adding an identical binding as a no-op", () => {
        const document = emptyKeymapDocument();
        const expected = effectiveBindingsFor(document, "navToHome", "win32");
        const home = expected[0];
        expect(home).toBeDefined();
        if (!home) return;
        const result = applyKeymapEdit(
            document,
            { type: "addBinding", commandId: "navToHome", trigger: home, expectedBindings: expected },
            "win32",
        );
        expect(result).toEqual({ ok: true, document, changed: false });
    });

    it("rejects a same-command edit when expected bindings are stale", () => {
        const base = emptyKeymapDocument();
        const firstExpected = effectiveBindingsFor(base, "navToHome", "win32");
        const first = applyKeymapEdit(
            base,
            {
                type: "addBinding",
                commandId: "navToHome",
                trigger: mustParse("g"),
                expectedBindings: firstExpected,
            },
            "win32",
        );
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        const stale = applyKeymapEdit(
            first.document,
            {
                type: "addBinding",
                commandId: "navToHome",
                trigger: mustParse("j"),
                expectedBindings: firstExpected,
            },
            "win32",
        );
        expect(stale.ok).toBe(false);
        if (stale.ok) return;
        expect(stale.code).toBe("stale");
        expect(stale.document.revision).toBe(first.document.revision);
    });

    it("merges an edit to a different command after another command changed", () => {
        const base = emptyKeymapDocument();
        const homeExpected = effectiveBindingsFor(base, "navToHome", "win32");
        const afterHome = applyKeymapEdit(
            base,
            {
                type: "addBinding",
                commandId: "navToHome",
                trigger: mustParse("g"),
                expectedBindings: homeExpected,
            },
            "win32",
        );
        expect(afterHome.ok).toBe(true);
        if (!afterHome.ok) return;
        const bookmarkExpected = effectiveBindingsFor(afterHome.document, "bookmark", "win32");
        const afterBookmark = applyKeymapEdit(
            afterHome.document,
            {
                type: "addBinding",
                commandId: "bookmark",
                trigger: mustParse("n"),
                expectedBindings: bookmarkExpected,
            },
            "win32",
        );
        expect(afterBookmark.ok).toBe(true);
        if (!afterBookmark.ok) return;
        expect(afterBookmark.document.overrides.navToHome).toEqual(afterHome.document.overrides.navToHome);
        expect(afterBookmark.document.overrides.bookmark).toContainEqual(mustParse("n"));
        expect(afterBookmark.document.revision).toBe(2);
    });

    it("reset-all requires the current revision and clears overrides", () => {
        const base = emptyKeymapDocument();
        const expected = effectiveBindingsFor(base, "navToHome", "win32");
        const edited = applyKeymapEdit(
            base,
            { type: "addBinding", commandId: "navToHome", trigger: mustParse("g"), expectedBindings: expected },
            "win32",
        );
        expect(edited.ok).toBe(true);
        if (!edited.ok) return;
        const staleReset = applyKeymapEdit(edited.document, { type: "resetAll", expectedRevision: 0 }, "win32");
        expect(staleReset.ok).toBe(false);
        const reset = applyKeymapEdit(
            edited.document,
            { type: "resetAll", expectedRevision: edited.document.revision },
            "win32",
        );
        expect(reset.ok).toBe(true);
        if (!reset.ok) return;
        expect(reset.document.overrides).toEqual({});
        expect(reset.document.revision).toBe(2);
    });
});
