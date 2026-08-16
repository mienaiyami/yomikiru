import { describe, expect, it, vi } from "vitest";
import {
    healShortcutEntries,
    isShortcutEventFromInputTarget,
    keyFormatter,
    mouseEventFormatter,
    SHORTCUT_COMMAND_MAP,
} from "./keybindings";

const keyEvent = (partial: Partial<KeyboardEvent> & Pick<KeyboardEvent, "code" | "key">): KeyboardEvent =>
    partial as KeyboardEvent;

describe("SHORTCUT_COMMAND_MAP", () => {
    it("is frozen and has unique commands", () => {
        expect(Object.isFrozen(SHORTCUT_COMMAND_MAP)).toBe(true);
        const commands = SHORTCUT_COMMAND_MAP.map((c) => c.command);
        expect(new Set(commands).size).toBe(commands.length);
    });

    it("focusPageSearch defaults to slash and ctrl+shift+f without taking ctrl+slash", () => {
        const entry = SHORTCUT_COMMAND_MAP.find((c) => c.command === "focusPageSearch");
        expect(entry?.defaultKeys).toEqual(["slash", "ctrl+shift+f"]);
        expect(entry?.defaultKeys).not.toContain("ctrl+slash");
        expect(SHORTCUT_COMMAND_MAP.some((c) => c.command === "focusSideListSearch")).toBe(false);
    });
});

describe("isShortcutEventFromInputTarget", () => {
    it("is true for input, textarea, select, and button targets", () => {
        for (const tag of ["INPUT", "TEXTAREA", "SELECT", "BUTTON"] as const) {
            const el = document.createElement(tag.toLowerCase());
            const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", bubbles: true });
            Object.defineProperty(event, "target", { value: el });
            expect(isShortcutEventFromInputTarget(event)).toBe(true);
        }
    });

    it("is false for body", () => {
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", bubbles: true });
        Object.defineProperty(event, "target", { value: document.body });
        expect(isShortcutEventFromInputTarget(event)).toBe(false);
    });
});

describe("healShortcutEntries", () => {
    it("drops unknown commands, keeps saved keys, and fills missing map entries with defaults", () => {
        const healed = healShortcutEntries([
            { command: "navToHome", keys: ["home"] },
            { command: "notARealCommand", keys: ["x"] },
        ]);
        expect(healed.some((e) => e.command === "notARealCommand")).toBe(false);
        expect(healed.find((e) => e.command === "navToHome")?.keys).toEqual(["home"]);
        const pageSearch = healed.find((e) => e.command === "focusPageSearch");
        expect(pageSearch?.keys).toEqual(
            SHORTCUT_COMMAND_MAP.find((c) => c.command === "focusPageSearch")?.defaultKeys,
        );
        expect(healed).toHaveLength(SHORTCUT_COMMAND_MAP.length);
        expect(new Set(healed.map((e) => e.command))).toEqual(new Set(SHORTCUT_COMMAND_MAP.map((e) => e.command)));
    });
});

describe("keyFormatter", () => {
    it("returns empty for limited modifier-only keys", () => {
        expect(keyFormatter(keyEvent({ key: "Control", code: "ControlLeft" }), true)).toBe("");
        expect(keyFormatter(keyEvent({ key: "Escape", code: "Escape" }), true)).toBe("");
    });

    it("formats letter / digit / arrow / numpad codes with modifiers", () => {
        expect(keyFormatter(keyEvent({ key: "A", code: "KeyA", ctrlKey: true, shiftKey: true }))).toBe(
            "ctrl+shift+a",
        );
        expect(keyFormatter(keyEvent({ key: "5", code: "Digit5" }))).toBe("5");
        expect(keyFormatter(keyEvent({ key: "ArrowDown", code: "ArrowDown" }))).toBe("down");
        expect(keyFormatter(keyEvent({ key: "+", code: "NumpadAdd" }))).toBe("numpad_plus");
        expect(keyFormatter(keyEvent({ key: "PageDown", code: "PageDown" }))).toBe("pagedown");
    });
});

describe("mouseEventFormatter", () => {
    it("maps back/forward buttons when focus checks pass", () => {
        const target = document.body;
        document.body.focus?.();
        const e4 = { button: 3, target } as unknown as MouseEvent;
        const e5 = { button: 4, target } as unknown as MouseEvent;
        expect(mouseEventFormatter(e4, false)).toBe("mouse4");
        expect(mouseEventFormatter(e5, false)).toBe("mouse5");
        expect(mouseEventFormatter({ button: 0, target } as unknown as MouseEvent, false)).toBe("");
    });

    it("returns empty when checkFocus is true and document is unfocused", () => {
        const spy = vi.spyOn(document, "hasFocus").mockReturnValue(false);
        expect(mouseEventFormatter({ button: 3, target: document.body } as unknown as MouseEvent, true)).toBe("");
        spy.mockRestore();
    });
});
