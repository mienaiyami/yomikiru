import { act, renderHook } from "@testing-library/react-hooks/dom";
import { describe, expect, it } from "vitest";
import { useMultiSelect } from "./useMultiSelect";

describe("useMultiSelect", () => {
    const source = ["a", "b", "c", "d"];

    it("toggles selection and derives selection mode", () => {
        const { result } = renderHook(() => useMultiSelect(source));
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
        const { result } = renderHook(() => useMultiSelect(source));
        act(() => {
            result.current.toggleItem("a");
        });
        act(() => {
            result.current.toggleItem("c", { shiftKey: true });
        });
        expect([...result.current.selectedIds].sort()).toEqual(["a", "b", "c"]);
    });

    it("selectAll / invertSelection / clearSelection use visible order", () => {
        const { result } = renderHook(() => useMultiSelect(source));
        act(() => {
            result.current.setVisibleOrder(["a", "b", "c"]);
        });
        act(() => {
            result.current.selectAll();
        });
        expect([...result.current.selectedIds].sort()).toEqual(["a", "b", "c"]);

        act(() => {
            result.current.invertSelection();
        });
        expect([...result.current.selectedIds]).toEqual([]);

        act(() => {
            result.current.toggleItem("a");
            result.current.invertSelection();
        });
        expect([...result.current.selectedIds].sort()).toEqual(["b", "c"]);

        act(() => {
            result.current.clearSelection();
        });
        expect(result.current.count).toBe(0);
        expect(result.current.isSelectionMode).toBe(false);
    });

    it("prunes selection when visible order shrinks", () => {
        const { result } = renderHook(() => useMultiSelect(source));
        act(() => {
            result.current.selectAll();
        });
        act(() => {
            result.current.setVisibleOrder(["a", "c"]);
        });
        expect([...result.current.selectedIds].sort()).toEqual(["a", "c"]);
        expect(result.current.count).toBe(2);
    });

    it("tracks sourceIds until a filter override is set", () => {
        const { result, rerender } = renderHook(({ ids }: { ids: readonly string[] }) => useMultiSelect(ids), {
            initialProps: { ids: source },
        });
        expect(result.current.orderedIds).toBe(source);

        rerender({ ids: ["a", "b", "c", "d", "e"] });
        expect(result.current.orderedIds).toEqual(["a", "b", "c", "d", "e"]);

        act(() => {
            result.current.setVisibleOrder(["a", "e"]);
        });
        expect(result.current.orderedIds).toEqual(["a", "e"]);

        rerender({ ids: ["a", "b", "e"] });
        expect(result.current.orderedIds).toEqual(["a", "e"]);

        act(() => {
            result.current.setVisibleOrder(["a", "b", "e"]);
        });
        expect(result.current.orderedIds).toEqual(["a", "b", "e"]);
    });

    it("keeps empty filter override when source grows", () => {
        const { result, rerender } = renderHook(({ ids }: { ids: readonly string[] }) => useMultiSelect(ids), {
            initialProps: { ids: source },
        });
        act(() => {
            result.current.setVisibleOrder([]);
        });
        rerender({ ids: ["a", "b", "c", "d", "e"] });
        expect(result.current.orderedIds).toEqual([]);
    });
});
