# Yomikiru — Settings, Themes, Shortcuts & Reader Presets

> Last updated: 2026-08-09. Covers v2.24.x.

---

## Table of Contents

- [Yomikiru — Settings, Themes, Shortcuts \& Reader Presets](#yomikiru--settings-themes-shortcuts--reader-presets)
  - [Table of Contents](#table-of-contents)
  - [Settings Overlay](#settings-overlay)
  - [App Settings (settings.json)](#app-settings-settingsjson)
  - [Main Settings (main-settings.json)](#main-settings-main-settingsjson)
  - [Manga Reader Settings](#manga-reader-settings)
  - [Book (EPUB) Reader Settings](#book-epub-reader-settings)
  - [Reader Presets (readerPresets.json)](#reader-presets-readerpresetsjson)
  - [Themes (themes.json)](#themes-themesjson)
  - [Shortcuts (shortcuts.json)](#shortcuts-shortcutsjson)
  - [Multi-Window Sync](#multi-window-sync)
  - [Persistent File Locations](#persistent-file-locations)

---

## Settings Overlay

Entry: [`src/renderer/features/settings/Settings.tsx`](../src/renderer/features/settings/Settings.tsx)

Toggled by the gear icon or `Ctrl+,`. Full-screen modal with five keyboard-navigable tabs driven by `SETTINGS_TABS`:

- **0 — Settings** (`GeneralSettings.tsx`) — home/library, gallery, reader, background, PDF, explorer, cover tools
- **1 — Shortcut Keys** (`Shortcuts.tsx`) — view and rebind all commands
- **2 — Theme Maker** (`ThemeCont.tsx`) — create/edit/import/export CSS-var themes
- **3 — About** (`About.tsx`) — version, build info, detailed info dialog
- **4 — Extras / Usage** (`Usage.tsx`) — in-app usage guide for all features

Deep-link / jump-to: `navigateToSetting(targetId)` + catalog in `settingsTargets.ts`. See [`src/renderer/features/settings/search-and-navigate.md`](../src/renderer/features/settings/search-and-navigate.md).

`SettingsContext` exposes tab index helpers only; navigation goes through the pending Redux target, not string selectors.

---

## App Settings (settings.json)

Schema (with JSDoc on every field): [`src/renderer/utils/settingsSchema.ts`](../src/renderer/utils/settingsSchema.ts)
Redux slice: [`src/renderer/store/appSettings.ts`](../src/renderer/store/appSettings.ts)
File: `userData/settings.json`

The Zod schema is the single source of truth for every key, its type, its default, and its meaning. Read it directly — all fields are now documented with JSDoc inline.

On load, invalid or missing keys are repaired using `repairZodInputWithDefaults` (fills from schema defaults) so old installs survive new keys being added.

Key groupings in the schema:

- **Home / library** — `baseDir`, `homeViewMode`, `showTabs`, `openOnDblClick`, `openDirectlyFromManga`, list sort keys, display flags
- **Gallery** — `galleryActiveTab`, `galleryTypeFilter`, `galleryDisplayMode`, `galleryItemWidth`, `gallerySortBy` / `gallerySortType`
- **Reader general** — `openInZenMode`, `hideCursorInZenMode`, `keepExtractedFiles`, `syncSettings`, `syncThemes`, `customStylesheet`
- **Active presets** — `mangaReaderPresetId`, `bookReaderPresetId` (which named preset is selected)
- **Reader sub-objects** — `readerSettings` (manga) and `epubReaderSettings` (book); both are embedded objects, see their own schemas below

---

## Main Settings (main-settings.json)

Schema & class: [`src/electron/util/mainSettings.ts`](../src/electron/util/mainSettings.ts)
File: `userData/main-settings.json`

These live in the main process and affect Electron-level behaviour. They are mirrored into the renderer `mainSettings` Redux slice after an IPC fetch at startup.

The Zod schema inside `mainSettings.ts` documents every key inline. Key areas:

- **Window behaviour** — `askBeforeClosing`, `openInExistingWindow` (single-instance reuse), `minimizeToTray`
- **Performance** — `hardwareAcceleration` (disable GPU; requires restart), `tempPath` (custom temp dir)
- **Updates** — `checkForUpdates`, `autoDownload`, `skipPatch`, `channel` (`"stable"` or `"beta"`)

Changes take effect immediately for tray and tempPath; HWA requires restarting the app. IPC `mainSettings:update` broadcasts the new value to all windows via `mainSettings:sync`.

**Legacy migration**: the old per-setting flag files (`DISABLE_HARDWARE_ACCELERATION`, `TEMP_PATH`, `OPEN_IN_EXISTING_WINDOW` in userData) are migrated into `main-settings.json` automatically on first launch after upgrade.

---

## Manga Reader Settings

Subkey `appSettings.readerSettings`. Schema: `mangaReaderSettingsSchema` in [`src/renderer/utils/readerSettingsSchema.ts`](../src/renderer/utils/readerSettingsSchema.ts).

All fields have JSDoc in the schema file. Behavioural notes not obvious from the names:

- **Reading mode** (`readerTypeSelected 0/1/2`) — vertical scroll, LTR, RTL. Controls whether navigation is by scroll or by discrete page.
- **Pages per row** (`pagesPerRowSelected 0/1/2`) — 1-up, 2-up, 2-up with single cover page. Combined with `readingSide` (LTR/RTL) for two-page manga layout.
- **Fit option** — `0` = natural size, `1` = fit height to viewport, `2` = fit width to reader area, `3` = pixel-accurate 1:1.
- **`maxHeightWidthSelector`** — activates either `maxWidth` or `maxHeight` as a per-image cap; `"none"` disables both.
- **`customColorFilter`** — RGBA overlay with CSS `mix-blend-mode`. The `hue/saturation/brightness/contrast` sub-fields apply as `filter:` values and are **independent** of `enabled`.
- **`dynamicLoading`** — trades startup speed for lower peak memory; images load as they scroll into view.
- **`pdfScale`** — passed to `pdfjs-dist page.getViewport({ scale })`. Higher = sharper at the cost of render time and memory.

---

## Book (EPUB) Reader Settings

Subkey `appSettings.epubReaderSettings`. Schema: `bookReaderSettingsSchema` in [`src/renderer/utils/readerSettingsSchema.ts`](../src/renderer/utils/readerSettingsSchema.ts).

All fields have JSDoc. Behavioural notes:

- **`useDefault_*` toggles** — every typography and color property has a paired `useDefault_` boolean. When `true`, the EPUB's own CSS wins; `false` applies the override. This lets you override only what you care about.
- **`loadOneChapter`** — renders only the current spine chapter in the DOM. Lower memory, but loses continuous scroll across chapters.
- **`overrideEpubColors`** — injects a stylesheet that wins over EPUB-authored colors for books that hard-code dark/light themes with `!important` or inline styles.
- **`contentFrame`** — separates the text column background from the page background so you can have a solid reading area with a visible wallpaper around it.
- **`backgroundImage`** — wallpaper image fixed behind the content; stays in place when zooming text. `layer` is an additional color overlay between the wallpaper and the text column.

---

## Reader Presets (readerPresets.json)

File: `userData/readerPresets.json`
Schema & logic: [`src/renderer/utils/readerPresets.ts`](../src/renderer/utils/readerPresets.ts)
Redux: [`src/renderer/store/readerPresets.ts`](../src/renderer/store/readerPresets.ts)

A preset is a named snapshot of all manga or book reader settings. Presets are displayed in the reader settings panel and can be switched with keyboard shortcuts (`Alt+1`–`5`, `Alt+.`/`,`).

**User preset** (`USER_PRESET_MANGA_ID` / `USER_PRESET_BOOK_ID`) — one per type, cannot be deleted, always recreated if missing.

**Autosave** — when `preset.autosave = true`, the `readerPresetsAutosaveMiddleware` in [`src/renderer/store/readerPresetsAutosaveMiddleware.ts`](../src/renderer/store/readerPresetsAutosaveMiddleware.ts) writes any settings change back into the active preset automatically.

**Import / export** — JSON; import merges by id (no duplicates). Export works to clipboard or file.

**Repair on load** — missing keys are filled from Zod defaults; if the file is unreadable it is regenerated from the current `settings.json` reader settings. A dialog is shown in both cases.

---

## Themes (themes.json)

File: `userData/themes.json`
Redux: [`src/renderer/store/themes.ts`](../src/renderer/store/themes.ts)
CSS variable list: [`src/renderer/utils/theme.ts`](../src/renderer/utils/theme.ts)

Each theme is `{ name: string; main: Record<CSSVarName, string> }`. `setBodyTheme` applies the active theme by writing all CSS variables to `document.body.style.cssText` and sets `data-theme` on `<body>`.

**Theme Maker** (Settings tab 2, [`src/renderer/features/settings/components/ThemeCont.tsx`](../src/renderer/features/settings/components/ThemeCont.tsx)):

- Edit each CSS variable with a colour picker.
- Create new, delete, import/export, or reset all to bundled defaults.
- Changes apply live; no restart needed.

**Windows title bar recolouring** — on Windows, the native close/minimise/maximise button overlay picks up the active theme's `--icon-color` and the TopBar background colour via `setSysBtnColor` (called after theme changes and on focus/blur).

**Multi-window sync** — when `syncThemes = true`, writing `themes.json` in one window broadcasts `fs:fileChanged` and other windows call `refreshThemes()`.

---

## Shortcuts (shortcuts.json)

File: `userData/shortcuts.json`
Redux: [`src/renderer/store/shortcuts.ts`](../src/renderer/store/shortcuts.ts)
Command map with defaults: [`src/renderer/utils/keybindings.ts`](../src/renderer/utils/keybindings.ts)

Shortcuts are `{ command: ShortcutCommands; keys: string[] }`. Up to 4 bindings per command (`SHORTCUT_LIMIT`). The full command list with default keys and human-readable names is in `SHORTCUT_COMMAND_MAP` inside `keybindings.ts` — read that rather than duplicating it here.

**Key format** — normalised strings like `"ctrl+shift+f"`, `"space"`, `"bracketleft"`, `"mouse4"`, `"mouse5"`. Mouse buttons 4 and 5 are fully supported.

**Reserved keys** (cannot be bound): `ctrl+shift+i`, `escape`, `tab`, `ctrl+n`, `ctrl+w`, `ctrl+r`, `ctrl+shift+r`.

**Shortcut UI** (Settings tab 1) — lists all commands, click to remove a binding, click "Add" to record a new one, reset all to defaults.

**Multi-window sync** — when `syncSettings = true`, `shortcuts.json` changes trigger `refreshShortcuts()` in other windows.

---

## Multi-Window Sync

When `fs:fileChanged` is received (main pushes it whenever any window writes a monitored config file):

| File | Reload condition | Redux action |
| --- | --- | --- |
| `settings.json` | `syncSettings = true` | `refreshAppSettings()` |
| `shortcuts.json` | `syncSettings = true` | `refreshShortcuts()` |
| `themes.json` | `syncThemes = true` | `refreshThemes()` |
| `readerPresets.json` | always | `refreshReaderPresetsWithReconcile()` |

`sourceWindowId` in the event payload lets each renderer skip its own writes (the writing window already has the new state in memory). See `App.tsx` around the `fs:fileChanged` listener.

---

## Persistent File Locations

All user data is under `app.getPath("userData")` (typically `%APPDATA%/Yomikiru` on Windows, `~/.config/Yomikiru` on Linux):

| File / Dir | Contents |
| --- | --- |
| `settings.json` | App settings + embedded reader settings |
| `main-settings.json` | Main-process settings (HWA, tray, updates) |
| `themes.json` | All theme definitions + active theme name |
| `shortcuts.json` | Keyboard bindings |
| `readerPresets.json` | Named reader presets |
| `data.db` | SQLite — library, progress, bookmarks, notes |
| `backups/data-<unixMs>.db` | Automatic library DB snapshots (`dbBackup.keepCount`); see [library.md — backups](./library.md#library-database-backups) |
| `covers/<id>.webp` | WebP thumbnails generated by sharp |
| `logs/` | electron-log files (rotated) |
| `bookmarks.json.old` | Legacy bookmarks backup post-migration |
| `history.json.old` | Legacy history backup post-migration |

**Portable mode (Windows)**: when installed outside `%APPDATA%`, all user data lives beside the executable. Detected via `window.process.isPortable`.
