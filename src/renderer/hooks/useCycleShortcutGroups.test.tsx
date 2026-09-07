import { configureStore } from "@reduxjs/toolkit";
import { rootReducer } from "@store/index";
import { act, renderHook } from "@testing-library/react-hooks/dom";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { cycleWrappedValue, useCycleShortcutGroups } from "./useCycleShortcutGroups";

/** Wraps a hook under test in a fresh store containing the default shortcut map. */
const createWrapper = () => {
    const store = configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: false,
            }),
    });
    const Wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
    return Wrapper;
};

/** Dispatches a cancelable Alt shortcut from the requested event target. */
const pressAltKey = (target: EventTarget, key: string, code: string): void => {
    target.dispatchEvent(
        new KeyboardEvent("keydown", {
            key,
            code,
            altKey: true,
            bubbles: true,
            cancelable: true,
        }),
    );
};

describe("cycleWrappedValue", () => {
    const values = ["first", "second", "third"] as const;

    it("moves in either direction and wraps at both ends", () => {
        expect(cycleWrappedValue(values, "second", 1)).toBe("third");
        expect(cycleWrappedValue(values, "second", -1)).toBe("first");
        expect(cycleWrappedValue(values, "third", 1)).toBe("first");
        expect(cycleWrappedValue(values, "first", -1)).toBe("third");
    });

    it("keeps the current value when the group is empty or has one value", () => {
        expect(cycleWrappedValue([], "current", 1)).toBe("current");
        expect(cycleWrappedValue(["only"], "only", -1)).toBe("only");
    });

    it("enters a group at the directional edge when the current value is missing", () => {
        expect(cycleWrappedValue(values, "missing", 1)).toBe("first");
        expect(cycleWrappedValue(values, "missing", -1)).toBe("third");
    });
});

describe("useCycleShortcutGroups", () => {
    it("runs previous and next commands for the first group", () => {
        const onChange = vi.fn();
        const Wrapper = createWrapper();
        renderHook(
            () =>
                useCycleShortcutGroups(
                    {
                        bar1: {
                            values: ["first", "second", "third"],
                            current: "second",
                            onChange,
                        },
                    },
                    { enabled: true },
                ),
            { wrapper: Wrapper },
        );

        act(() => pressAltKey(window, "[", "BracketLeft"));
        act(() => pressAltKey(window, "]", "BracketRight"));

        expect(onChange).toHaveBeenNthCalledWith(1, "first");
        expect(onChange).toHaveBeenNthCalledWith(2, "third");
    });

    it("keeps second-group commands isolated from the first group", () => {
        const onBar1Change = vi.fn();
        const onBar2Change = vi.fn();
        const Wrapper = createWrapper();
        renderHook(
            () =>
                useCycleShortcutGroups(
                    {
                        bar1: { values: ["a", "b"], current: "a", onChange: onBar1Change },
                        bar2: { values: ["x", "y"], current: "x", onChange: onBar2Change },
                    },
                    { enabled: true },
                ),
            { wrapper: Wrapper },
        );

        act(() => pressAltKey(window, "=", "Equal"));

        expect(onBar1Change).not.toHaveBeenCalled();
        expect(onBar2Change).toHaveBeenCalledWith("y");
    });

    it("does not register active handlers while disabled", () => {
        const onChange = vi.fn();
        const Wrapper = createWrapper();
        renderHook(
            () =>
                useCycleShortcutGroups(
                    { bar1: { values: ["a", "b"], current: "a", onChange } },
                    { enabled: false },
                ),
            { wrapper: Wrapper },
        );

        act(() => pressAltKey(window, "]", "BracketRight"));

        expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores repeated keydown events", () => {
        const onChange = vi.fn();
        const Wrapper = createWrapper();
        renderHook(
            () =>
                useCycleShortcutGroups(
                    { bar1: { values: ["a", "b"], current: "a", onChange } },
                    { enabled: true },
                ),
            { wrapper: Wrapper },
        );

        window.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "]",
                code: "BracketRight",
                altKey: true,
                repeat: true,
                bubbles: true,
                cancelable: true,
            }),
        );

        expect(onChange).not.toHaveBeenCalled();
    });

    it("does not notify for an empty or singleton group", () => {
        const onEmptyChange = vi.fn();
        const onSingletonChange = vi.fn();
        const EmptyWrapper = createWrapper();
        const SingletonWrapper = createWrapper();
        renderHook(
            () =>
                useCycleShortcutGroups(
                    { bar1: { values: [], current: "current", onChange: onEmptyChange } },
                    { enabled: true },
                ),
            { wrapper: EmptyWrapper },
        );
        renderHook(
            () =>
                useCycleShortcutGroups(
                    { bar2: { values: ["only"], current: "only", onChange: onSingletonChange } },
                    { enabled: true },
                ),
            { wrapper: SingletonWrapper },
        );

        act(() => pressAltKey(window, "]", "BracketRight"));
        act(() => pressAltKey(window, "=", "Equal"));

        expect(onEmptyChange).not.toHaveBeenCalled();
        expect(onSingletonChange).not.toHaveBeenCalled();
    });

    it("runs from a focused input that stops keyboard bubbling", () => {
        const onChange = vi.fn();
        const Wrapper = createWrapper();
        const input = document.createElement("input");
        input.addEventListener("keydown", (event) => event.stopPropagation());
        document.body.append(input);
        input.focus();
        renderHook(
            () =>
                useCycleShortcutGroups(
                    { bar1: { values: ["a", "b"], current: "a", onChange } },
                    { enabled: true },
                ),
            { wrapper: Wrapper },
        );

        act(() => pressAltKey(input, "]", "BracketRight"));

        expect(document.activeElement).toBe(input);
        expect(onChange).toHaveBeenCalledWith("b");
        input.remove();
    });
});
