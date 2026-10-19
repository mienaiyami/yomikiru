import { describe, expect, it } from "vitest";
import { parsePhysicalBindingString } from "./binding";
import { compileKeymap } from "./keymap";
import { ingestPersistedKeymap } from "./migrate";
import type { BindingTrigger } from "./types";
import { KEYMAP_SCHEMA_VERSION } from "./types";

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

describe("ingestPersistedKeymap", () => {
    it("treats every present current-format row as an explicit override", () => {
        const result = ingestPersistedKeymap([
            { command: "navToHome", keys: ["h"] },
            { command: "focusPageSearch", keys: [] },
        ]);
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.migratedFrom).toBe("array");
        expect(result.document.overrides.navToHome).toEqual([mustParse("h")]);
        expect(result.document.overrides.focusPageSearch).toEqual([]);
        expect(result.document.overrides.openSettings).toBeUndefined();
        const compiled = compileKeymap(result.document.overrides, "win32");
        expect(compiled.byCommand.get("openSettings")).toEqual([mustParse("ctrl+i")]);
        expect(compiled.byCommand.get("focusPageSearch")).toEqual([]);
    });

    it("preserves unknown commands as inactive and does not execute them", () => {
        const result = ingestPersistedKeymap([
            { command: "navToHome", keys: ["g"] },
            { command: "notARealCommand", keys: ["x"] },
        ]);
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.document.overrides.notARealCommand).toBeUndefined();
        expect(result.document.inactive).toEqual([
            { command: "notARealCommand", bindings: [mustParse("x")], raw: ["x"] },
        ]);
        expect(compileKeymap(result.document.overrides, "win32").byCommand.has("navToHome")).toBe(true);
    });

    it("copies chapter bindings onto Settings tab commands and synthesizes reverse fit", () => {
        const result = ingestPersistedKeymap([
            { command: "nextChapter", keys: ["n"] },
            { command: "prevChapter", keys: [] },
            { command: "cycleFitOptions", keys: ["c"] },
        ]);
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.document.overrides.settingsTabNext).toEqual([mustParse("n")]);
        expect(result.document.overrides.settingsTabPrev).toEqual([]);
        expect(result.document.overrides.cycleFitOptionsReverse).toEqual([mustParse("shift+c")]);
    });

    it("does not overwrite Settings tab or reverse-fit overrides already in the file", () => {
        const result = ingestPersistedKeymap([
            { command: "nextChapter", keys: ["n"] },
            { command: "settingsTabNext", keys: ["tab"] },
            { command: "cycleFitOptions", keys: ["c"] },
            { command: "cycleFitOptionsReverse", keys: ["x"] },
        ]);
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.document.overrides.settingsTabNext).toEqual([mustParse("tab")]);
        expect(result.document.overrides.cycleFitOptionsReverse).toEqual([mustParse("x")]);
    });

    it("imports historical key1/key2 rows as logical triggers and keeps a literal space", () => {
        const result = ingestPersistedKeymap([
            { command: "navToHome", name: "ignored", key1: "H", key2: "" },
            { command: "largeScroll", name: "ignored", key1: " ", key2: "" },
        ]);
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.migratedFrom).toBe("historical");
        expect(result.document.overrides.navToHome).toEqual([
            { kind: "logicalKey", key: "H", ctrl: false, alt: false, shift: false, meta: false },
        ]);
        expect(result.document.overrides.largeScroll).toEqual([
            { kind: "logicalKey", key: " ", ctrl: false, alt: false, shift: false, meta: false },
        ]);
    });

    it("accepts a v1 envelope without marking it as migrated", () => {
        const envelope = {
            schemaVersion: KEYMAP_SCHEMA_VERSION,
            revision: 4,
            overrides: { navToHome: [mustParse("g")] },
        };
        const first = ingestPersistedKeymap(envelope);
        expect(first.status).toBe("ok");
        if (first.status !== "ok") return;
        expect(first.migratedFrom).toBeNull();
        expect(first.document.revision).toBe(4);
        const second = ingestPersistedKeymap(first.document);
        expect(second.status).toBe("ok");
        if (second.status !== "ok") return;
        expect(second.migratedFrom).toBeNull();
        expect(second.document.overrides.navToHome).toEqual(first.document.overrides.navToHome);
    });

    it("refuses to rewrite a newer schema version", () => {
        const result = ingestPersistedKeymap({
            schemaVersion: KEYMAP_SCHEMA_VERSION + 1,
            revision: 0,
            overrides: {},
        });
        expect(result).toEqual({
            status: "unsupportedVersion",
            schemaVersion: KEYMAP_SCHEMA_VERSION + 1,
            raw: { schemaVersion: KEYMAP_SCHEMA_VERSION + 1, revision: 0, overrides: {} },
        });
    });

    it("marks corrupt input without inventing a default document", () => {
        expect(ingestPersistedKeymap("nope").status).toBe("corrupt");
        expect(ingestPersistedKeymap({ hello: true }).status).toBe("corrupt");
    });

    it("skips unknown physical codes in a v1 envelope without failing the file", () => {
        const result = ingestPersistedKeymap({
            schemaVersion: KEYMAP_SCHEMA_VERSION,
            revision: 1,
            overrides: {
                navToHome: [
                    {
                        kind: "keyboard",
                        code: "AudioVolumeUp",
                        ctrl: false,
                        alt: false,
                        shift: false,
                        meta: false,
                    },
                    mustParse("h"),
                ],
            },
        });
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.document.overrides.navToHome).toEqual([mustParse("h")]);
        expect(result.warnings.some((warning) => warning.code === "unsupportedTrigger")).toBe(true);
    });

    it("narrows inactive envelope bindings and skips unknown codes there too", () => {
        const result = ingestPersistedKeymap({
            schemaVersion: KEYMAP_SCHEMA_VERSION,
            revision: 0,
            overrides: {},
            inactive: [
                {
                    command: "legacyRemovedCommand",
                    bindings: [
                        {
                            kind: "keyboard",
                            code: "AudioVolumeUp",
                            ctrl: false,
                            alt: false,
                            shift: false,
                            meta: false,
                        },
                        mustParse("x"),
                    ],
                    raw: { command: "legacyRemovedCommand" },
                },
            ],
        });
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.document.inactive).toEqual([
            {
                command: "legacyRemovedCommand",
                bindings: [mustParse("x")],
                raw: { command: "legacyRemovedCommand" },
            },
        ]);
        expect(result.warnings.some((warning) => warning.code === "unsupportedTrigger")).toBe(true);
    });

    it("preserves mouse bindings with any-modifier matching", () => {
        const result = ingestPersistedKeymap([{ command: "nextPage", keys: ["mouse5"] }]);
        expect(result.status).toBe("ok");
        if (result.status !== "ok") return;
        expect(result.document.overrides.nextPage).toEqual([
            {
                kind: "pointer",
                button: "forward",
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
                modifierMatch: "any",
            },
        ]);
    });
});
