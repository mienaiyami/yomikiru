import { act, renderHook } from "@testing-library/react-hooks/dom";
import { describe, expect, it, vi } from "vitest";
import { useMultiSelect } from "./useMultiSelect";
import { useSelectionShortcuts } from "./useSelectionShortcuts";

describe("useSelectionShortcuts", () => {
    it("selects all on Ctrl+A and clears on Escape while in selection mode", () => {
        const { result } = renderHook(() => {
            const selection = useMultiSelect(["a", "b", "c"]);
            useSelectionShortcuts({ selection, ids: ["a", "b", "c"] });
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
        renderHook(() => {
            useSelectionShortcuts({
                enabled: false,
                ids: ["a"],
                selection: {
                    selectedIds: new Set<string>(),
                    count: 0,
                    isSelectionMode: false,
                    isSelected: () => false,
                    toggleItem: vi.fn(),
                    selectAll,
                    invertSelection: vi.fn(),
                    clearSelection,
                },
            });
        });

        window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA", ctrlKey: true, bubbles: true }));
        expect(selectAll).not.toHaveBeenCalled();
    });
});
