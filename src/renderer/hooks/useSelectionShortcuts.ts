import { isTypingSurface, useCommandOwner } from "@features/keybindings";
import type { MultiSelectId, UseMultiSelectReturn } from "@renderer/hooks/useMultiSelect";
import { useAppSelector } from "@store/hooks";

type UseSelectionShortcutsArgs<T extends MultiSelectId> = {
    /** Unique owner id for this visible list's selection. */
    ownerId: string;
    selection: UseMultiSelectReturn<T>;
    /** When false, this owner is hidden. @default true */
    enabled?: boolean;
    /**
     * Bulk remove for the current selection (library item, history row,
     * bookmark, or note). Omitted when this list has no delete action
     * (e.g. manga chapters). Only runs while {@link UseMultiSelectReturn.isSelectionMode}.
     */
    onDelete?: () => void;
};

/**
 * Registers select-all, delete-selected, and Escape-clear for one visible list.
 * Hidden tabs pass {@link UseSelectionShortcutsArgs.enabled} false. Reader-open
 * hides every home selection owner. Ctrl+A in a text field stays native.
 */
export const useSelectionShortcuts = <T extends MultiSelectId>({
    ownerId,
    selection,
    enabled = true,
    onDelete,
}: UseSelectionShortcutsArgs<T>): void => {
    const readerActive = useAppSelector((s) => s.reader.active);
    const visible = enabled && !readerActive;

    useCommandOwner({
        ownerId,
        contextKinds: ["selection"],
        visible,
        handlers: {
            selectAll: () => {
                selection.selectAll();
            },
            deleteSelected: () => {
                if (!selection.isSelectionMode || !onDelete) return;
                onDelete();
            },
        },
        available: {
            selectAll: () => !isTypingSurface(document.activeElement),
            deleteSelected: () => Boolean(selection.isSelectionMode && onDelete),
        },
        onEscape: () => {
            if (!selection.isSelectionMode) return false;
            selection.clearSelection();
            return true;
        },
    });
};
