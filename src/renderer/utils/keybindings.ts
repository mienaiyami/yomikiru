/**
 * Reader / global shortcut commands.
 * `name` is an i18n key under the `reader` namespace (e.g. `shortcutNames.navToPage`);
 * translate at display sites with `t(entry.name, { ns: "reader" })`.
 */
export const SHORTCUT_COMMAND_MAP = [
    {
        command: "navToPage" as const,
        name: "shortcutNames.navToPage",
        defaultKeys: ["f"],
    },
    {
        command: "toggleZenMode" as const,
        name: "shortcutNames.toggleZenMode",
        defaultKeys: ["backquote"],
    },
    {
        command: "largeScroll" as const,
        name: "shortcutNames.largeScroll",
        defaultKeys: ["space"],
    },
    {
        command: "largeScrollReverse" as const,
        name: "shortcutNames.largeScrollReverse",
        defaultKeys: ["shift+space"],
    },
    {
        command: "scrollDown" as const,
        name: "shortcutNames.scrollDown",
        defaultKeys: ["s", "down"],
    },
    {
        command: "scrollUp" as const,
        name: "shortcutNames.scrollUp",
        defaultKeys: ["w", "up"],
    },
    {
        command: "prevPage" as const,
        name: "shortcutNames.prevPage",
        defaultKeys: ["a", "left", "mouse4"],
    },
    {
        command: "nextPage" as const,
        name: "shortcutNames.nextPage",
        defaultKeys: ["d", "right", "mouse5"],
    },
    {
        command: "nextChapter" as const,
        name: "shortcutNames.nextChapter",
        defaultKeys: ["bracketright"],
    },
    {
        command: "prevChapter" as const,
        name: "shortcutNames.prevChapter",
        defaultKeys: ["bracketleft"],
    },
    {
        command: "focusPageSearch" as const,
        name: "shortcutNames.focusPageSearch",
        defaultKeys: ["slash", "ctrl+shift+f"],
    },
    {
        command: "randomChapter" as const,
        name: "shortcutNames.randomChapter",
        defaultKeys: ["r"],
    },
    {
        command: "bookmark" as const,
        name: "shortcutNames.bookmark",
        defaultKeys: ["b"],
    },
    {
        command: "sizePlus" as const,
        name: "shortcutNames.sizePlus",
        defaultKeys: ["equal", "numpad_plus"],
    },
    {
        command: "sizeMinus" as const,
        name: "shortcutNames.sizeMinus",
        defaultKeys: ["minus", "numpad_minus"],
    },
    {
        command: "readerSettings" as const,
        name: "shortcutNames.readerSettings",
        defaultKeys: ["q"],
    },
    {
        command: "savePreset" as const,
        name: "shortcutNames.savePreset",
        defaultKeys: ["ctrl+s"],
    },
    {
        command: "cyclePresetNext" as const,
        name: "shortcutNames.cyclePresetNext",
        defaultKeys: ["alt+period"],
    },
    {
        command: "cyclePresetPrev" as const,
        name: "shortcutNames.cyclePresetPrev",
        defaultKeys: ["alt+comma"],
    },
    {
        command: "selectPreset1" as const,
        name: "shortcutNames.selectPreset1",
        defaultKeys: ["alt+1"],
    },
    {
        command: "selectPreset2" as const,
        name: "shortcutNames.selectPreset2",
        defaultKeys: ["alt+2"],
    },
    {
        command: "selectPreset3" as const,
        name: "shortcutNames.selectPreset3",
        defaultKeys: ["alt+3"],
    },
    {
        command: "selectPreset4" as const,
        name: "shortcutNames.selectPreset4",
        defaultKeys: ["alt+4"],
    },
    {
        command: "selectPreset5" as const,
        name: "shortcutNames.selectPreset5",
        defaultKeys: ["alt+5"],
    },
    {
        command: "showHidePageNumberInZen" as const,
        name: "shortcutNames.showHidePageNumberInZen",
        defaultKeys: ["p"],
    },
    {
        command: "cycleFitOptions" as const,
        name: "shortcutNames.cycleFitOptions",
        defaultKeys: ["v"],
    },
    {
        command: "selectReaderMode0" as const,
        name: "shortcutNames.selectReaderMode0",
        defaultKeys: ["9"],
    },
    {
        command: "selectReaderMode1" as const,
        name: "shortcutNames.selectReaderMode1",
        defaultKeys: ["0"],
    },
    {
        command: "selectReaderMode2" as const,
        name: "shortcutNames.selectReaderMode2",
        defaultKeys: [],
    },
    {
        command: "selectPagePerRow1" as const,
        name: "shortcutNames.selectPagePerRow1",
        defaultKeys: ["1"],
    },
    {
        command: "selectPagePerRow2" as const,
        name: "shortcutNames.selectPagePerRow2",
        defaultKeys: ["2"],
    },
    {
        command: "selectPagePerRow2odd" as const,
        name: "shortcutNames.selectPagePerRow2odd",
        defaultKeys: ["3"],
    },
    {
        command: "fontSizePlus" as const,
        name: "shortcutNames.fontSizePlus",
        defaultKeys: ["shift+equal"],
    },
    {
        command: "fontSizeMinus" as const,
        name: "shortcutNames.fontSizeMinus",
        defaultKeys: ["shift+minus"],
    },
    {
        command: "navToHome" as const,
        name: "shortcutNames.navToHome",
        defaultKeys: ["h"],
    },
    {
        command: "dirUp" as const,
        name: "shortcutNames.dirUp",
        defaultKeys: ["alt+up"],
    },
    {
        command: "contextMenu" as const,
        name: "shortcutNames.contextMenu",
        defaultKeys: ["ctrl+slash", "shift+f10", "menu"],
    },
    {
        command: "readerSize_50" as const,
        name: "shortcutNames.readerSize_50",
        defaultKeys: ["ctrl+1"],
    },
    {
        command: "readerSize_100" as const,
        name: "shortcutNames.readerSize_100",
        defaultKeys: ["ctrl+2"],
    },
    {
        command: "readerSize_150" as const,
        name: "shortcutNames.readerSize_150",
        defaultKeys: ["ctrl+3"],
    },
    {
        command: "readerSize_200" as const,
        name: "shortcutNames.readerSize_200",
        defaultKeys: ["ctrl+4"],
    },
    {
        command: "readerSize_250" as const,
        name: "shortcutNames.readerSize_250",
        defaultKeys: ["ctrl+5"],
    },
    {
        command: "openSettings" as const,
        name: "shortcutNames.openSettings",
        defaultKeys: ["ctrl+i"],
    },
    {
        command: "uiSizeReset" as const,
        name: "shortcutNames.uiSizeReset",
        defaultKeys: ["ctrl+0"],
    },
    {
        command: "uiSizeDown" as const,
        name: "shortcutNames.uiSizeDown",
        defaultKeys: ["ctrl+minus"],
    },
    {
        command: "uiSizeUp" as const,
        name: "shortcutNames.uiSizeUp",
        defaultKeys: ["ctrl+equal"],
    },
    {
        command: "listDown" as const,
        name: "shortcutNames.listDown",
        defaultKeys: ["down", "ctrl+j"],
    },
    {
        command: "listUp" as const,
        name: "shortcutNames.listUp",
        defaultKeys: ["up", "ctrl+k"],
    },
    {
        command: "listSelect" as const,
        name: "shortcutNames.listSelect",
        defaultKeys: ["enter"],
    },
];
Object.freeze(SHORTCUT_COMMAND_MAP);

