import readerEn from "@common/i18n/locales/en/reader.json";
import { describe, expect, it } from "vitest";
import { COMMAND_CATALOG, getCommand, resolveDefaultBindings } from "./catalog";

/**
 * Baseline command ids from the inspected `SHORTCUT_COMMAND_MAP` (commit named
 * in the keybinding spec). Kept as a literal so catalog drift is visible.
 */
const BASELINE_COMMAND_IDS = [
    "navToPage",
    "toggleZenMode",
    "largeScroll",
    "largeScrollReverse",
    "scrollDown",
    "scrollUp",
    "prevPage",
    "nextPage",
    "nextChapter",
    "prevChapter",
    "focusPageSearch",
    "randomChapter",
    "bookmark",
    "sizePlus",
    "sizeMinus",
    "readerSettings",
    "savePreset",
    "cyclePresetNext",
    "cyclePresetPrev",
    "selectPreset1",
    "selectPreset2",
    "selectPreset3",
    "selectPreset4",
    "selectPreset5",
    "showHidePageNumberInZen",
    "cycleFitOptions",
    "selectReaderMode0",
    "selectReaderMode1",
    "selectReaderMode2",
    "selectPagePerRow1",
    "selectPagePerRow2",
    "selectPagePerRow2odd",
    "fontSizePlus",
    "fontSizeMinus",
    "navToHome",
    "dirUp",
    "contextMenu",
    "readerSize_50",
    "readerSize_100",
    "readerSize_150",
    "readerSize_200",
    "readerSize_250",
    "openSettings",
    "uiSizeReset",
    "uiSizeDown",
    "uiSizeUp",
    "listDown",
    "listUp",
    "listSelect",
    "cycleBar1Prev",
    "cycleBar1Next",
    "cycleBar2Prev",
    "cycleBar2Next",
    "deleteSelected",
] as const;

const NEW_CONFIGURABLE_IDS = [
    "cycleFitOptionsReverse",
    "settingsTabNext",
    "settingsTabPrev",
    "newWindow",
    "closeWindow",
    "reload",
    "forceReload",
    "toggleDevTools",
    "help",
    "selectAll",
] as const;

