# Home Feature

> Last updated: 2026-08-09. Covers v2.24.x.

The Home view is the main landing screen shown when no reader is open.
It has two modes — **Classic** and **Gallery** — switchable via `appSettings.homeViewMode`.
Entry point: [`src/renderer/features/home/index.tsx`](index.tsx).

---

## Table of Contents

1. [Classic View](#classic-view)
2. [Gallery View](#gallery-view)
3. [ListNavigator](#listnavigator)
4. [Multi-Select](#multi-select)
5. [Context Menu Entries](#context-menu-entries)
6. [File Drag-and-Drop](#file-drag-and-drop)

---

## Classic View

Entry: [`classic/ClassicView.tsx`](classic/ClassicView.tsx).

Three resizable vertical panels separated by collapsible dividers:

```
┌──────────────────┬─────────────┬──────────────────┐
│  LocationsTab    │  BookmarkTab│   HistoryTab     │
│  (file browser)  │  (bookmarks)│   (read history) │
└──────────────────┴─────────────┴──────────────────┘
```

Clicking a divider toggles the adjacent panel collapsed/expanded (stored in `appSettings.showTabs`).

### LocationsTab

[`classic/components/LocationsTab.tsx`](classic/components/LocationsTab.tsx)

Browsable file tree rooted at `appSettings.baseDir`. Each entry is a directory (manga series root) or a readable file (`.epub`, `.cbz`, `.zip`, `.pdf`).

Features:

- Sort by name or date (`locationListSortBy` / `locationListSortType`).
- `openDirectlyFromManga`: when enabled, single-clicking a manga series root opens the first chapter directly, skipping the sub-folder list.
- Double-click (or single-click when `openOnDblClick = false`) opens the item in the reader.
- Context menu: Open, Open in New Window, Show in File Explorer, Copy Path, Remove from Library, Mark All Read/Unread.
- Missing on-disk path (History/Bookmark open): dialog with **Locate on disk…** (`db:library:relocateItem`) or Remove.
- List numbering can be disabled via `disableListNumbering`.
- Multi-select with `enableClassicListCheckboxes` — shows checkboxes on hover; bulk operations via a toolbar.

### BookmarkTab

[`classic/components/BookmarkTab.tsx`](classic/components/BookmarkTab.tsx)

All manga and book bookmarks from the Redux `bookmarks` slice.

Features:

- Grouped/sorted by manga/book, then by chapter and page.
- Each row: thumbnail, title, chapter name, page number, optional note.
- Context menu: Open (resumes at bookmarked page/position), Remove Bookmark.
- Search filter.
- Multi-select with bulk remove.
- `showMoreDataOnItemHover`: shows extended tooltip (date, note) on hover.

### HistoryTab

[`classic/components/HistoryTab.tsx`](classic/components/HistoryTab.tsx)

All library items that have a progress record, sorted by `lastReadAt` by default.

Features:

- Sort by name or date.
- Progress bar showing `currentPage / totalPages` for manga; percentage for books.
- Context menu: Open (continues from last position), Open in New Window, Show in File Explorer, Copy Path, Remove.
- Search filter.
- Multi-select with bulk remove.

### ListSelectionToolbar

[`classic/components/ListSelectionToolbar.tsx`](classic/components/ListSelectionToolbar.tsx)

Appears when multi-select mode is active in the classic lists. Provides:

- Count of selected items.
- Select All, Invert Selection, Cancel buttons.
- Slot for extra action items (e.g. "Remove X items").

### listSelectionActions

[`classic/listSelectionActions.ts`](classic/listSelectionActions.ts)

Pure helpers used by the classic list tabs to derive the correct action for a given selection (bulk open, bulk remove, etc.).

---

## Gallery View

Entry: [`gallery/GalleryView.tsx`](gallery/GalleryView.tsx).

A card-based library browser with three tabs and a detail panel.

### Tabs

| Tab ID | Shows |
| --- | --- |
| `library` | All library items, sorted by `gallerySortBy` / `gallerySortType` |
| `continue-reading` | Items with progress, sorted by `continueReadingSortBy` / `continueReadingSortType` |
| `favourites` | (Planned — currently always empty) |

Tab state persisted in `appSettings.galleryActiveTab`.

### Type Filter

[`gallery/components/GalleryTypeFilterBar.tsx`](gallery/components/GalleryTypeFilterBar.tsx)

Segmented control right of the tab switcher (separated by a `.toolbarDivider` rule),
persisted in `appSettings.galleryTypeFilter`:

| Filter ID | Shows |
| --- | --- |
| `all` | Every library item |
| `manga` | `type === "manga"` (manga, manhwa, manhua, comics, webtoons) |
| `book` | `type === "book"` (EPUB; PDF is not a library type) |

Applied in the `tabItems` memo before tab slicing and sorting, so it narrows every tab.
Changing it clears the current multi-select.

### Display Modes

Controlled by `appSettings.galleryDisplayMode`:

| Mode | Description |
| --- | --- |
| `normal` | Grid with cover + title below |
| `compact` | Grid with title overlaid on cover (semi-transparent) |
| `cover-only` | Grid with cover only, no title text |
| `list` | Single-column list with cover + title |

Column count is computed dynamically from the container width and `appSettings.galleryItemWidth` (10–30 em).
Virtualised with `@tanstack/react-virtual` via the `ListNavigator.VirtualList` sub-component.

### GalleryToolbar

[`gallery/components/GalleryToolbar.tsx`](gallery/components/GalleryToolbar.tsx)

Contains:

- Tab switcher (Continue Reading / Library / Favourites).
- Item type filter (All / Manga+Webcomic / eBook), after a vertical divider.
- Search input, fixed width (~50% wider than the previous gallery slot) and right-aligned (hidden for the Favourites tab). Toolbar height and action buttons match classic home tools (`44px` / `--button-width`).
- Sort controls (sort field + direction).
- Display mode toggle.
- Item width slider.
- Selection toolbar (injected when multi-select is active).

### MangaDetailsPanel

[`gallery/components/MangaDetailsPanel.tsx`](gallery/components/MangaDetailsPanel.tsx)

Slides in from the right when a manga item is selected in the grid. Shows:

- Cover image (with buttons to auto-refresh from folder or pick a custom image).
- Title, last-read chapter, progress percentage.
- Two tabs: **Content** (chapter list) and **Bookmarks** (manga bookmarks for this item).
- Chapter list: sorted by name/date, each row shows chapter name, page count, read indicator; empty image folders are omitted (packed archives still listed).
- "Continue Reading" button.
- Mark All Read / Mark All Unread.
- AniList tracking bar (if logged in).
- Per-item note (editable inline).
- Missing on-disk path: [`MissingLibraryPathPanel`](gallery/components/MissingLibraryPathPanel.tsx) replaces the actions area only (**Locate on disk** / Remove); cover, metadata, and bookmark lists stay visible. Classic History / Continue Reading (manga only): if the series folder exists but a chapter path is missing, the dialog offers **Open first chapter** / **Locate chapter** (pick renamed/moved chapter) — never open the series root (cover-only) and never relocate the library link to a chapter.

### BookDetailsPanel

[`gallery/components/BookDetailsPanel.tsx`](gallery/components/BookDetailsPanel.tsx)

Same layout as MangaDetailsPanel but for EPUB books:

- Shows extracted cover image.
- Progress (chapter name + scroll position description).
- **Bookmarks** / **Notes** tabs from the reader.
- AniList tracking bar.
- Same missing-path panel in the actions area when the `.epub` is gone; bookmarks/notes stay visible.

### GalleryTabBar

[`gallery/components/GalleryTabBar.tsx`](gallery/components/GalleryTabBar.tsx)

Pill-style tab switcher at the top of the gallery toolbar.

### Gallery Sort

[`src/renderer/utils/gallerySort.ts`](../../utils/gallerySort.ts)

`sortGalleryItems` and `sortContinueReadingItems` — pure sort functions applied inside the `tabItems` memo in `GalleryView`. Sort keys are:

- `name` — alphabetical title.
- `date` — `createdAt` / `lastReadAt`.
- `lastRead` — `lastReadAt` (continue-reading only).

---

## ListNavigator

[`src/renderer/components/ListNavigator.tsx`](../../components/ListNavigator.tsx)

A reusable compound component providing:

- **Provider** — holds filter state, focused index, and renders the search input + item list.
- **SearchInput** — uncontrolled text input wrapped in `.search-input-wrapper`, with a focusable clear (`x`) button overlaid on its right edge while the field has text. Its styles live *outside* `@layer main` in `styles/index.scss`, because consumer component stylesheets are unlayered and would otherwise always win.
- **VirtualList** — renders items via `@tanstack/react-virtual`. Supports `columnCount > 1` for the gallery grid.
- **List** — non-virtualised ordered list (used by classic tabs).
- **Input** — the search input field.

Key capabilities:

- Filter function (`filterFn`) is caller-supplied; the component manages the input value and filtered item list.
- Keyboard navigation: arrow keys move focus, Enter/Space select, Home/End jump to ends.
- `handleExtraKeyDown` hook allows caller to intercept additional keys (e.g. shortcut commands).
- `onFilteredItemsChange` callback lets callers track the visible subset (used by multi-select).
- `persistFilter` — when true, the filter is not cleared when the item list refreshes.

---

## Multi-Select

[`src/renderer/hooks/useMultiSelect.ts`](../../hooks/useMultiSelect.ts)

Generic hook returning a `UseMultiSelectReturn<T>` API:

| Method / property | Purpose |
| --- | --- |
| `selectedIds` | `ReadonlySet<T>` of selected item keys |
| `count` | Number selected |
| `isSelectionMode` | True when at least one item selected |
| `toggleItem(id, opts)` | Toggle one item; with `shiftKey` extends to range |
| `selectAll()` | Selects all visible items |
| `invertSelection()` | Flips selection across visible items |
| `clearSelection()` | Clears all + exits selection mode |
| `setVisibleOrder(ids)` | Updates the ordered list (from ListNavigator filter); drops hidden items from selection |

Selection mode is implicit — it activates when the first item is selected and exits when selection is cleared.

Shift-range selection uses `getIdsInRange` from [`src/renderer/utils/multiSelectRange.ts`](../../utils/multiSelectRange.ts) to find the contiguous slice between the anchor and the clicked item in `orderedIds`.

### useSelectionShortcuts

[`src/renderer/hooks/useSelectionShortcuts.ts`](../../hooks/useSelectionShortcuts.ts)

Keyboard shortcuts layered on top of `useMultiSelect`. Wires:

- `Ctrl+A` → select all.
- `Escape` → clear selection.
- `Delete` → trigger a caller-supplied delete handler.

Enabled/disabled based on the `enabled` prop (e.g. disabled when the detail panel is open in the gallery).

---

## Context Menu Entries

The global `window.contextMenu.template` factory (defined in `App.tsx`) provides standard entries reused across both home views and the readers:

| Entry | Action |
| --- | --- |
| `open(url)` | Opens in current reader |
| `openInNewWindow(url)` | Sends `window:openLinkInNewWindow` IPC |
| `showInExplorer(url)` | `shell.showItemInFolder` |
| `copyPath(url)` | Clipboard write |
| `copyImage(url)` | Clipboard write image |
| `removeHistory(url)` | Remove from library (with confirmation; files on disk stay) |
| `removeBookmark(...)` | Delete bookmark (with confirmation) |
| `addToBookmark(args)` | Add bookmark |
| `readChapter / unreadChapter` | Toggle single chapter read state |
| `readAllChapter / unreadAllChapter` | Mark all chapters read/unread |

`confirmDeleteItem` in `appSettings` controls whether a confirmation dialog is shown for side-list deletes.

---

## File Drag-and-Drop

Handled in `App.tsx`. Dropping a file or folder:

- **Directory** → validated and opened in the manga reader.
- **Readable file** (`.epub`, `.cbz`, `.zip`, `.pdf`) → opened directly.
- **Image file** → opens the parent directory in the manga reader.
- Multiple files: only the first is opened; a warning dialog is shown.
