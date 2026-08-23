# Library discovery, catalogue vs progress, and path merge

How Yomikiru finds titles on disk, what belongs in Continue Reading, and what happens when a series is moved then opened at a new path.

Classifier, optional progress on add, nested **Scan now**, extra library folders, reader one-shot, relocate merge, scan on start / interval, live watch, and clear unused progress are in `# unreleased`. Research background: [research-library-discovery.md](research-library-discovery.md). Persistence overview: [library.md](library.md).

---

## Purpose

Two product bugs share one cause: bulk add reused the **reader image scanner** and always wrote a **progress** row.

1. **Scan must find series in messy trees** (`group / series / chapter`, a root `cover.*` plus chapters, one-image chapters, packed chapter files) without requiring a hard layout.
2. **Catalogue membership is not reading.** Gallery Continue Reading (and classic History) must not treat “just added” as “in progress.”
3. **Several folders / drives** can feed the catalogue. Default Location is the flagged row in that same list (Locations browser).
4. **Moving a folder** then opening the new path must not create a second row that blocks Locate. Relocate into an occupied path **merges**.

---

## Decisions (locked)

| Id | Choice |
| --- | --- |
| D1 One-shot | The folder that contains images and no chapter children **is** the library item. Reader: if the opened path is already a library `link`, do not `dirname`. |
| D2 Depth | **Auto-classify** series vs grouping. Per-root **max-depth safety ceiling** only. |
| D3 Roots | One `library.folders[]` in MainSettings. Exactly one flagged Default Location (Locations tab). Scan now walks every existing path. Auto start/interval/watch are per-row flags (Default Location starts with those off). |
| D4 History | Classic History = actually read (has progress), same as gallery Continue Reading. Unread catalogue is gallery Library / Locations. |
| D5 Missing disk | Scan never auto-removes. Locate / Remove stay. |
| D6 When to scan | Settings expose Scan now, scan on start, interval, and watch. Watch default off. Live watch classifies from the changed path upward (slice 8). |
| D7 Root type | Each library folder: manga, books, or both. |
| D8 Open still adds | Opening in the reader still creates a catalogue row. Scan is additive. |
| D9 Volumes | `Series / Vol1 / Ch1 / images`: the library item is `Vol1` (matches details + `chapterName` = direct child). Nested chapter keys are out of scope. |
| D10 Dummy progress | No silent healer. Settings action to clear unused progress, with confirm. |
| D11 Move + re-open | Prefer relocate-before-add when a **missing** row looks like the same title. If a duplicate row already exists at the new path, Locate **merges** (does not no-op). |

---

## Domain

| Term | Meaning |
| --- | --- |
| Series folder | `library_items.link` for manga. Direct children are chapters. |
| Chapter | Subfolder with at least one image, or a packed/PDF file. Gallery details lists these. |
| Cover file | Series-root sidecar. Today `findCover` only matches `cover` + image ext. Scan ignores those files when deciding “does this folder have pages.” |
| Grouping folder | Not a series. Recurse. |
| One-shot | Images in the series folder, no chapter children. Progress uses sentinel chapter key `~` (same token books already use for an empty name). Continue / Start opens the series folder itself. |
| Library folder | A root in MainSettings `library.folders`. One row is Default Location. |
| Catalogue | `library_items` row. `progress` may be `null`. |
| In progress | A progress row written by the reader (or leftover from old import). |

### Classifier (matches gallery details, not `DirectoryValidatorService`)

Do **not** use `DirectoryValidatorService` to decide “is this a series.” That helper is image-first, depth-capped, and follows only the first child.

For directory `D`:

1. If `D` has at least one **listable chapter child** (subdir with images, or packed/PDF) and no sibling that itself contains nested directories or book/packed files -> **series**. Add `D`. Stop. Otherwise `D` is a grouping folder so a mixed library root does not swallow nested series or one-shots.
2. Else if `D` has only images (cover sidecars allowed) -> **one-shot**. Add `D` (D1).
3. Else if `D` has subdirectories -> **grouping**. Recurse until the per-root max-depth ceiling.
4. Files: `.epub` -> book (if the root allows books). Packed/PDF in a grouping folder -> single-file manga item (if the root allows manga).

