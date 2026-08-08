import type { MultiSelectId, UseMultiSelectReturn } from "@renderer/hooks/useMultiSelect";
import { matchSelectionShortcut } from "@utils/selectionShortcuts";
import { useEffect, useRef } from "react";

type UseSelectionShortcutsArgs<T extends MultiSelectId> = {
    selection: UseMultiSelectReturn<T>;
    /** When false, the window listener is not attached. @default true */
    enabled?: boolean;
};

/**
 * Window-level Ctrl/Cmd+A (select all) and Esc (clear) for multi-select UIs.
 * Skips editable targets so search inputs keep native text-editing shortcuts.
 * Select All uses {@link UseMultiSelectReturn.orderedIds} (visible / filtered list).
 *
 * Listener attachment depends only on `enabled` — selection is read from refs
 * so toggles do not rebind the window handler.
 */
export const useSelectionShortcuts = <T extends MultiSelectId>({
    selection,
    enabled = true,
}: UseSelectionShortcutsArgs<T>): void => {
    const selectAllRef = useRef(selection.selectAll);
    selectAllRef.current = selection.selectAll;
    const clearSelectionRef = useRef(selection.clearSelection);
    clearSelectionRef.current = selection.clearSelection;
    const isSelectionModeRef = useRef(selection.isSelectionMode);
    isSelectionModeRef.current = selection.isSelectionMode;

    useEffect(() => {
        if (!enabled) return;

        const onKeyDown = (e: KeyboardEvent) => {
            const action = matchSelectionShortcut(e);
            if (!action) return;

            if (action === "selectAll") {
                e.preventDefault();
                selectAllRef.current();
                return;
            }

            if (action === "clear" && isSelectionModeRef.current) {
                e.preventDefault();
                clearSelectionRef.current();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [enabled]);
};
