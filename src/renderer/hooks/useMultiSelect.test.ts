import { act, renderHook } from "@testing-library/react-hooks/dom";
import { describe, expect, it } from "vitest";
import { useMultiSelect } from "./useMultiSelect";

describe("useMultiSelect", () => {
    const ordered = ["a", "b", "c", "d"];

    it("toggles selection and derives selection mode", () => {
        const { result } = renderHook(() => useMultiSelect(ordered));
        expect(result.current.isSelectionMode).toBe(false);

        act(() => {
            result.current.toggleItem("b");
        });
        expect(result.current.isSelected("b")).toBe(true);
        expect(result.current.count).toBe(1);
        expect(result.current.isSelectionMode).toBe(true);

        act(() => {
            result.current.toggleItem("b");
        });
        expect(result.current.count).toBe(0);
        expect(result.current.isSelectionMode).toBe(false);
    });

    it("shift-toggles a range from the anchor", () => {
        const { result } = renderHook(() => useMultiSelect(ordered));
        act(() => {
            result.current.toggleItem("a");
        });
        act(() => {
            result.current.toggleItem("c", { shiftKey: true });
        });
        expect([...result.current.selectedIds].sort()).toEqual(["a", "b", "c"]);
    });

    it("selectAll / invertSelection / clearSelection", () => {
        const { result } = renderHook(() => useMultiSelect(ordered));
        act(() => {
            result.current.selectAll(["a", "b"]);
        });
        expect(result.current.count).toBe(2);

        act(() => {
            result.current.invertSelection(["a", "b", "c"]);
        });
        expect([...result.current.selectedIds]).toEqual(["c"]);

        act(() => {
            result.current.clearSelection();
        });
        expect(result.current.count).toBe(0);
        expect(result.current.isSelectionMode).toBe(false);
    });
});