**Named ceiling:** grouping recurse stops at the root’s max-depth setting (and a global safety cap in code). Upgrade path: skip-lists / drive-root confirm.

Extract “listable chapter child” from `MangaDetailsPanel` into a shared util so scan and details cannot drift.

---

## Catalogue vs progress

`LibraryItemWithProgress.progress` is already `T | null`. `getAllAndProgress` already left-joins. `AddToLibrarySchema` currently **requires** progress; `addLibraryItem` always inserts a row with `lastReadAt` now.

Change:

- Progress optional on add. Scan / Settings import omit it.
- Reader first-open still inserts progress (today’s path).
- Gallery Continue Reading stays `Boolean(item.progress)` — that becomes correct once import stops writing dummy rows.
- Classic History uses the same predicate (D4).
- Details already shows Start vs Continue from progress truthiness.

Skip-update: existing dummy rows stay until the user runs **Clear unused progress** (D10). Heuristic for that action (explicit, confirmed): progress exists, `chaptersRead` empty, `currentPage === 1` (manga) or empty `position` (book), and `lastReadAt` within a small window of `library_items.createdAt`. Do not run this on every scan.

---

## Settings shape

Library scan config lives in **`main-settings.json`** (`MainSettings.library.folders`), not `settings.json`.

- Exactly one row has `isDefaultLocation: true` (Default Location / Locations tab root). That row may have an empty path. Extra rows cannot be empty and cannot steal the flag.
- Each row: `{ path, isDefaultLocation, content, maxDepth, scanOnStart, scanIntervalMinutes, watch, lastScanAtMs, skipPattern, tagIds }`
  - `content`: `manga` | `book` | `both`
  - `scanIntervalMinutes`: `0` means off
  - `watch`: boolean, default off
  - `lastScanAtMs`: unix ms; `0` means never scanned (interval treats as due)
  - `skipPattern`: string, default empty (no regex skip)
  - `tagIds`: catalog tag ids unioned onto items found under this folder
- **No migrate** from old `settings.json` `baseDir` / `libraryFolders` / `scanDefaultLocation*`. When Default Location is empty, startup asks whether to choose the Home library root now or use the system home folder until it is changed later.
- Shallow-merge of MainSettings replaces the whole `library` object; callers send the full `folders` array.

UI: Settings -> Library (same section as Default Location and thumbnails).

- Default Location block: path picker (not removable), same scan controls as extras (content, depth, interval, start, watch, skip regex, folder tags + backfill), **Scan this folder**. Enabling **Watch** asks first.
- Extra folders list: add/remove, same scan controls, Scan this folder.
- **Scan now** walks every folder whose path exists on disk (including Default Location when a path is set). Nested other roots are skip-paths even if their own scan flags are off.
- One-line Continue Reading explanation: titles appear there after you open them in the reader.

When walking root R, other library-folder paths that sit inside R are not entered. Ancestor roots are not skip targets, so a nested extra folder still walks its own children. Skip regex is case-insensitive against descendant basenames only (a pattern with no special characters matches as a substring). A sentinel **file** named `yomikiru-ignore` or `.yomikiru-ignore` inside D skips D; a **folder** with that name skips that folder only. Folder tags are unioned onto new scan/watch items; backfill uses the same foreign-root exclusion. Scan never auto-removes catalogue rows.

The title bar shows live scan status (phase, root, current path) in a popover on every window, with **Cancel scan**. Scan now does **not** lock the window (thumbnail regenerate still can). Scan, interval, and folder watch run in the main process. Cancellation is checked during the walk, not only after a root finishes. EPUB files are added with title, author, and cover from the OPF (shared `fast-xml-parser` adapter). PDF manga is added without a cover; the first gallery window that shows the tile generates page 1 (limited concurrency). Packed zip/cbz/7z and rar/cbr covers are resolved in main through the same extraction owner used by open/extract; temporary scan and regeneration sources are removed after materialization.

