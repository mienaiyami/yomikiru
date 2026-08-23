import { keyFormatter } from "./keybindings";

/**
 * Returns true when the keyboard event target is an editable field where
 * browser defaults (e.g. Ctrl+A text select, Esc blur) should win over
 * list/grid multi-select shortcuts.
 */
export const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

/** Matched multi-select shortcut action, or `null` when none applies. */
export type SelectionShortcutAction = "selectAll" | "clear" | "delete";

/** Optional bindings for the customizable delete-selected command. */
export type MatchSelectionShortcutOpts = {
    /**
     * Keys from the `deleteSelected` shortcut command. When omitted or empty,
     * Delete is not matched here (select-all / clear still are).
     */
    deleteKeys?: readonly string[];
};

/**
 * Maps a keyboard event to a multi-select action.
 * Returns `null` when the target is editable or the key is unrelated.
 */
export const matchSelectionShortcut = (
    e: KeyboardEvent | React.KeyboardEvent,
    opts?: MatchSelectionShortcutOpts,
): SelectionShortcutAction | null => {
    if (isEditableKeyboardTarget(e.target)) return null;
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyA") return "selectAll";
    if (e.key === "Escape") return "clear";
    const deleteKeys = opts?.deleteKeys;
    if (deleteKeys && deleteKeys.length > 0) {
        const keyStr = keyFormatter(e);
        if (keyStr !== "" && deleteKeys.includes(keyStr)) return "delete";
    }
    return null;
};
