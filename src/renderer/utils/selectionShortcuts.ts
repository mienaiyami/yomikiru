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
export type SelectionShortcutAction = "selectAll" | "clear";

/**
 * Maps a keyboard event to a multi-select action.
 * Returns `null` when the target is editable or the key is unrelated.
 */
export const matchSelectionShortcut = (e: KeyboardEvent | React.KeyboardEvent): SelectionShortcutAction | null => {
    if (isEditableKeyboardTarget(e.target)) return null;
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyA") return "selectAll";
    if (e.key === "Escape") return "clear";
    return null;
};
