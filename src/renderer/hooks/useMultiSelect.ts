import { getIdsInRange } from "@utils/multiSelectRange";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Identifier type accepted by {@link useMultiSelect}. Items are tracked by a
 * stable, hashable key (typically a DB id, file path, or chapter name).
 */
export type MultiSelectId = string | number;

/** Shared empty id list so the default arg is referentially stable. */
const EMPTY_IDS: readonly never[] = [];

/** Options for {@link UseMultiSelectReturn.toggleItem}. */
export type ToggleItemOptions = {
    /** When true with a prior anchor, selects the contiguous range in the visible order. */
    shiftKey?: boolean;
};

/**
 * Public API returned by {@link useMultiSelect}.
 *
 * Selection mode is implicit: it is "on" whenever the selection set is
 * non-empty. {@link UseMultiSelectReturn.clearSelection} both empties the set
 * and exits selection mode in a single action.
 *
 * Pass the unfiltered id list as `sourceIds`. When a ListNavigator filter
 * changes, call {@link UseMultiSelectReturn.setVisibleOrder} with the filtered
 * ids so Shift-range / Select All / bulk actions stay scoped to what the user
 * can see.
 */
export type UseMultiSelectReturn<T extends MultiSelectId> = {
    /** Visible id order (source list, or the current filter subset). */
    readonly orderedIds: readonly T[];
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
     * selects every id between the anchor and this id in {@link orderedIds}
     * (inclusive).
     */
    readonly toggleItem: (id: T, opts?: ToggleItemOptions) => void;
    /** Replaces the selection with every id in {@link orderedIds}. */
    readonly selectAll: () => void;
    /** Inverts selection across {@link orderedIds}. */
    readonly invertSelection: () => void;
    /** Clears all selected ids and exits selection mode. */
    readonly clearSelection: () => void;
    /**
     * Updates the visible order (e.g. from ListNavigator's filtered items).
     * Pass the full source list (or equal contents) to clear a filter override.
     * Ids that leave the visible list are dropped from the selection.
     */
    readonly setVisibleOrder: (ids: readonly T[]) => void;
};

/**
 * Returns `next` unless it matches `prev` element-wise (keeps `prev` reference).
 */
const keepIfSameOrder = <T>(prev: readonly T[], next: readonly T[]): readonly T[] => {
    if (prev.length === next.length && prev.every((id, i) => Object.is(id, next[i]))) return prev;
    return next;
};

const isSameOrder = <T>(a: readonly T[], b: readonly T[]): boolean =>
    a.length === b.length && a.every((id, i) => Object.is(id, b[i]));

/**
 * Lightweight multi-selection for list / grid UIs, with optional visible-order
 * override for search filters.
 *
 * `orderedIds` is `sourceIds` until {@link UseMultiSelectReturn.setVisibleOrder}
 * narrows it; clearing the filter (passing the full list again) drops the
 * override so new source items appear automatically.
 *
 * @example
 * ```tsx
 * const sel = useMultiSelect(itemIds);
 * // ListNavigator onFilteredItemsChange:
 * sel.setVisibleOrder(filtered.map((it) => it.link));
 * sel.selectAll();
 * ```
 */
export const useMultiSelect = <T extends MultiSelectId = string>(
    sourceIds: readonly T[] = EMPTY_IDS as readonly T[],
): UseMultiSelectReturn<T> => {
    /* null = showing full sourceIds; array = active filter (including empty). */
    const [visibleOverride, setVisibleOverride] = useState<readonly T[] | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<T>>(() => new Set<T>());

    const sourceIdsRef = useRef(sourceIds);
    sourceIdsRef.current = sourceIds;

    const orderedIds = visibleOverride ?? sourceIds;
    const orderedIdsRef = useRef(orderedIds);
    orderedIdsRef.current = orderedIds;
    /** Last id toggled without Shift - range select anchor. */
    const anchorIdRef = useRef<T | null>(null);

    /* Drop override ids that left the source list; clear override when it matches source. */
    useEffect(() => {
        setVisibleOverride((prev) => {
            if (prev == null) return null;
            const sourceSet = new Set(sourceIds);
            const next = prev.filter((id) => sourceSet.has(id));
            if (isSameOrder(next, sourceIds)) return null;
            return keepIfSameOrder(prev, next);
        });
    }, [sourceIds]);

    /* Drop selection ids that left the visible list so bulk actions cannot touch hidden rows. */
    useEffect(() => {
        const allowed = new Set(orderedIds);
        if (anchorIdRef.current != null && !allowed.has(anchorIdRef.current)) {
            anchorIdRef.current = null;
        }
        setSelectedIds((prev) => {
            if (prev.size === 0) return prev;
            let removed = false;
            const next = new Set<T>();
            for (const id of prev) {
                if (allowed.has(id)) next.add(id);
                else removed = true;
            }
            return removed ? next : prev;
        });
    }, [orderedIds]);

    const setVisibleOrder = useCallback((ids: readonly T[]) => {
        const source = sourceIdsRef.current;
        if (isSameOrder(ids, source)) {
            setVisibleOverride(null);
            return;
        }
        setVisibleOverride((prev) => (prev != null && isSameOrder(prev, ids) ? prev : ids));
    }, []);

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

    const selectAll = useCallback(() => {
        const ids = orderedIdsRef.current;
        setSelectedIds(new Set(ids));
        anchorIdRef.current = ids.length > 0 ? ids[ids.length - 1]! : null;
    }, []);

    const invertSelection = useCallback(() => {
        const ids = orderedIdsRef.current;
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

    /* Keep a stable object while selection + order are unchanged (callers may put `selection` in deps). */
    return useMemo(
        () => ({
            orderedIds,
            selectedIds,
            count: selectedIds.size,
            isSelectionMode: selectedIds.size > 0,
            isSelected,
            toggleItem,
            selectAll,
            invertSelection,
            clearSelection,
            setVisibleOrder,
        }),
        [
            orderedIds,
            selectedIds,
            isSelected,
            toggleItem,
            selectAll,
            invertSelection,
            clearSelection,
            setVisibleOrder,
        ],
    );
};

export default useMultiSelect;
