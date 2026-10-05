import { KeybindingProvider } from "@features/keybindings";
import { configureStore } from "@reduxjs/toolkit";
import { rootReducer } from "@store/index";
import { setReaderOpen } from "@store/reader";
import { act, renderHook } from "@testing-library/react-hooks/dom";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { useMultiSelect } from "./useMultiSelect";
import { useSelectionShortcuts } from "./useSelectionShortcuts";

/** Store + keymap provider so selection owners receive window capture ingress. */
const renderWithStore = (
    hook: () => ReturnType<typeof useMultiSelect>,
    store = configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    }),
) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <Provider store={store}>
            <KeybindingProvider>{children}</KeybindingProvider>
        </Provider>
    );
    return { store, ...renderHook(hook, { wrapper }) };
};

describe("useSelectionShortcuts", () => {
    it("selects all on Ctrl+A and clears on Escape while in selection mode", () => {
        const { result } = renderWithStore(() => {
            const selection = useMultiSelect(["a", "b", "c"]);
            useSelectionShortcuts({ ownerId: "test-selection", selection });
            return selection;
        });

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA", ctrlKey: true, bubbles: true }));
        });
        expect(result.current.count).toBe(3);

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        });
        expect(result.current.count).toBe(0);
    });

    it("does not attach when enabled is false", () => {
        const selectAll = vi.fn();
        const clearSelection = vi.fn();
        const store = configureStore({
            reducer: rootReducer,
            middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
        });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <Provider store={store}>
                <KeybindingProvider>{children}</KeybindingProvider>
            </Provider>
        );
        renderHook(
            () => {
                useSelectionShortcuts({
                    ownerId: "test-selection-off",
                    enabled: false,
                    selection: {
                        orderedIds: ["a"],
                        selectedIds: new Set<string>(),
                        count: 0,
                        isSelectionMode: false,
                        isSelected: () => false,
                        toggleItem: vi.fn(),
                        selectAll,
                        invertSelection: vi.fn(),
                        clearSelection,
                        setVisibleOrder: vi.fn(),
                    },
                });
            },
            { wrapper },
        );

        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA", ctrlKey: true, bubbles: true }));
        expect(selectAll).not.toHaveBeenCalled();
    });

    it("runs onDelete on Delete while items are selected", () => {
        const onDelete = vi.fn();
        const { result } = renderWithStore(() => {
            const selection = useMultiSelect(["a", "b"]);
            useSelectionShortcuts({ ownerId: "test-selection-del", selection, onDelete });
            return selection;
        });

        act(() => {
            result.current.toggleItem("a");
        });
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", code: "Delete", bubbles: true }));
        });
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("does not run onDelete when nothing is selected or the reader is open", () => {
        const onDelete = vi.fn();
        const { store, result } = renderWithStore(() => {
            const selection = useMultiSelect(["a"]);
            useSelectionShortcuts({ ownerId: "test-selection-reader", selection, onDelete });
            return selection;
        });

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", code: "Delete", bubbles: true }));
        });
        expect(onDelete).not.toHaveBeenCalled();

        act(() => {
            result.current.toggleItem("a");
        });
        act(() => {
            store.dispatch(setReaderOpen());
        });
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", code: "Delete", bubbles: true }));
        });
        expect(onDelete).not.toHaveBeenCalled();
    });
});