/** Tags that already consume typing, so character shortcuts must not steal the key. */
const SHORTCUT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

/**
 * True when the event target is a control that already consumes typing.
 * App's Focus search case and the keybinding hook share this so the keystroke is not stolen.
 */
export const isShortcutEventFromInputTarget = (e: Event): boolean => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    return Boolean(tag && SHORTCUT_INPUT_TAGS.has(tag));
};

/**
 * Normalizes a persisted shortcut list to {@link SHORTCUT_COMMAND_MAP}: keep
 * saved keys for known commands, drop unknown ids, and fill missing commands
 * with their default keys.
 */
export const healShortcutEntries = (
    saved: readonly { command: string; keys: readonly string[] }[],
): ShortcutSchema[] => {
    const allowed = new Set<string>(SHORTCUT_COMMAND_MAP.map((e) => e.command));
    const byCommand = new Map<string, string[]>();
    for (const e of saved) {
        if (!allowed.has(e.command) || byCommand.has(e.command)) continue;
        byCommand.set(e.command, [...e.keys]);
    }
    return SHORTCUT_COMMAND_MAP.map((e) => ({
        command: e.command,
        keys: byCommand.get(e.command) ?? [...e.defaultKeys],
    }));
};

/**
 * Format key event to string (e.g. "ctrl+shift+a", "ctrl+shift+numpad_plus")
 * @param e key event
 * @param limited Do not include some keys (e.g. "Control", "Shift", "Alt", "Tab", "Escape")
 * @returns formatted key string
 */
