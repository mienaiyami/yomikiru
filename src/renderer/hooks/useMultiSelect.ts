import { getIdsInRange } from "@utils/multiSelectRange";
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Identifier type accepted by {@link useMultiSelect}. Items are tracked by a
 * stable, hashable key (typically a DB id, file path, or chapter name).
 */
export type MultiSelectId = string | number;

/** Shared empty ordered-id list so the default arg is referentially stable. */
const EMPTY_ORDERED_IDS: readonly never[] = [];

/** Options for {@link UseMultiSelectReturn.toggleItem}. */
export type ToggleItemOptions = {
    /** When true with a prior anchor, selects the contiguous range in the hook's ordered ids. */
    shiftKey?: boolean;
};

/**
 * Public API returned by {@link useMultiSelect}.
 *
 * Selection mode is implicit: it is "on" whenever the selection set is
 * non-empty. {@link UseMultiSelectReturn.clearSelection} both empties the set
 * and exits selection mode in a single action.
 */
export type UseMultiSelectReturn<T extends MultiSelectId> = {
    /** Currently selected ids (read-only set view). */
    readonly selectedIds: ReadonlySet<T>;
    /** Number of currently selected ids. */
    readonly count: number;
    /** True when at least one id is selected. */
    readonly isSelectionMode: boolean;
    /** Returns true when the given id is part of the selection. */
    readonly isSelected: (id: T) => boolean;
    /**
     * Toggles selection for the given id. With `shiftKey` and a prior anchor,
     * selects every id between the anchor and this id in the current
     * `orderedIds` (inclusive). Entering selection mode happens automatically
     * when the set becomes non-empty.
     */
    readonly toggleItem: (id: T, opts?: ToggleItemOptions) => void;
    /** Replaces the selection with all the provided ids. */
    readonly selectAll: (ids: readonly T[]) => void;
    /**
     * Inverts the selection across the provided id universe: ids currently
     * selected are removed, ids not selected are added.
     */
    readonly invertSelection: (ids: readonly T[]) => void;
    /** Clears all selected ids and exits selection mode. */
    readonly clearSelection: () => void;
};

/**
 * Lightweight, generic multi-selection state for list / grid UIs.
 *
 * Holds an internal `Set` of ids and exposes stable callbacks that are safe
 * to pass to memoized children. Selection mode is derived from `set.size > 0`.
 * Pass the current visual order as `orderedIds` so Shift+click can select ranges.
 *
 * @example
 * ```tsx
 * const sel = useMultiSelect<string>(itemIds);
 * sel.toggleItem(item.link, { shiftKey: e.shiftKey });
 * if (sel.isSelectionMode) showToolbar();
 * ```
 */
export const useMultiSelect = <T extends MultiSelectId = string>(
    orderedIds: readonly T[] = EMPTY_ORDERED_IDS as readonly T[],
): UseMultiSelectReturn<T> => {
    const [selectedIds, setSelectedIds] = useState<Set<T>>(() => new Set<T>());
    const orderedIdsRef = useRef(orderedIds);
    orderedIdsRef.current = orderedIds;
    /** Last id toggled without Shift — range select anchor. */
    const anchorIdRef = useRef<T | null>(null);

    const isSelected = useCallback((id: T) => selectedIds.has(id), [selectedIds]);

    const toggleItem = useCallback((id: T, opts?: ToggleItemOptions) => {
        const ordered = orderedIdsRef.current;
        if (opts?.shiftKey && anchorIdRef.current != null) {
            const range = getIdsInRange(ordered, anchorIdRef.current, id);
            if (range) {
                setSelectedIds((prev) => {
                    const next = new Set(prev);
                    for (const rangeId of range) next.add(rangeId);
                    return next;
                });
                return;
            }
        }

        anchorIdRef.current = id;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback((ids: readonly T[]) => {
        setSelectedIds(new Set(ids));
        anchorIdRef.current = ids.length > 0 ? ids[ids.length - 1]! : null;
    }, []);

    const invertSelection = useCallback((ids: readonly T[]) => {
        setSelectedIds((prev) => {
            const next = new Set<T>();
            for (const id of ids) {
                if (!prev.has(id)) next.add(id);
            }
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        anchorIdRef.current = null;
        setSelectedIds((prev) => (prev.size === 0 ? prev : new Set<T>()));
    }, []);

    /* Keep a stable object while the selection set is unchanged (callers may put `selection` in dep arrays). */
    return useMemo(
        () => ({
            selectedIds,
            count: selectedIds.size,
            isSelectionMode: selectedIds.size > 0,
            isSelected,
            toggleItem,
            selectAll,
            invertSelection,
            clearSelection,
        }),
        [selectedIds, isSelected, toggleItem, selectAll, invertSelection, clearSelection],
    );
};

export default useMultiSelect;
