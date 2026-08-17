# Settings search and navigate

Find a settings control, shortcut, About, or Usage section by search or by stable target id, then jump to it. One path: `navigateToSetting(id)`.

## Architecture

```text
navigateToSetting(id)
  -> ui.requestSettingsNav (open settings + pending { id, requestId })
  -> Settings applies: set tab -> wait for shown element under #settings
  -> scroll + settings-target-highlight + focus first control in the target -> clear pending
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

Labels come from i18n (`labelKey` / `labelNs`). Optional `keywords` are English synonyms for search matching only (not shown in UI). Optional `contentPath` indexes string leaves under that path in `labelNs` so section body copy matches (e.g. AniList "auto-update"). `contentPath` and `labelKey` are typed against the English catalog for that namespace (typos fail at compile time). Shortcut rows take `labelKey` from `SHORTCUT_COMMAND_MAP.name`, which is typed as `shortcutNames.<command>` against that catalog. `platform: "win32"` omits an entry from search on other OS.

**Indexed:** Settings tab (sections plus individual Other Settings / Style Settings controls), Shortcuts (per command), About, Extras/Usage sections.  
**Not indexed:** Theme Maker CSS variables, in-reader manga/book settings panels.

Grab-bag sections (`setting:other`, `setting:style`) keep a heading target for the section title only. Each control is its own catalog row with a DOM id so search highlights that row, not the whole block. Optional `groupLabelKey` (parent section title) is the search-row secondary text instead of the tab name.

### Adding a target

1. Give the DOM node a stable `#settings-…` id (shortcut rows: `#settings-shortcut-<command>`).
2. Add a `SETTINGS_TARGETS_STATIC` row (or rely on shortcut generation). Prefer `contentPath` when the section has body / control copy users will search for. Grab-bag sections should add one row per control instead of one `contentPath` on the heading.
3. Call `navigateToSetting("…", dispatch)` or `<SettingsLink targetId="…" />`.

## Tabs (`constants.ts`)

`SETTINGS_TABS` owns tab order and label keys. Panel components are rendered from `Settings.tsx` so context does not cycle through the utils module.

## Search UI

Search lives in the settings chrome above the tab strip and uses the shared
`Combobox` (`@ui/Combobox`): same `search-input` text field as other search
bars, and the same `setOptSelectData` / `MenuList` dropdown as `InputSelect`
(with `retainFocus` so typing stays in the field). Keydown is stopped from
bubbling like other Input* controls so window shortcuts do not fire while typing.

Matching is case-insensitive substring on:

1. Resolved display label
2. Optional English `keywords`
3. Optional `contentPath` - all string leaves under that i18n object in the
   target's `labelNs` (section body / control copy in the active locale)

Selecting a hit only calls `navigateToSetting`. Empty query shows no list.
After the jump, keyboard focus moves to the first tabbable control in that
target (or the target node itself when it has none), so typing is not left in
the search field.

Opening Settings focuses the search field (FocusLock's first tabbable). Escape
in the search field clears a non-empty query; with an empty query (or when
focus is elsewhere in the overlay) Escape closes Settings. Focus the field later
with `focusPageSearch` (`usePageSearchFocus` at `PAGE_SEARCH_PRIORITY.overlay`).
Do not add a settings-only shortcut.

Search rows show the control title and a separate muted group/tab label in
MenuList (`description` on `Menu.ListItem`), not concatenated onto the title.

## Design choices

- Jump-to navigation, not in-place filtering of the current tab.
- Opening Settings focuses search; overlay-body focus is only after a tab change while the overlay is open (Escape / next-prev tab shortcuts). After `navigateToSetting`, focus moves to the first control in the target.
- Grab-bag sections index per control; cohesive sections keep one `contentPath` on the heading.
- Outside deep-links use the same helper (no URL hash).
- Hand-maintained catalog (not DOM scraping); new user-facing settings need a
  catalog row, and section-wide search needs a `contentPath` when body copy
  should match.
- Shared Combobox (Input* + MenuList) for typeahead, not a settings-only dropdown.
- All tab panels stay mounted (CSS show/hide), same as before.
- SettingsLink navigates by `targetId` only.

## Non-goals

Sidebar or router-based settings, URL hash deep links, unmounting inactive tabs, Theme Maker variable search, in-reader settings search, fuzzy-search dependency, main-process IPC until a concrete caller needs it.
