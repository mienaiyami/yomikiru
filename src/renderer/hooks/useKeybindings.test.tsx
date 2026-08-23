import { configureStore } from "@reduxjs/toolkit";
import { rootReducer } from "@store/index";
import { act, renderHook } from "@testing-library/react-hooks/dom";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { useKeybindings } from "./useKeybindings";

/**
 * Wraps a hook under test in a fresh Redux store (real {@link rootReducer}).
 */
const createWrapper = () => {
    const store = configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: false,
            }),
    });
    const Wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
    return { store, Wrapper };
};

describe("useKeybindings", () => {
    it("invokes the matching handler for a mapped shortcut key", () => {
        const { Wrapper } = createWrapper();
        const handler = vi.fn();
        const { result } = renderHook(
            () =>
                useKeybindings([{ command: "nextPage", handler }], {
                    limitedKeyFormat: true,
                }),
            { wrapper: Wrapper },
        );

        expect(result.current.shortcutsMapped.nextPage).toContain("d");

        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "d",
                    code: "KeyD",
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(handler).toHaveBeenCalledOnce();
    });

    it("skips handlers when enabled is false", () => {
        const { Wrapper } = createWrapper();
        const handler = vi.fn();
        renderHook(
            () =>
                useKeybindings([{ command: "nextPage", handler }], {
                    enabled: false,
                }),
            { wrapper: Wrapper },
        );

        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true, cancelable: true }),
        );
        expect(handler).not.toHaveBeenCalled();
    });

    it("triggerShortcut runs the command handler directly", () => {
        const { Wrapper } = createWrapper();
        const handler = vi.fn();
        const { result } = renderHook(() => useKeybindings([{ command: "nextPage", handler }]), {
            wrapper: Wrapper,
        });

        act(() => {
            result.current.triggerShortcut("nextPage");
        });
        expect(handler).toHaveBeenCalledOnce();
    });

    it("does not fire allowRepeated:false handlers on key repeat", () => {
        const { Wrapper } = createWrapper();
        const handler = vi.fn();
        renderHook(
            () =>
                useKeybindings([{ command: "nextPage", handler, allowRepeated: false }], {
                    limitedKeyFormat: true,
                }),
            { wrapper: Wrapper },
        );

        window.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "d",
                code: "KeyD",
                bubbles: true,
                cancelable: true,
                repeat: true,
            }),
        );
        expect(handler).not.toHaveBeenCalled();
    });
});
