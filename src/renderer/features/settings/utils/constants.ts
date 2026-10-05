/**
 * Settings overlay constants: tab strip.
 * Panel components stay in Settings.tsx to avoid import cycles with context.
 */

/** Ordered settings tabs; index is the strip position. */
export const SETTINGS_TABS = [
    { key: "settings", labelKey: "tabs.settings" },
    { key: "shortcutKeys", labelKey: "tabs.shortcutKeys" },
    { key: "makeTheme", labelKey: "tabs.makeTheme" },
    { key: "about", labelKey: "tabs.about" },
    { key: "extras", labelKey: "tabs.extras" },
] as const;

/** Tab key used by the settings catalog and navigate API. */
export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

/**
 * Returns the tab strip index for a settings tab key.
 *
 * @throws {Error} When `key` is not in {@link SETTINGS_TABS}
 */
export const settingsTabIndex = (key: SettingsTabKey): number => {
    const index = SETTINGS_TABS.findIndex((tab) => tab.key === key);
    if (index < 0) throw new Error(`Unknown settings tab key: ${key}`);
    return index;
};