export const keyFormatter = (e: KeyboardEvent | React.KeyboardEvent, limited = true): string => {
    if (limited && ["Control", "Shift", "Alt", "Tab", "Escape"].includes(e.key)) return "";

    // using lowercase because more readable
    let keyStr = "";
    if (e.ctrlKey) keyStr += "ctrl+";
    if (e.shiftKey) keyStr += "shift+";
    if (e.altKey) keyStr += "alt+";

    switch (true) {
        case /^Key[A-Z]$/.test(e.code):
            keyStr += e.code.slice(3).toLowerCase();
            break;
        case /^Digit[0-9]$/.test(e.code):
            keyStr += e.code.slice(5);
            break;
        case /^Numpad[0-9]$/.test(e.code):
            keyStr += `numpad_${e.code.slice(6)}`;
            break;
        case e.code === "NumpadAdd":
            keyStr += "numpad_plus";
            break;
        case e.code === "NumpadSubtract":
            keyStr += "numpad_minus";
            break;
        case e.code === "NumpadMultiply":
            keyStr += "numpad_multiply";
            break;
        case e.code === "NumpadDivide":
            keyStr += "numpad_divide";
            break;
        case e.code === "NumpadDecimal":
            keyStr += "numpad_period";
            break;
        case e.code.startsWith("Arrow"):
            keyStr += e.code.slice(5).toLowerCase();
            break;
        case e.code === "PageDown":
            keyStr += "pagedown";
            break;
        case e.code === "PageUp":
            keyStr += "pageup";
            break;
        case e.code === "ContextMenu":
            keyStr += "menu";
            break;
        default:
            keyStr += e.code.toLowerCase();
            break;
    }
    return keyStr;
};

/** MouseEvent.button: 3=back, 4=forward. Only these are supported to avoid breaking left/middle/right click. */
const MOUSE_BUTTON_TO_KEY: Record<number, string> = {
    3: "mouse4",
    4: "mouse5",
};

/**
 * Format mouse event to shortcut key string for buttons 4 and 5 (back/forward).
 * @param e mouse event
 * @param checkFocus When true (default), returns "" unless document has focus and event target is within focused element
 * @returns "mouse4" | "mouse5" | ""
 */
export const mouseEventFormatter = (e: MouseEvent, checkFocus = true): string => {
    if (checkFocus) {
        if (!document.hasFocus()) return "";
        const active = document.activeElement;
        if (!active || !active.contains(e.target as Node)) return "";
    }
    return MOUSE_BUTTON_TO_KEY[e.button] ?? "";
};
