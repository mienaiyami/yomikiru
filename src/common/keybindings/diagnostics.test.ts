import { describe, expect, it } from "vitest";
import { parsePhysicalBindingString } from "./binding";
import { projectBindingDiagnostics } from "./diagnostics";
import { compileKeymap } from "./keymap";
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

describe("projectBindingDiagnostics", () => {
    it("treats reader vs app reuse as harmless info (specificity, not a shared claim)", () => {
        const space = mustParse("space");
        const keymap = compileKeymap({ largeScroll: [space], navToHome: [space] }, "win32");
        const diagnostic = projectBindingDiagnostics(keymap).find(
            (row) => row.commandId === "largeScroll" && row.severity === "info",
        );
        expect(diagnostic).toBeDefined();
        expect(diagnostic?.competitors.find((competitor) => competitor.commandId === "navToHome")?.overlap).toBe(
            "harmless",
        );
    });

    it("warns when two commands that share a context kind use the same trigger", () => {
        const keyD = mustParse("d");
        const keymap = compileKeymap({ nextPage: [keyD], prevPage: [keyD] }, "win32");
        const diagnostic = projectBindingDiagnostics(keymap).find(
            (row) => row.commandId === "nextPage" && row.severity === "warning",
        );
        expect(diagnostic).toBeDefined();
        expect(diagnostic?.competitors.find((competitor) => competitor.commandId === "prevPage")?.overlap).toBe(
            "conflict",
        );
    });

    it("marks manga-only vs book-only reuse as harmless info", () => {
        const keyV = mustParse("v");
        const keymap = compileKeymap(
            {
                cycleFitOptions: [keyV],
                fontSizePlus: [keyV],
            },
            "win32",
        );
        const diagnostic = projectBindingDiagnostics(keymap).find((row) => row.commandId === "cycleFitOptions");
        expect(diagnostic?.severity).toBe("info");
        expect(diagnostic?.competitors).toEqual(
            expect.arrayContaining([expect.objectContaining({ commandId: "fontSizePlus", overlap: "harmless" })]),
        );
    });

    it("treats app-only vs home-and-reader reuse as a conflict (search steals every stack)", () => {
        const slash = mustParse("slash");
        const keymap = compileKeymap({ navToHome: [slash] }, "win32");
        const diagnostic = projectBindingDiagnostics(keymap).find((row) => row.commandId === "navToHome");
        expect(diagnostic?.severity).toBe("warning");
        expect(diagnostic?.competitors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ commandId: "focusPageSearch", overlap: "conflict" }),
            ]),
        );
    });

    it("does not emit diagnostics for unique bindings", () => {
        const keymap = compileKeymap({}, "win32");
        const home = projectBindingDiagnostics(keymap).filter((row) => row.commandId === "navToHome");
        expect(home).toEqual([]);
    });

    it("still reports reader conflicts when Settings-only commands are present", () => {
        const keyD = mustParse("d");
        const keymap = compileKeymap(
            {
                nextPage: [keyD],
                prevPage: [keyD],
                settingsTabNext: [mustParse("bracketright")],
            },
            "win32",
        );
        expect(
            projectBindingDiagnostics(keymap).some(
                (row) => row.commandId === "nextPage" && row.severity === "warning",
            ),
        ).toBe(true);
    });
});
