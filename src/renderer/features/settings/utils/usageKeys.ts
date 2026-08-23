/** Minimal shortcut row shape needed to resolve Usage keybind snippets. */
export type UsageShortcut = {
    command: string;
    keys: string[];
};

/**
 * Joined key list for a shortcut command, or empty string when unbound.
 * Rendered live inside the Usage guide (e.g. <code>{keysFor(shortcuts, "listDown")}</code>).
 */
export const keysFor = (shortcuts: readonly UsageShortcut[], command: string): string => {
    const row = shortcuts.find((e) => e.command === command);
    return row?.keys.join(", ") ?? "";
};

/** Preset slot commands 1-5 in display order (shared manga/book reader slots). */
export const PRESET_SLOT_COMMANDS = [
    "selectPreset1",
    "selectPreset2",
    "selectPreset3",
    "selectPreset4",
    "selectPreset5",
] as const;
