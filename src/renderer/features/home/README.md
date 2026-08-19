# Home Feature

> Last updated: 2026-08-19. Covers v2.24.x plus unreleased gallery metadata / favourites.

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
- Missing on-disk path (History/Bookmark open): dialog with **Locate on disk...** (`db:library:relocateItem`) or Remove.
- List numbering can be disabled via `disableListNumbering`.
- Multi-select with `enableClassicListCheckboxes` (on by default) — checkboxes on Bookmark / History rows; bulk operations via a toolbar.

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

A card-based library browser with a detail panel and section tabs (`galleryActiveTab`).

### Tabs

| Tab ID | Shows |
| --- | --- |
| `continue-reading` | Items with progress, always newest `lastReadAt` first (no sort control) |
| `library` | All library items, sorted by `gallerySortBy` / `gallerySortType` |
| `bookmarks` | Items with at least one bookmark, sorted by `gallerySortBy` / `gallerySortType` |
| `favourites` | Items with `favouritedAt` set, sorted by `gallerySortBy` / `gallerySortType` |

Tab state persisted in `galleryActiveTab`. Opening a tile from `bookmarks` selects the details inner tab `"bookmarks"`; `library` and `continue-reading` keep each panel's default (`"content"` for manga, `"bookmarks"` for books). Play always continues last progress.

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
| `list` | Single-column list: leading checkbox, cover, and title, vertically centered |

Column count is computed dynamically from the container width and `appSettings.galleryItemWidth` (10–30 em).
Virtualised with `@tanstack/react-virtual` via the `ListNavigator.VirtualList` sub-component.

### GalleryToolbar

[`gallery/components/GalleryToolbar.tsx`](gallery/components/GalleryToolbar.tsx)

Contains:

- Tab switcher (`galleryActiveTab`).
- Type filter (`galleryTypeFilter`), after a vertical divider.
- Search input, right-aligned after sort / view / grid-size (hidden when `hideSearch`). Height and action buttons match classic home tools (`--button-width`).
- Sort controls when the tab uses `gallerySortBy` / `gallerySortType` (hidden when `hideSort`).
- Display mode toggle (`galleryDisplayMode`).
- Item width slider (`galleryItemWidth`).
- Selection toolbar (injected when multi-select is active).

### MangaDetailsPanel / BookDetailsPanel

[`gallery/components/MangaDetailsPanel.tsx`](gallery/components/MangaDetailsPanel.tsx), [`gallery/components/BookDetailsPanel.tsx`](gallery/components/BookDetailsPanel.tsx), shared chrome [`gallery/components/DetailsHero.tsx`](gallery/components/DetailsHero.tsx).

Full-page replacement of the gallery grid (not a side drawer). Shared hero: cover with overlay back, title (EPUB badge on books), optional author, Continue/Start plus icon favourite / edit metadata / Select Cover / Show in File Explorer / Copy Path, compact AniList when a token exists. Opening the page focuses Continue/Start. The cover scales with the metadata block height. Auto height (`galleryDetailsHeroHeight` `0`) uses `--details-meta-min-h` / `DETAILS_HERO_HEIGHT_MIN_REM` as the section min/max and scrolls if the hero is taller; dragging the divider can go below that rem floor (`DETAILS_HERO_RESIZE_MIN_PX`). Current chapter sits with last-read date, manga page, and chapters-read (`read / total`); About / genres sit in that same column when resolved metadata supplies them (hidden when empty). The title **Note** sits beside that block from mid width (click to edit; Escape or blur commits to `library_items.note`; height follows the note text). Drag the divider under the header to resize the metadata block (quiet grip on the bar); `galleryDetailsHeroHeight` is one setting for manga and book (`0` = auto section). Lists sit under the same `galleryToolbar` chrome as gallery home (tabs left; locate-current / sort/refresh left of search on gallery home and details only). **Directory Up** (`dirUp`) closes details and focuses gallery search, including after returning from the reader (window capture; ignored while the reader is open, while Settings or AniList overlays are open, and while typing in a field). Context-menu shortcut (`ctrl+/` by default) works on focused tiles and details rows the same way as classic lists.