Catalog, i18n, Usage (`usage:library-scan`). Watch copy must warn like `autoRefreshSideList` (slow disks, large trees); turning Watch on also confirms in a dialog.

### Main-process scan IPC

Renderer (any window):

- `libraryScan:start` `{ reason, paths? }` — waits until the walk finishes or is cancelled. `paths` is Scan this folder; omit for Scan now / startup / interval selection.
- `libraryScan:cancel` — abort in-flight walk; cancelled roots are not stamped.
- `libraryScan:getStatus` / `libraryScan:status` — live DTO or `null` when idle.
- `libraryScan:rendererReady` — first living window triggers scan-on-start once per process.

Classifier: `src/common/library/classify.ts` with an injected fs/path matching preload (`isDir` / `isFile` follow symlinks). Main adapter: `src/electron/util/libraryFs.ts` (also `setLibraryIo` for `formatUtils` / folder normalize). `src/common` does not import Node builtins.

---

## Moved folder: Locate vs merge (D11)

### What happens today

`link` is the natural key. Relocate rewrites `link` and every child `itemLink`, **keeps `id`**. If `newLink` already has a row, `relocateLibraryItem` logs and returns `null` (`src/electron/db/index.ts`). The UI shows a generic relocate-failed error.

Typical user path:

1. Series at `folder1`, read chapters, metadata, tracker, tags.
2. Move the directory to `folder2`.
3. Open `folder2` in the reader -> **new** `library_items` row (different `id`, empty extras, new progress).
4. Old row at `folder1` is missing -> Locate. Picking `folder2` **fails** because that path is already in the library.

(The same split applied to a moved EPUB file. Open-before-add below covers manga folders and books.)

Two tiles, split history. Cover cache is on the old `id`.

### Prevent when possible (open / scan)

Before `addLibraryItem` for a path that is **not** already in the map:

1. Collect catalogue rows of the same `type` whose path **does not exist** on disk.
2. Keep those whose display name matches the new path (same rules as `doesRelocateNameMatch`: basename / stem or library title).
3. **Zero** candidates: add as today (catalogue only if the caller is scan; with progress if the caller is the reader).
4. **One** candidate: confirm “This looks like {title}. Update its location instead of adding a new entry?” Yes -> relocate (no second row). No -> add new (user’s choice).
5. **Several** candidates: warn that more than one missing title matches, then add as a new row (named ceiling: no picker). Locate or open-before-add with a single match still relocates.

Scan uses the same helper but **does not auto-relocate**. Scan never silently attaches a new folder to a missing row (wrong series, same folder name). Scan may **skip** adding if an existing row already has that exact path. Missing same-name rows stay missing until the user Locates or opens.

### Merge when Locate hits an occupied path

Relocate from missing `oldLink` to `newLink` that already has a row:

1. Confirm: “This folder is already in the library as a separate entry. Merge reading progress and details into one title?” Cancel leaves both rows.
2. **Keeper** = the row being relocated (`oldLink`) — it usually holds history, metadata, cover `id`.
3. **Discard** = the row already at `newLink` (the accidental re-add).
4. In one FK-off transaction:
   - Merge children from discard into keeper (still keyed at `oldLink`) using the field rules below.
   - `DELETE` discard (`ON DELETE CASCADE` leftover children).
   - Relocate keeper `oldLink` -> `newLink` (existing rewrite).
5. Delete discard’s cover cache file (`covers:deleteForLibraryId` on discard `id`). Keeper `id` (and its WebP) stays.

Do not swap keeper to the new row: that would orphan the old cover id and drop metadata that lived on the missing item.

### Merge field rules