describe("COMMAND_CATALOG", () => {
    it("is frozen and has unique ids and unique tieOrder values", () => {
        expect(Object.isFrozen(COMMAND_CATALOG)).toBe(true);
        const ids = COMMAND_CATALOG.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
        const tieOrders = COMMAND_CATALOG.map((entry) => entry.tieOrder);
        expect(new Set(tieOrders).size).toBe(tieOrders.length);
    });

    it("keeps catalog ids aligned with reader.shortcutNames keys", () => {
        expect(new Set(COMMAND_CATALOG.map((entry) => entry.id))).toEqual(
            new Set(Object.keys(readerEn.shortcutNames)),
        );
    });

    it("preserves every baseline command id", () => {
        for (const commandId of BASELINE_COMMAND_IDS) {
            const entry = getCommand(commandId);
            expect(entry, commandId).toBeDefined();
            expect(entry?.labelKey).toBe(`shortcutNames.${commandId}`);
        }
    });

    it("adds commands for previously fixed app actions and split overloads", () => {
        for (const commandId of NEW_CONFIGURABLE_IDS) {
            expect(getCommand(commandId), commandId).toBeDefined();
        }
    });

    it("keeps focusPageSearch on Slash and Ctrl+Shift+F, not Ctrl+Slash", () => {
        const entry = getCommand("focusPageSearch");
        expect(entry?.defaultBindings).toEqual([
            { kind: "keyboard", code: "Slash", ctrl: false, alt: false, shift: false, meta: false },
            { kind: "keyboard", code: "KeyF", ctrl: true, alt: false, shift: true, meta: false },
        ]);
        expect(getCommand("focusSideListSearch")).toBeUndefined();
    });

    it("defaults deleteSelected to Delete and tab-bar cycles to distinct Alt chords", () => {
        expect(getCommand("deleteSelected")?.defaultBindings).toEqual([
            { kind: "keyboard", code: "Delete", ctrl: false, alt: false, shift: false, meta: false },
        ]);
        expect(getCommand("cycleBar1Prev")?.defaultBindings).toEqual([
            { kind: "keyboard", code: "BracketLeft", ctrl: false, alt: true, shift: false, meta: false },
        ]);
        expect(getCommand("cycleBar1Next")?.defaultBindings).toEqual([
            { kind: "keyboard", code: "BracketRight", ctrl: false, alt: true, shift: false, meta: false },
        ]);
        expect(getCommand("cycleBar2Prev")?.defaultBindings).toEqual([
            { kind: "keyboard", code: "Minus", ctrl: false, alt: true, shift: false, meta: false },
        ]);
        expect(getCommand("cycleBar2Next")?.defaultBindings).toEqual([
            { kind: "keyboard", code: "Equal", ctrl: false, alt: true, shift: false, meta: false },
        ]);
    });

    it("gives Settings tab commands the former chapter-key defaults without sharing identity", () => {
        expect(getCommand("settingsTabNext")?.defaultBindings).toEqual(getCommand("nextChapter")?.defaultBindings);
        expect(getCommand("settingsTabPrev")?.defaultBindings).toEqual(getCommand("prevChapter")?.defaultBindings);
        expect(getCommand("settingsTabNext")?.id).not.toBe("nextChapter");
        expect(getCommand("settingsTabNext")?.contextKinds).toEqual(["settings"]);
        expect(getCommand("nextChapter")?.contextKinds).toContain("mangaReader");
    });

    it("exposes reverse fit as its own command so Shift is not an implicit branch", () => {
        const reverse = getCommand("cycleFitOptionsReverse");
        expect(reverse?.defaultBindings).toEqual([
            { kind: "keyboard", code: "KeyV", ctrl: false, alt: false, shift: true, meta: false },
        ]);
        expect(getCommand("cycleFitOptions")?.defaultBindings).toEqual([
            { kind: "keyboard", code: "KeyV", ctrl: false, alt: false, shift: false, meta: false },
        ]);
    });

    it("uses Meta chords on darwin for previously native window actions", () => {
        const newWindow = getCommand("newWindow");
        expect(newWindow).toBeDefined();
        if (!newWindow) return;
        expect(resolveDefaultBindings(newWindow, "win32")).toEqual([
            { kind: "keyboard", code: "KeyN", ctrl: true, alt: false, shift: false, meta: false },
        ]);
        expect(resolveDefaultBindings(newWindow, "darwin")).toEqual([
            { kind: "keyboard", code: "KeyN", ctrl: false, alt: false, shift: false, meta: true },
        ]);
        const selectAll = getCommand("selectAll");
        expect(selectAll?.defaultBindings).toEqual([
            { kind: "keyboard", code: "KeyA", ctrl: true, alt: false, shift: false, meta: false },
            { kind: "keyboard", code: "KeyA", ctrl: false, alt: false, shift: false, meta: true },
        ]);
        expect(getCommand("openSettings")?.darwinDefaultBindings).toBeUndefined();
        expect(getCommand("savePreset")?.darwinDefaultBindings).toBeUndefined();
    });

    it("marks list navigation as ownInputs and held scroll as held", () => {
        expect(getCommand("listDown")?.inputPolicy).toBe("ownInputs");
        expect(getCommand("listSelect")?.invocation).toBe("oneShot");
        expect(getCommand("scrollDown")?.invocation).toBe("held");
        expect(getCommand("savePreset")?.invocation).toBe("oneShot");
        expect(getCommand("prevPage")?.invocation).toBe("osRepeat");
        expect(getCommand("uiSizeUp")?.invocation).toBe("osRepeat");
    });

    it("stores KeyboardCode on default keyboard bindings", () => {
        const home = getCommand("navToHome")?.defaultBindings[0];
        expect(home?.kind).toBe("keyboard");
        if (home?.kind !== "keyboard") return;
        expect(home.code).toBe("KeyH");
    });

    it("routes contextMenu through focused lists and menu overlays", () => {
        const kinds = getCommand("contextMenu")?.contextKinds ?? [];
        expect(kinds).toContain("searchWidget");
        expect(kinds).toContain("menu");
        expect(kinds).toContain("home");
        expect(getCommand("contextMenu")?.inputPolicy).toBe("ownOrIdle");
    });

    it("copies default binding arrays so callers cannot mutate the catalog", () => {
        const entry = getCommand("navToHome");
        expect(entry).toBeDefined();
        if (!entry) return;
        expect(Object.isFrozen(entry.defaultBindings)).toBe(true);
        const resolved = resolveDefaultBindings(entry, "win32");
        expect(resolved).not.toBe(entry.defaultBindings);
        expect(resolved).toEqual(entry.defaultBindings);
    });
});
