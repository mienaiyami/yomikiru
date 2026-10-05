import { describe, expect, it } from "vitest";
import {
    formatTriggerAsMenuAccelerator,
    formatTriggerForDisplay,
    parsePhysicalBindingString,
    serializeTrigger,
    triggerMatchesLive,
    triggersEqual,
    triggersMayOverlap,
} from "./binding";
import type {
    KeyboardCode,
    KeyboardTrigger,
    KeyModifiers,
    LiveKeyboardTrigger,
    LogicalKeyTrigger,
    PointerTrigger,
} from "./types";
import { isKeyboardCode, keyModifiers } from "./types";

const kbd = (code: KeyboardCode, mods: Partial<KeyModifiers> = {}): KeyboardTrigger => ({
    kind: "keyboard",
    code,
    ...keyModifiers(mods),
});

describe("parsePhysicalBindingString", () => {
    it("accepts catalog KeyboardCode values and rejects modifiers", () => {
        expect(isKeyboardCode("KeyA")).toBe(true);
        expect(isKeyboardCode("ControlLeft")).toBe(false);
        expect(isKeyboardCode("Unidentified")).toBe(false);
    });
    it("parses letters, digits, arrows, and numpad codes with exact modifiers", () => {
        expect(parsePhysicalBindingString("ctrl+shift+a")).toEqual({
            ok: true,
            trigger: kbd("KeyA", { ctrl: true, shift: true }),
        });
        expect(parsePhysicalBindingString("5")).toEqual({ ok: true, trigger: kbd("Digit5") });
        expect(parsePhysicalBindingString("down")).toEqual({ ok: true, trigger: kbd("ArrowDown") });
        expect(parsePhysicalBindingString("numpad_plus")).toEqual({ ok: true, trigger: kbd("NumpadAdd") });
        expect(parsePhysicalBindingString("pagedown")).toEqual({ ok: true, trigger: kbd("PageDown") });
        expect(parsePhysicalBindingString("meta+s")).toEqual({
            ok: true,
            trigger: kbd("KeyS", { meta: true }),
        });
    });

    it("maps mouse4/mouse5 to pointer triggers with any-modifier matching", () => {
        expect(parsePhysicalBindingString("mouse4")).toEqual({
            ok: true,
            trigger: {
                kind: "pointer",
                button: "back",
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
                modifierMatch: "any",
            } satisfies PointerTrigger,
        });
        expect(parsePhysicalBindingString("ctrl+mouse5")).toEqual({
            ok: true,
            trigger: {
                kind: "pointer",
                button: "forward",
                ctrl: true,
                alt: false,
                shift: false,
                meta: false,
                modifierMatch: "any",
            },
        });
    });

    it("rejects empty, modifier-only, and unknown physical tokens", () => {
        expect(parsePhysicalBindingString("").ok).toBe(false);
        expect(parsePhysicalBindingString("ctrl+shift").ok).toBe(false);
        expect(parsePhysicalBindingString("not-a-key").ok).toBe(false);
    });

    it("does not equate Ctrl and Meta", () => {
        const ctrlS = parsePhysicalBindingString("ctrl+s");
        const metaS = parsePhysicalBindingString("meta+s");
        expect(ctrlS.ok && metaS.ok).toBe(true);
        if (!ctrlS.ok || !metaS.ok) return;
        expect(triggersEqual(ctrlS.trigger, metaS.trigger)).toBe(false);
    });
});