| Data | Rule |
| --- | --- |
| `library_items.id` | Keeper |
| `link` | `newLink` after delete discard |
| `title` / `author` | Keeper if set, else discard |
| `cover` | Keeper if that file still exists, else discard |
| `favouritedAt` | Either timestamp (prefer keeper if both) |
| `note` | Keeper if non-empty, else discard |
| `extra` | Shallow merge; keeper keys win |
| Progress | If only one side has a row, keep it. If both: later `lastReadAt` for page/chapter position; **union** `chaptersRead` |
| Bookmarks / EPUB notes | Union; existing unique keys (`itemLink, chapterName, page` etc.) — on conflict keep keeper (lower id / existing) |
| Trackers | Per provider, keeper wins; otherwise take discard |
| Metadata overlays | Per `source`, keeper wins |
| Tags | Union of tag ids |

Same type only. Relocating a manga folder onto a book path stays invalid (today’s type check in the picker).

Renderer: `relocateLibraryItem.fulfilled` already remaps one key; merge must drop `items[discardLink]` and remap `oldLink` -> `newLink`. Bookmarks / trackers / tags slices that listen to relocate need the discard key removed (same as delete).

---

## Reader one-shot (D1)

Today `loadImgs` always sets `itemLink = dirname(openedPath)`.

Guard:

- If a library row exists for the **opened path**, that path is the series (one-shot or packed file). `itemLink = openedPath`. Chapter key `~`.
- Else existing behavior: opened path is a chapter, series is parent.

`resolveMangaChapterPath(itemLink, chapterName)`: if `chapterName` is `~` or empty, return `itemLink`.

Details: empty chapter list + images at series root -> Start / Continue still opens `itemLink`. Do not invent fake chapter rows.

---

## Implementation slices

Ship in this order. Schema for `libraryFolders.watch` lands with Settings even if watch is a no-op so settings.json does not migrate twice.

### 1. Shared chapter/series classifier

Extract listable-chapter helpers next to `mangaChapterPath.ts` (same domain, not a one-function file). Classifier + tests. `MangaDetailsPanel` calls the shared helper.

### 2. Optional progress on add

`AddToLibrarySchema` / `addLibraryItem` / IPC types. Reader still sends progress. Import/scan omit it. Fix `getAllAndProgress` cast so `progress: null` is honest.

### 3. Scan now

Replace immediate-child import with classifier walk over enabled folders (and Default Location if checked). UI lock + summary dialog as today. Skip existing `link`s. No progress insert. No auto-delete. No auto-merge.

### 4. Reader one-shot + chapter path

Guard in `Reader.tsx`; `resolveMangaChapterPath`; details open path. Packed file items unchanged (`link` is the file). **Done** (unreleased).

### 5. Settings: library folders

Zod keys, repair, Library Settings UI, catalog, i18n, Usage. Scan now wired. Watch control visible, disabled or inert until slice 8, default off. **Done** (unreleased).

### 6. Relocate merge + open-before-add

DB merge transaction + db tests. Missing-path UI confirm. Reader/open path: same-name missing candidate prompt for manga folders and EPUB files. Redux remap including discard. **Done** (unreleased). Several same-name missing rows warn then add (no picker).

### 7. Scan on start + interval

After library hydrate. Interval from settings; skip if a scan is already running (lock covers the walk and catalogue refresh). Renderer is fine (today’s import already lives there). **Done** (unreleased). Start and interval scans do not lock the window; TopBar shows a status control. Interval can run while the reader is open. Zen mode hides the title bar, so that status is hidden until zen ends.

### 8. Watch

Existing `window.chokidar`, debounce, classify from the new path upward, not a full-tree rescan. Default off. Windows/SMB warning. **Done** (unreleased).

### 9. Clear unused progress

Settings Library action + confirm. Not on scan. **Done** (unreleased).

Changelog, Usage, catalog updates land **with the slice that makes the control real**, once per commit.

---

## Module layout (ponytail)

