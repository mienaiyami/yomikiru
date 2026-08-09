/**
 * [index, settings i18n key under `tabs.*`]
 */
const TAB_INFO = {
    settings: [0, "tabs.settings"],
    shortcutKeys: [1, "tabs.shortcutKeys"],
    makeTheme: [2, "tabs.makeTheme"],
    about: [3, "tabs.about"],
    extras: [4, "tabs.extras"],
} as const;

Object.freeze(TAB_INFO);

const reservedKeys = ["ctrl+shift+i", "escape", "tab", "ctrl+n", "ctrl+w", "ctrl+r", "ctrl+shift+r"];
const SHORTCUT_LIMIT = 4 as const;

Object.freeze(SHORTCUT_LIMIT);

export { reservedKeys, SHORTCUT_LIMIT, TAB_INFO };