- Manga tabs: **Content** (chapter list; empty image folders omitted, packed archives still listed) and **Bookmarks**. Tab labels have no counts. Content toolbar locate scrolls to the in-progress chapter.
- Book tabs: **Bookmarks** / **Notes** from the reader.
- Display title / author / About / genres come from `resolveItemMetadata` (user overlay > tracker snapshot > file overlay > `library_items` base). Tracker rows for that snapshot should be selected with `selectTracker` from [`store/trackers.ts`](../../store/trackers.ts) (`trackers.md`); compact AniList UI still uses [`AnilistBar`](../anilist/AnilistBar.tsx). Edit metadata opens [`ItemMetadataEditor`](gallery/components/ItemMetadataEditor.tsx) and writes the `user` overlay. File overlays are reserved for later ComicInfo / EPUB extraction. Library tags (user catalog, not overlay JSON) are chips plus [`ItemTagsRow`](gallery/components/ItemTagsPicker.tsx); create/assign/rename/delete live in that overlay. Gallery home can filter by one tag via `InputSelect` (session-only, after the type filter).
- Missing on-disk path: [`MissingLibraryPathPanel`](gallery/components/MissingLibraryPathPanel.tsx) is an error-styled banner **above** the hero (`--error-color`; **Locate on disk** / Remove); cover, metadata, and lists stay visible. Classic History / Continue Reading (manga only): if the series folder exists but a chapter path is missing, the dialog offers **Open first chapter** / **Locate chapter** (pick renamed/moved chapter) — never open the series root (cover-only) and never relocate the library link to a chapter.

### GalleryTabBar

[`gallery/components/GalleryTabBar.tsx`](gallery/components/GalleryTabBar.tsx)

Pill-style tab switcher at the top of the gallery toolbar.

### Gallery Sort

[`src/renderer/utils/gallerySort.ts`](../../utils/gallerySort.ts)

`sortGalleryItems`, `sortContinueReadingItems`, `selectBookmarkedItems`, and `selectFavouritedItems` — pure helpers applied inside the `tabItems` memo in `GalleryView`. Shared sort keys (`gallerySortBy` / `gallerySortType`) for `library`, `bookmarks`, and `favourites`:

- `name` — alphabetical title.
- `date` — `updatedAt`.
- `lastRead` — `lastReadAt`.

`continue-reading` always sorts by `lastReadAt` descending.

---

## ListNavigator

[`src/renderer/components/ListNavigator.tsx`](../../components/ListNavigator.tsx)

A reusable compound component providing:

- **Provider** — holds filter state, focused index, and renders the search input + item list.
- **SearchInput** — uncontrolled text input wrapped in `.search-input-wrapper`, with a focusable clear (`x`) button overlaid on its right edge while the field has text. Focuses on mount unless `autoFocus` is false (gallery details lists pass false so Continue/Start can take initial focus). Its styles live *outside* `@layer main` in `styles/index.scss`, because consumer component stylesheets are unlayered and would otherwise always win.
- **VirtualList** — renders items via `@tanstack/react-virtual`. Supports `columnCount > 1` for the gallery grid.
- **List** — non-virtualised ordered list (classic tabs; gallery details). Optional `scrollContainerRef` scrolls the focused row inside that overflow box so ancestor panels do not jump.
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

Selection mode is implicit — it activates when the first item is selected and exits when selection is cleared. Gallery overflow offers **Add to Favourites** (Library / Continue / Bookmarks) or **Remove from Favourites** (Favourites tab; confirms when more than one item is selected) plus **Remove from Library**.

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
| gallery favourite toggle | Add to / Remove from Favourites (`library_items.favouritedAt`) |
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
