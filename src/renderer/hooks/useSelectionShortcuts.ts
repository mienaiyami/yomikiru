import type { MultiSelectId, UseMultiSelectReturn } from "@renderer/hooks/useMultiSelect";
import { useAppSelector } from "@store/hooks";
import { getShortcutsMapped } from "@store/shortcuts";
import { SHORTCUT_COMMAND_MAP } from "@utils/keybindings";
import { matchSelectionShortcut } from "@utils/selectionShortcuts";
import { useEffect, useRef } from "react";
import { shallowEqual } from "react-redux";

/** Fallback when the shortcuts slice has no `deleteSelected` row yet (heal fills it on load). */
const DELETE_SELECTED_DEFAULT_KEYS = SHORTCUT_COMMAND_MAP.find((e) => e.command === "deleteSelected")
    ?.defaultKeys ?? ["delete"];

type UseSelectionShortcutsArgs<T extends MultiSelectId> = {
    selection: UseMultiSelectReturn<T>;
    /** When false, the window listener is not attached. @default true */
    enabled?: boolean;
    /**
     * Bulk remove for the current selection (library item, history row,
     * bookmark, or note). Omitted when this list has no delete action
     * (e.g. manga chapters). Only runs while {@link UseMultiSelectReturn.isSelectionMode}.
     */
    onDelete?: () => void;
};

/**
 * Window-level Ctrl/Cmd+A (select all), Esc (clear), and the customizable
 * `deleteSelected` shortcut for multi-select UIs.
 * Skips editable targets so search inputs keep native text-editing shortcuts.
 * Select All uses `selection.orderedIds` (visible / filtered list).
 * Delete is ignored while the reader is open so a hidden home selection cannot
 * remove items during a session.
 *
 * Listener attachment depends on `enabled` and reader activity — selection and
 * `onDelete` are read from refs so toggles do not rebind the window handler.
 */
export const useSelectionShortcuts = <T extends MultiSelectId>({
    selection,
    enabled = true,
    onDelete,
}: UseSelectionShortcutsArgs<T>): void => {
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const readerActive = useAppSelector((s) => s.reader.active);

    const selectAllRef = useRef(selection.selectAll);
    selectAllRef.current = selection.selectAll;
    const clearSelectionRef = useRef(selection.clearSelection);
    clearSelectionRef.current = selection.clearSelection;
    const isSelectionModeRef = useRef(selection.isSelectionMode);
    isSelectionModeRef.current = selection.isSelectionMode;
    const onDeleteRef = useRef(onDelete);
    onDeleteRef.current = onDelete;
    const deleteKeysRef = useRef(shortcutsMapped.deleteSelected ?? DELETE_SELECTED_DEFAULT_KEYS);
    deleteKeysRef.current = shortcutsMapped.deleteSelected ?? DELETE_SELECTED_DEFAULT_KEYS;

    useEffect(() => {
        if (!enabled || readerActive) return;

        const onKeyDown = (e: KeyboardEvent) => {
            const action = matchSelectionShortcut(e, { deleteKeys: deleteKeysRef.current });
            if (!action) return;

            if (action === "selectAll") {
                e.preventDefault();
                selectAllRef.current();
                return;
            }

            if (action === "clear" && isSelectionModeRef.current) {
                e.preventDefault();
                clearSelectionRef.current();
                return;
            }

            if (action === "delete" && isSelectionModeRef.current && onDeleteRef.current) {
                e.preventDefault();
                onDeleteRef.current();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [enabled, readerActive]);
};
