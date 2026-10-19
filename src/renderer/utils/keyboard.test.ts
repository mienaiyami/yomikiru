import { describe, expect, it, vi } from "vitest";
import {
    clickOnWidgetActivateKey,
    isWidgetEnterKey,
    onWidgetActivateKey,
    type WidgetKeyFields,
    widgetActivateKind,
} from "./keyboard";

type TestKeyEvent = WidgetKeyFields & {
    preventDefault: ReturnType<typeof vi.fn>;
    currentTarget: { click: ReturnType<typeof vi.fn> };
};

/**
 * Keyboard event stand-in for {@link widgetActivateKind} and activate helpers.
 */
const keyEvent = (
    key: string,
    init: { code?: string; shiftKey?: boolean; isComposing?: boolean } = {},
): TestKeyEvent => ({
    key,
    code: init.code,
    shiftKey: init.shiftKey ?? false,
    isComposing: init.isComposing,
    preventDefault: vi.fn(),
    currentTarget: { click: vi.fn() },
});

describe("widgetActivateKind", () => {
    it("classifies Enter, Shift+Enter, and Space from key or code", () => {
        expect(widgetActivateKind(keyEvent("Enter"))).toBe("enter");
        expect(widgetActivateKind(keyEvent("Enter", { shiftKey: true }))).toBe("shiftEnter");
        expect(widgetActivateKind(keyEvent(" ", { code: "Space" }))).toBe("space");
        expect(widgetActivateKind(keyEvent("Unidentified", { code: "Enter" }))).toBe("enter");
        expect(widgetActivateKind(keyEvent("a"))).toBeNull();
        expect(widgetActivateKind(keyEvent("Enter", { isComposing: true }))).toBeNull();
        expect(isWidgetEnterKey(keyEvent("Enter"))).toBe(true);
        expect(isWidgetEnterKey(keyEvent("Enter", { shiftKey: true }))).toBe(true);
        expect(isWidgetEnterKey(keyEvent(" "))).toBe(false);
    });
});

describe("onWidgetActivateKey", () => {
    it("runs activate for Enter, Shift+Enter, and Space", () => {
        const activate = vi.fn();
        const enter = keyEvent("Enter");
        expect(onWidgetActivateKey(enter, activate)).toBe(true);
        expect(enter.preventDefault).toHaveBeenCalledOnce();
        onWidgetActivateKey(keyEvent("Enter", { shiftKey: true }), activate);
        onWidgetActivateKey(keyEvent(" "), activate);
        expect(activate).toHaveBeenCalledTimes(3);
    });

    it("keeps Shift+Enter on enter when shiftEnter is omitted, and does not use enter for Space", () => {
        const enter = vi.fn();
        const space = vi.fn();
        onWidgetActivateKey(keyEvent("Enter", { shiftKey: true }), { enter });
        expect(enter).toHaveBeenCalledOnce();
        onWidgetActivateKey(keyEvent(" "), { enter, space });
        expect(enter).toHaveBeenCalledOnce();
        expect(space).toHaveBeenCalledOnce();
        expect(onWidgetActivateKey(keyEvent(" "), { enter })).toBe(false);
    });

    it("uses shiftEnter instead of enter when both are set", () => {
        const enter = vi.fn();
        const shiftEnter = vi.fn();
        onWidgetActivateKey(keyEvent("Enter", { shiftKey: true }), { enter, shiftEnter });
        expect(shiftEnter).toHaveBeenCalledOnce();
        expect(enter).not.toHaveBeenCalled();
    });
});

describe("clickOnWidgetActivateKey", () => {
    it("clicks currentTarget and preventDefaults", () => {
        const event = keyEvent("Enter");
        expect(clickOnWidgetActivateKey(event)).toBe(true);
        expect(event.currentTarget.click).toHaveBeenCalledOnce();
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });
});