describe("trigger matching and overlap", () => {
    it("matches pointer any-modifiers regardless of which modifiers are held", () => {
        const binding: PointerTrigger = {
            kind: "pointer",
            button: "back",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
            modifierMatch: "any",
        };
        expect(
            triggerMatchesLive(binding, {
                kind: "pointer",
                button: "back",
                ctrl: true,
                alt: false,
                shift: false,
                meta: false,
            }),
        ).toBe(true);
        expect(
            triggerMatchesLive(binding, {
                kind: "pointer",
                button: "forward",
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
            }),
        ).toBe(false);
    });

    it("matches a logical key against the live KeyboardEvent.key, not code", () => {
        const binding: LogicalKeyTrigger = {
            kind: "logicalKey",
            key: "a",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        const live: LiveKeyboardTrigger = {
            kind: "keyboard",
            code: "KeyA",
            key: "a",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
            repeat: false,
        };
        expect(triggerMatchesLive(binding, live)).toBe(true);
        expect(triggerMatchesLive(binding, { ...live, key: "A", shift: true })).toBe(false);
    });

    it("matches historical logical letters on AZERTY via key, and physical home-row via code", () => {
        const logicalA: LogicalKeyTrigger = {
            kind: "logicalKey",
            key: "a",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        const azertyA: LiveKeyboardTrigger = {
            kind: "keyboard",
            code: "KeyQ",
            key: "a",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
            repeat: false,
        };
        const azertyQOnKeyA: LiveKeyboardTrigger = {
            kind: "keyboard",
            code: "KeyA",
            key: "q",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
            repeat: false,
        };
        expect(triggerMatchesLive(logicalA, azertyA)).toBe(true);
        expect(triggerMatchesLive(kbd("KeyA"), azertyQOnKeyA)).toBe(true);
        expect(triggerMatchesLive(kbd("KeyA"), azertyA)).toBe(false);
        expect(triggerMatchesLive(logicalA, azertyQOnKeyA)).toBe(false);
    });

    it("reports conservative overlap between logical characters and physical letter codes", () => {
        const physical = kbd("KeyA");
        const logicalA: LogicalKeyTrigger = {
            kind: "logicalKey",
            key: "a",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        const logicalSlash: LogicalKeyTrigger = {
            kind: "logicalKey",
            key: "/",
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        expect(triggersMayOverlap(physical, logicalA)).toBe(true);
        expect(triggersMayOverlap(physical, logicalSlash)).toBe(false);
        expect(triggersMayOverlap(kbd("KeyA"), kbd("KeyB"))).toBe(false);
        expect(
            triggersMayOverlap(
                {
                    kind: "pointer",
                    button: "back",
                    ctrl: false,
                    alt: false,
                    shift: false,
                    meta: false,
                    modifierMatch: "any",
                },
                {
                    kind: "pointer",
                    button: "back",
                    ctrl: true,
                    alt: false,
                    shift: false,
                    meta: false,
                    modifierMatch: "exact",
                },
            ),
        ).toBe(true);
    });

    it("round-trips a physical trigger through serializeTrigger", () => {
        const parsed = parsePhysicalBindingString("alt+bracketleft");
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(serializeTrigger(parsed.trigger)).toBe("alt+BracketLeft");
        expect(parsePhysicalBindingString("alt+BracketLeft")).toEqual(parsed);
    });

    it("formats display labels without using persisted identity strings", () => {
        const parsed = parsePhysicalBindingString("ctrl+shift+a");
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(formatTriggerForDisplay(parsed.trigger)).toBe("Ctrl+Shift+A");
        const mouse = parsePhysicalBindingString("mouse4");
        expect(mouse.ok).toBe(true);
        if (!mouse.ok) return;
        expect(formatTriggerForDisplay(mouse.trigger)).toBe("Mouse Back");
        expect(formatTriggerForDisplay(kbd("ArrowDown"))).toBe("Down");
    });

    it("formats Electron menu accelerators without registering them", () => {
        const parsed = parsePhysicalBindingString("ctrl+n");
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(formatTriggerAsMenuAccelerator(parsed.trigger)).toBe("Control+N");
        const shifted = parsePhysicalBindingString("ctrl+shift+r");
        expect(shifted.ok).toBe(true);
        if (!shifted.ok) return;
        expect(formatTriggerAsMenuAccelerator(shifted.trigger)).toBe("Control+Shift+R");
        const mouse = parsePhysicalBindingString("mouse4");
        expect(mouse.ok).toBe(true);
        if (!mouse.ok) return;
        expect(formatTriggerAsMenuAccelerator(mouse.trigger)).toBe("");
        expect(formatTriggerAsMenuAccelerator(kbd("F1"))).toBe("F1");
    });
});
