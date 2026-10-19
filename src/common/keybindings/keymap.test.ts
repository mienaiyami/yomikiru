import { describe, expect, it } from "vitest";
import { parsePhysicalBindingString } from "./binding";
import { emptyKeymapDocument } from "./edit";
import {
    compileKeymap,
    firstBindingMenuAccelerator,
    lookupCandidates,
    resolveCommand,
    toShortcutDisplayEntries,
} from "./keymap";
import type { BindingTrigger, KeyboardCode, LiveKeyboardTrigger } from "./types";

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

const liveKey = (
    code: KeyboardCode,
    key: string,
    mods: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; repeat?: boolean } = {},
): LiveKeyboardTrigger => ({
    kind: "keyboard",
    code,
    key,
    ctrl: Boolean(mods.ctrl),
    alt: Boolean(mods.alt),
    shift: Boolean(mods.shift),
    meta: Boolean(mods.meta),
    repeat: Boolean(mods.repeat),
});

describe("compileKeymap", () => {
    it("inherits defaults when a command has no override", () => {
        const keymap = compileKeymap({}, "win32");
        expect(keymap.byCommand.get("navToHome")).toEqual([mustParse("h")]);
        expect(keymap.byCommand.get("selectReaderMode2")).toEqual([]);
    });

    it("treats an empty override as an explicit unbind", () => {
        const keymap = compileKeymap({ navToHome: [] }, "win32");
        expect(keymap.byCommand.get("navToHome")).toEqual([]);
    });

    it("dedupes identical triggers on the same command", () => {
        const keymap = compileKeymap({ navToHome: [mustParse("h"), mustParse("h"), mustParse("g")] }, "win32");
        expect(keymap.byCommand.get("navToHome")).toEqual([mustParse("h"), mustParse("g")]);
    });

    it("uses darwin Meta defaults for newWindow when no override exists", () => {
        const win = compileKeymap({}, "win32").byCommand.get("newWindow");
        const mac = compileKeymap({}, "darwin").byCommand.get("newWindow");
        expect(win).toEqual([mustParse("ctrl+n")]);
        expect(mac).toEqual([mustParse("meta+n")]);
    });
});

describe("resolveCommand", () => {
    it("picks the most specific active context when two commands share a trigger", () => {
        const space = mustParse("space");
        const keymap = compileKeymap(
            {
                largeScroll: [space],
                navToHome: [space],
            },
            "win32",
        );
        const live = liveKey("Space", " ");
        const inReader = resolveCommand(keymap, live, ["mangaReader", "app"]);
        expect(inReader.outcome).toBe("handled");
        if (inReader.outcome !== "handled") return;
        expect(inReader.candidate.commandId).toBe("largeScroll");
        expect(inReader.context).toBe("mangaReader");

        const atHome = resolveCommand(keymap, live, ["app"]);
        expect(atHome.outcome).toBe("handled");
        if (atHome.outcome !== "handled") return;
        expect(atHome.candidate.commandId).toBe("navToHome");
    });

    it("uses catalog tieOrder when two commands share a context and trigger", () => {
        const keyV = mustParse("v");
        const keymap = compileKeymap(
            {
                cycleFitOptions: [keyV],
                bookmark: [keyV],
            },
            "win32",
        );
        const live = liveKey("KeyV", "v");
        const result = resolveCommand(keymap, live, ["mangaReader"]);
        expect(result.outcome).toBe("handled");
        if (result.outcome !== "handled") return;
        expect(result.candidate.commandId).toBe("bookmark");
    });

    it("does not let a hidden reader steal an app command", () => {
        const keymap = compileKeymap({}, "win32");
        const live = liveKey("KeyH", "h");
        const result = resolveCommand(keymap, live, ["app"]);
        expect(result.outcome).toBe("handled");
        if (result.outcome !== "handled") return;
        expect(result.candidate.commandId).toBe("navToHome");
        expect(lookupCandidates(keymap, live).some((candidate) => candidate.commandId === "navToHome")).toBe(true);
    });

    it("returns unmatched when no owner claims the trigger", () => {
        const keymap = compileKeymap({}, "win32");
        const live = liveKey("KeyV", "v");
        expect(resolveCommand(keymap, live, ["app"]).outcome).toBe("unmatched");
        expect(resolveCommand(keymap, live, ["bookReader"]).outcome).toBe("unmatched");
    });

    it("is independent of candidate list order (registration order)", () => {
        const keymap = compileKeymap({}, "win32");
        const reversed = {
            ...keymap,
            candidates: [...keymap.candidates].reverse(),
        };
        const live = liveKey("Space", " ");
        const a = resolveCommand(keymap, live, ["mangaReader", "app"]);
        const b = resolveCommand(reversed, live, ["mangaReader", "app"]);
        expect(a).toEqual(b);
        expect(a.outcome === "handled" && a.candidate.commandId).toBe("largeScroll");
    });
});

describe("toShortcutDisplayEntries", () => {
    it("emits display labels for every catalog command", () => {
        const rows = toShortcutDisplayEntries(emptyKeymapDocument(), "win32");
        expect(rows.find((row) => row.command === "navToHome")?.keys).toEqual(["H"]);
        expect(rows.find((row) => row.command === "prevPage")?.keys).toEqual(["A", "Left", "Mouse Back"]);
        expect(rows.some((row) => row.command === "newWindow")).toBe(true);
        expect(rows.some((row) => row.command === "cycleFitOptionsReverse")).toBe(true);
    });
});

describe("firstBindingMenuAccelerator", () => {
    it("returns the first keyboard accelerator and empty when unbound", () => {
        expect(firstBindingMenuAccelerator(emptyKeymapDocument(), "newWindow", "win32")).toBe("Control+N");
        expect(firstBindingMenuAccelerator(emptyKeymapDocument(), "help", "win32")).toBe("F1");
        expect(firstBindingMenuAccelerator(emptyKeymapDocument(), "newWindow", "darwin")).toBe("Meta+N");
        const unbound = emptyKeymapDocument();
        unbound.overrides.newWindow = [];
        expect(firstBindingMenuAccelerator(unbound, "newWindow", "win32")).toBe("");
    });
});
