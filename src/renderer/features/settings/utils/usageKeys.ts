import type { CommandId } from "@common/keybindings";

/** Minimal shortcut row shape needed to resolve Usage keybind snippets. */
export type UsageShortcut = {
    command: CommandId;
    keys: string[];
};

/**
 * Joined key list for a shortcut command, or empty string when unbound.
 * Rendered live inside the Usage guide.
 */
export const keysFor = (shortcuts: readonly UsageShortcut[], command: CommandId): string => {
    const row = shortcuts.find((entry) => entry.command === command);
    return row?.keys.join(", ") ?? "";
};

/** Preset slot commands 1-5 in display order (shared manga/book reader slots). */
export const PRESET_SLOT_COMMANDS: readonly CommandId[] = [
    "selectPreset1",
    "selectPreset2",
    "selectPreset3",
    "selectPreset4",
    "selectPreset5",
];
