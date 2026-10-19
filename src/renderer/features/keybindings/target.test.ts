import { describe, expect, it } from "vitest";
import { elementIsShown, listWidgetOwnsEventTarget, liveTriggerFromKeyboard } from "./target";

describe("liveTriggerFromKeyboard", () => {
    it("uses KeyboardEvent.code when it is a catalog KeyboardCode", () => {
        const event = new KeyboardEvent("keydown", { code: "KeyH", key: "h" });
        expect(liveTriggerFromKeyboard(event)?.code).toBe("KeyH");
    });

    it("maps the Menu key when Chromium reports Unidentified code", () => {
        const event = new KeyboardEvent("keydown", { code: "Unidentified", key: "ContextMenu" });
        expect(liveTriggerFromKeyboard(event)).toMatchObject({
            kind: "keyboard",
            code: "ContextMenu",
            key: "ContextMenu",
        });
    });

    it("maps Apps to ContextMenu and Space from the character key", () => {
        expect(liveTriggerFromKeyboard(new KeyboardEvent("keydown", { code: "", key: "Apps" }))?.code).toBe(
            "ContextMenu",
        );
        expect(liveTriggerFromKeyboard(new KeyboardEvent("keydown", { code: "", key: " " }))?.code).toBe("Space");
        expect(liveTriggerFromKeyboard(new KeyboardEvent("keydown", { code: "", key: "F10" }))?.code).toBe("F10");
    });

    it("keeps AZERTY letter positions on code and the produced character on key", () => {
        const event = new KeyboardEvent("keydown", { code: "KeyA", key: "q" });
        expect(liveTriggerFromKeyboard(event)).toMatchObject({ code: "KeyA", key: "q" });
    });

    it("ignores modifier-only and unknown codes with no named key fallback", () => {
        expect(
            liveTriggerFromKeyboard(new KeyboardEvent("keydown", { code: "ControlLeft", key: "Control" })),
        ).toBeNull();
        expect(
            liveTriggerFromKeyboard(new KeyboardEvent("keydown", { code: "Unidentified", key: "Process" })),
        ).toBeNull();
    });
});

describe("elementIsShown", () => {
    it("is false when an ancestor is display:none", () => {
        const wrap = document.createElement("div");
        wrap.style.display = "none";
        const inner = document.createElement("ol");
        wrap.appendChild(inner);
        document.body.appendChild(wrap);
        expect(elementIsShown(inner)).toBe(false);
        expect(elementIsShown(wrap)).toBe(false);
        wrap.remove();
    });

    it("is true for an attached visible element", () => {
        const el = document.createElement("ol");
        document.body.appendChild(el);
        expect(elementIsShown(el)).toBe(true);
        el.remove();
    });

    it("is false when an ancestor has the hidden attribute", () => {
        const wrap = document.createElement("div");
        wrap.hidden = true;
        const inner = document.createElement("ol");
        wrap.appendChild(inner);
        document.body.appendChild(wrap);
        expect(elementIsShown(inner)).toBe(false);
        wrap.remove();
    });
});

describe("listWidgetOwnsEventTarget", () => {
    it("owns the search field and the list, and the list's scroller", () => {
        const host = document.createElement("div");
        const input = document.createElement("input");
        const list = document.createElement("ol");
        host.appendChild(list);
        document.body.appendChild(input);
        document.body.appendChild(host);
        const row = document.createElement("div");
        list.appendChild(row);
        expect(listWidgetOwnsEventTarget(input, input, list, false)).toBe(true);
        expect(listWidgetOwnsEventTarget(row, input, list, false)).toBe(true);
        expect(listWidgetOwnsEventTarget(host, input, list, false)).toBe(true);
        expect(listWidgetOwnsEventTarget(document.body, input, list, false)).toBe(false);
        input.remove();
        host.remove();
    });

    it("owns document.body only when shown and a row is focused", () => {
        const list = document.createElement("ol");
        document.body.appendChild(list);
        expect(listWidgetOwnsEventTarget(document.body, null, list, false)).toBe(false);
        expect(listWidgetOwnsEventTarget(document.body, null, list, true)).toBe(true);
        list.remove();
    });

    it("does not claim body for an inline display-none list", () => {
        const wrap = document.createElement("div");
        wrap.style.display = "none";
        const list = document.createElement("ol");
        wrap.appendChild(list);
        document.body.appendChild(wrap);
        expect(listWidgetOwnsEventTarget(document.body, null, list, true)).toBe(false);
        wrap.remove();
    });
});