| Concern | Home |
| --- | --- |
| Chapter listing + classifier | `src/common/library/classify.ts` (injected `LibraryIo`); renderer wrappers in `mangaChapters.ts` |
| Scan walk / watch / interval | `src/electron/util/libraryScan.ts` (main) |
| EPUB package (title/cover/TOC) | `src/common/epub/` |
| Cover first-image (folder/archive/EPUB) | `src/common/library/images.ts` + `src/electron/util/contentSource.ts`; `src/electron/ipc/covers.ts` owns library-path materialization |
| Missing-path + merge confirm | `libraryMissingPath.ts` |
| Relocate / merge persistence | `DatabaseService` in `src/electron/db/index.ts` |
| Settings UI | `LibrarySettings.tsx` + catalog |

No new watcher library. No media-server “libraries” table. No filename volume parsers (D9).

---

## Test seams (TDD)

Tests attach only to these public boundaries. Vitest / RTL / `pnpm test:db` as today. No Playwright for native pickers.

| Seam | Assert |
| --- | --- |
| Classifier (`classifyLibraryNode` or equivalent) | Grouping vs series vs one-shot vs packed-at-group vs epub; `cover.jpg` + chapters = series; one-image chapter still a chapter; volume sandwich -> inner series (D9); `path.join` fixtures |
| `addLibraryItem` without progress | Row exists; progress join is null; re-add does not invent progress (`onConflictDoNothing`) |
| `addLibraryItem` with progress | Reader path unchanged |
| `resolveMangaChapterPath` | `~` / empty -> series folder; normal child join |
| Scan walk (pure or with `stubFs`) | Nested `group/series/ch`; skip existing links; skip grouping; do not follow first-child-only |
| `relocateLibraryItem` merge | Occupied `newLink`: keeper id kept, progress union, bookmarks union, discard gone, cover id keeper |
| `relocateLibraryItem` empty target | Today’s rewrite, same id |
| Missing-name match helper | Reuse `doesRelocateNameMatch`; candidates among missing paths only |
| Open-before-add helper | One missing same-name -> relocate intent; zero -> add; does not merge two live paths |
| Settings repair | Old JSON without `libraryFolders` loads |

Not seams: chokidar internals, Settings JSX layout, dialog pixel copy, DirectoryValidator reader cache.

---

## Production / skip-update

- Settings keys additive with Zod repair.
- Progress-optional add is additive (no DROP). `lastReadAt` stays NOT NULL on progress rows that exist.
- Merge is explicit (confirm). Scan does not delete.
- Fresh install: startup offers to select the Home library root; choosing later stores the system home folder. Scan flags remain off until the user enables them.
- Upgrade from current stable: same `baseDir`; import buttons replaced by Scan now once slice 3 ships; leftover dummy progress is cleared only if the user runs **Clear unused progress**.

---

## How to verify (when building)

- Nested `folder1/series/ch/page.jpg` under a library folder appears as **series**, not skipped.
- Series with `cover.jpg` + chapter folders: one catalogue row; Continue empty until open.
- Open a chapter: Continue Reading shows it; details Continue vs Start matches.
- One-shot folder: one library item at that folder; open does not register the parent grouping folder.
- Move series, open new path: prompt to update location; one row; progress/metadata kept.
- Move an EPUB, open the new file: same prompt; one book row.
- If a duplicate was already created: Locate -> merge confirm -> one row, keeper id.
- Classic History does not list unread scan rows.
- Pointing a library folder at a huge tree: max-depth ceiling stops the walk; Scan now, start, and interval scans keep the window usable and show title-bar status with cancellation.
- Watch on an extra folder: dropping a new series in adds a catalogue row after the debounce; deleting a folder does not remove the library item.
- Clear unused progress: leftover first-page progress from older add-on-open rows is removed after confirm; catalogue stays.

See [docs/testing.md](testing.md) for commands (`pnpm test`, `pnpm test:db`). Do not treat coverage % as the goal.
