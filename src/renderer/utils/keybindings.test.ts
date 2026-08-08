import { describe, expect, it, vi } from "vitest";
import { keyFormatter, mouseEventFormatter, SHORTCUT_COMMAND_MAP } from "./keybindings";

const keyEvent = (partial: Partial<KeyboardEvent> & Pick<KeyboardEvent, "code" | "key">): KeyboardEvent =>
    partial as KeyboardEvent;

describe("SHORTCUT_COMMAND_MAP", () => {
    it("is frozen and has unique commands", () => {
        expect(Object.isFrozen(SHORTCUT_COMMAND_MAP)).toBe(true);
        const commands = SHORTCUT_COMMAND_MAP.map((c) => c.command);
        expect(new Set(commands).size).toBe(commands.length);
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
