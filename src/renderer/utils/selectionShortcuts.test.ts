import { describe, expect, it } from "vitest";
import { isEditableKeyboardTarget, matchSelectionShortcut } from "./selectionShortcuts";

const keyEvent = (partial: Partial<KeyboardEvent> & { key?: string; code?: string }): KeyboardEvent =>
    partial as KeyboardEvent;

describe("isEditableKeyboardTarget", () => {
    it("returns false for null / non-elements", () => {
        expect(isEditableKeyboardTarget(null)).toBe(false);
        expect(isEditableKeyboardTarget(document.createTextNode("x"))).toBe(false);
    });

    it("returns true for input, textarea, select, and contentEditable", () => {
        expect(isEditableKeyboardTarget(document.createElement("input"))).toBe(true);
        expect(isEditableKeyboardTarget(document.createElement("textarea"))).toBe(true);
        expect(isEditableKeyboardTarget(document.createElement("select"))).toBe(true);
        /* jsdom's contenteditable attribute does not always set isContentEditable */
        const div = document.createElement("div");
        Object.defineProperty(div, "isContentEditable", { configurable: true, value: true });
        expect(isEditableKeyboardTarget(div)).toBe(true);
    });

    it("returns false for ordinary elements", () => {
        expect(isEditableKeyboardTarget(document.createElement("button"))).toBe(false);
    });
});

describe("matchSelectionShortcut", () => {
    it("maps Ctrl/Meta+A to selectAll", () => {
        expect(matchSelectionShortcut(keyEvent({ ctrlKey: true, code: "KeyA", target: document.body }))).toBe(
            "selectAll",
        );
        expect(matchSelectionShortcut(keyEvent({ metaKey: true, code: "KeyA", target: document.body }))).toBe(
            "selectAll",
        );
    });

    it("maps Escape to clear", () => {
        expect(matchSelectionShortcut(keyEvent({ key: "Escape", target: document.body }))).toBe("clear");
    });

    it("returns null for editable targets and unrelated keys", () => {
        expect(
            matchSelectionShortcut(
                keyEvent({ ctrlKey: true, code: "KeyA", target: document.createElement("input") }),
            ),
        ).toBeNull();
        expect(matchSelectionShortcut(keyEvent({ key: "a", code: "KeyA", target: document.body }))).toBeNull();
    });
});
