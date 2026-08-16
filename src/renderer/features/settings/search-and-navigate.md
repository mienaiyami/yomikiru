# Settings search and navigate

Find a settings control, shortcut, About, or Usage section by id (and later by search), then jump to it. One path: `navigateToSetting(id)`.

## Architecture

```text
navigateToSetting(id)
  -> ui.requestSettingsNav (open settings + pending { id, requestId })
  -> Settings applies: set tab -> wait for shown element under #settings
  -> scroll + settings-target-highlight -> clear pending
```

- `currentTab` stays local React state in `Settings.tsx`.
- Redux only holds `isOpen.settings` and `pendingSettingsNav`.
- Closing settings clears pending nav.
- Same id while already open still works: `requestId` bumps so the apply effect re-runs.
- Unknown ids: log and no-op (do not open settings).

Highlight uses `outline` plus a light yellow background (Chrome 108 has no `color-mix`). Rules are placed after `.settingItem2` / `.toggleItem` so their `box-shadow` dividers cannot override the highlight. Do not use `--highlight-color` here; that variable is only set inline for epub note highlights.

## Catalog (`settingsTargets.ts`)

Opaque ids are the public API. CSS selectors stay inside the catalog.

| Pattern | Example | Notes |
|---------|---------|--------|
| `setting:<kebab>` | `setting:library` | Settings tab sections / controls |
| `shortcut:<command>` | `shortcut:focusPageSearch` | Generated from `SHORTCUT_COMMAND_MAP` |
| `about` | About root | |
| `usage:<kebab>` | `usage:anilist` | Usage section anchors |

Labels come from i18n (`labelKey` / `labelNs`). Optional `keywords` are English synonyms for search matching only (not shown in UI). `platform: "win32"` omits an entry from search on other OS.

**Indexed:** Settings tab, Shortcuts (per command), About, Extras/Usage sections.  
**Not indexed:** Theme Maker CSS variables, in-reader manga/book settings panels.

### Adding a target

1. Give the DOM node a stable `#settings-…` id (shortcut rows: `#settings-shortcut-<command>`).
2. Add a `SETTINGS_TARGETS_STATIC` row (or rely on shortcut generation).
3. Call `navigateToSetting("…", dispatch)` or `<SettingsLink targetId="…" />`.

## Tabs (`constants.ts`)

`SETTINGS_TABS` owns tab order and label keys. Panel components are rendered from `Settings.tsx` so context does not cycle through the utils module.

## Search UI

Search lives in the settings chrome (dropdown under the input). It filters the platform-aware catalog with case-insensitive substring match on resolved label + keywords (no fuzzy library). Selecting a hit only calls `navigateToSetting`.

Focus the field with the existing `focusPageSearch` command (`usePageSearchFocus` at `PAGE_SEARCH_PRIORITY.overlay` while settings is open). Do not add a settings-only shortcut.

## Design choices

- Jump-to navigation, not in-place filtering of the current tab.
- Outside deep-links use the same helper (no URL hash).
- Hand-maintained catalog (not DOM scraping); new user-facing settings need a catalog row.
- All tab panels stay mounted (CSS show/hide), same as before.
- SettingsLink navigates by `targetId` only.

## Non-goals

Sidebar or router-based settings, URL hash deep links, unmounting inactive tabs, Theme Maker variable search, in-reader settings search, fuzzy-search dependency, main-process IPC until a concrete caller needs it.
