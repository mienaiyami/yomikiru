# Yomikiru — Library, Progress, Bookmarks & Cover System

> Last updated: 2026-08-19. Covers v2.24.x plus unreleased item metadata / trackers.

All user data (library catalogue, reading progress, bookmarks, notes) is stored in a single
SQLite database file at `userData/data.db`. The ORM is Drizzle.

---

## Table of Contents

- [Yomikiru — Library, Progress, Bookmarks \& Cover System](#yomikiru--library-progress-bookmarks--cover-system)
  - [Table of Contents](#table-of-contents)
  - [Database Schema](#database-schema)
  - [Library Items](#library-items)
  - [Reading Progress](#reading-progress)
    - [Manga Progress](#manga-progress)
    - [Book Progress](#book-progress)
  - [Bookmarks](#bookmarks)
    - [Manga Bookmarks](#manga-bookmarks)
    - [Book Bookmarks](#book-bookmarks)
    - [Redux Bookmarks Slice](#redux-bookmarks-slice)
  - [Book Notes (Highlights)](#book-notes-highlights)
  - [Item metadata overlays](#item-metadata-overlays)
  - [Library tags](#library-tags)
  - [Trackers](#trackers)
  - [Cover System](#cover-system)
    - [Flow](#flow)
  - [Redux Library Slice](#redux-library-slice)
  - [Legacy Migration (JSON -\> SQLite)](#legacy-migration-json---sqlite)
  - [Schema Migrations (Drizzle)](#schema-migrations-drizzle)
    - [Migration 0001 — FK guard](#migration-0001--fk-guard)
    - [Migration 0003 — additive metadata](#migration-0003--additive-metadata)
    - [Pre-migration normalisation](#pre-migration-normalisation)
  - [Verify / Troubleshoot](#verify--troubleshoot)
  - [Library database backups](#library-database-backups)
    - [What happens on auto backup](#what-happens-on-auto-backup)
    - [UI and opening items during backup](#ui-and-opening-items-during-backup)
    - [Edge cases](#edge-cases)

---

## Database Schema

Source of truth: [`src/electron/db/schema.ts`](../src/electron/db/schema.ts).

```mermaid
erDiagram
    library_items {
        int id PK
        text link UK "folder or .epub path"
        text type "manga | book"
        text title
        int updatedAt
        int createdAt
        text author
        text cover "absolute path or null"
        int favouritedAt "null = not favourited"
        text note
        text extra "JSON object"
    }
    manga_progress {
        text itemLink PK FK
        text chapterName
        int currentPage
        text chaptersRead "JSON string[]"
        int totalPages
        int lastReadAt
    }
    book_progress {
        text itemLink PK FK
        text chapterId
        text chapterName
        text position "CSS selector"
        int lastReadAt
    }
    manga_bookmarks {
        int id PK
        text itemLink FK
        text chapterName
        int page
        text note
        int createdAt
    }
    book_bookmarks {
        int id PK
        text itemLink FK
        text chapterName
        text chapterId
        text position "CSS selector"
        text note
        int createdAt
    }
    book_notes {
        int id PK
        text itemLink FK
        text chapterId
        text chapterName
        text range "JSON {startPath,startOffset,endPath,endOffset}"
        text content "user annotation"
        text selectedText
        text color
        int createdAt
        int updatedAt
    }
    item_trackers {
        int id PK
        text itemLink FK
        text provider "anilist"
        text remoteId
        text remoteListId
        text remoteUrl
        text media "JSON cache"
        text listState "JSON cache"
        int syncedAt
        int createdAt
    }
    library_item_metadata {
        text itemLink PK FK
        text source PK "user | file"
        text title
        text author
        text description
        text genres "JSON string[]"
        text tags "JSON string[] file-derived"
        text publisher
        int createdAt
        int updatedAt
    }
    library_tags {
        int id PK
        text name
        text color "CSS hex"
        int createdAt
    }
    library_item_tags {
        text itemLink PK FK
        int tagId PK FK
    }

    library_items ||--o| manga_progress : "one"
    library_items ||--o| book_progress : "one"
    library_items ||--o{ manga_bookmarks : "many"
    library_items ||--o{ book_bookmarks : "many"
    library_items ||--o{ book_notes : "many"
    library_items ||--o{ item_trackers : "many"
    library_items ||--o{ library_item_metadata : "many"
    library_items ||--o{ library_item_tags : "many"
    library_tags ||--o{ library_item_tags : "many"
```

All children cascade-delete when a `library_items` row is removed
(SQLite `ON DELETE CASCADE`). See the [migration guard note below](#schema-migrations-drizzle).

---

## Library Items

A "library item" is:

- **manga** (`type = "manga"`) — a directory that contains image chapters, or a directly readable file (CBZ/ZIP/PDF).
- **book** (`type = "book"`) — an `.epub` file.

`link` is the absolute filesystem path and is the natural key. `id` is an auto-increment integer used for the cover system.

Items are added to the library automatically the first time a file/folder is opened in either reader.
They are never deleted automatically — only via explicit user action (context menu "Remove" / gallery bulk-delete).

When the path on disk is missing, gallery details and classic History/Bookmark open flows offer
**Locate on disk…** (`db:library:relocateItem`) to rewrite `library_items.link` and every child
`itemLink` (progress, bookmarks, notes, trackers, metadata overlays) while keeping the same `id`, or remove the entry / bookmark. A name mismatch between the
chosen path and the previous basename or library title asks for confirmation before relocating.
Tag assignments (`library_item_tags.itemLink`) belong in that same rewrite; that lands with the tags UI.

`favouritedAt` is a nullable timestamp: set means the item is in the gallery Favourites tab; null means not favourited.
`note` is free-text commentary on the library item (not chapter / bookmark / EPUB highlight notes).
`extra` is a JSON object (`LibraryItemExtra`) for fields that have not earned a column yet.

Re-adding an existing path (`addLibraryItem` conflict) updates **title only**. Author, cover, favourite, note, and `extra` stay as stored. Progress insert uses `onConflictDoNothing()` so an existing progress row is not reset.

The `cover` column stores either:

- `null` — no cover assigned; the library grid shows the first letter of the title.
- An absolute path to a custom cover image — set by the user via "Set Cover" in the details panel.
- **Not** the WebP path — the materialize cache is kept separate (see [Cover System](#cover-system)).

IPC surface: all `db:library:*` channels in [`src/common/types/ipc.ts`](../src/common/types/ipc.ts).
Implementation: [`src/electron/db/index.ts`](../src/electron/db/index.ts), methods `addLibraryItem`,
`updateLibraryItem`, `deleteLibraryItem`, `relocateLibraryItem`, `getAllLibraryItemsWithProgress`.

---

## Reading Progress

### Manga Progress

One row per `library_item`. Fields:

| Field | Meaning |
| --- | --- |
| `chapterName` | Basename of the last-opened chapter directory or file |
| `currentPage` | 1-based page number within the chapter |
| `totalPages` | Total image count for the chapter (updated on chapter load) |
| `chaptersRead` | JSON array of chapter basenames the user has ever finished |
| `lastReadAt` | Unix ms timestamp of last read |

Progress is saved:

- When the reader navigates to a new page (throttled).
- When `closeReader()` is called (flushes to DB via `updateCurrentItemProgress` thunk).
- When the window closes (`reader:recordPage` IPC).

`chaptersRead` is appended when `currentPage >= totalPages` (end of chapter) and can be marked/unmarked manually via context menu in the chapter list.

IPC: `db:manga:updateProgress`, `db:manga:updateChaptersRead`, `db:manga:updateChaptersReadAll`.

### Book Progress

One row per `library_item`. Fields:

| Field | Meaning |
| --- | --- |
| `chapterId` | EPUB spine id of the chapter |
| `chapterName` | Display name (from TOC, if available) |
| `position` | CSS query string identifying the scroll position element |
| `lastReadAt` | Unix ms timestamp |

Position is computed by scanning the visible iframe content for the topmost element in the viewport and building a CSS path. See `makeScrollPos` in the EPubReader and `getCSSPath` in [`src/renderer/utils/utils.ts`](../src/renderer/utils/utils.ts).

The renderer keeps `bookProgressRef` as a React ref (`src/renderer/App.tsx`) so `flushEpubScrollPos` can be called before closing to avoid losing scroll position from race conditions.

IPC: `db:book:updateProgress`, `db:book:getProgress`.

---

## Bookmarks

### Manga Bookmarks

Stored in `manga_bookmarks`. Unique constraint: `(itemLink, chapterName, page)`.

Created via:

- The `b` keybinding in the manga reader.
- Right-click → "Add to Bookmarks" on the page.

Fields: `itemLink`, `chapterName` (chapter basename), `page` (1-based), `note` (optional text), `createdAt`.

Displayed in:

- Classic Home → Bookmark Tab.
- Manga Reader side-list → Bookmarks tab.
- Gallery -> MangaDetailsPanel inner tab `"bookmarks"`.
- Gallery home `bookmarks` tab (the parent library item, not each bookmark row).

IPC: `db:manga:addBookmark`, `db:manga:deleteBookmarks`, `db:manga:getBookmarks`.

### Book Bookmarks

Stored in `book_bookmarks`. Unique constraint: `(chapterId, position)`.

Created via the floating "Bookmark" button in the EPUB reader side-list.
`position` is a CSS selector path to the scroll anchor.

Displayed in:

- Classic Home → Bookmark Tab (with EPUB badge).
- EPUB Reader side-list → Bookmarks tab.
- Gallery -> BookDetailsPanel inner tab `"bookmarks"`.
- Gallery home `bookmarks` tab (the parent library item, not each bookmark row).

IPC: `db:book:addBookmark`, `db:book:deleteBookmarks`, `db:book:getBookmarks`.

### Redux Bookmarks Slice

[`src/renderer/store/bookmarks.ts`](../src/renderer/store/bookmarks.ts) — loads all bookmarks on startup via `fetchAllBookmarks` thunk,
then keeps them in memory. Individual add/remove dispatches go straight to IPC and update the store.
Change pings from main (`db:bookmark:change`) trigger a full re-fetch for cross-window sync.

Gallery `bookmarks` lists library items that have at least one bookmark. Opening an item from that tab selects the details inner tab `"bookmarks"`. Classic Home Bookmark Tab still lists every bookmark as a row.

---

## Book Notes (Highlights)

Stored in `book_notes`. Unique constraint: `(chapterId, range, selectedText)`.

Notes are highlighted text selections inside the EPUB reader.

Fields:

- `chapterId` — EPUB spine id
- `chapterName` — for display
- `range` — `{ startPath, startOffset, endPath, endOffset }` (JSON). Paths are CSS selector strings produced by `highlightUtils.getPathFromNode` in [`src/renderer/utils/highlight.ts`](../src/renderer/utils/highlight.ts).
- `selectedText` — the raw selected string
- `content` — optional user annotation text
- `color` — hex string (one of the `DEFAULT_HIGHLIGHT_COLORS`)

Flow:

1. User selects text in EPUB iframe → "Add Note" button appears in side-list.
2. Selecting a color triggers `addNote(color)` in `EPubReader.tsx`.
3. Range is serialised via `highlightUtils`; stored via `db:book:addNote` IPC.
4. On chapter load, stored ranges are re-applied with `highlightUtils.applyHighlight`.

IPC: `db:book:addNote`, `db:book:updateNote`, `db:book:deleteNotes`, `db:book:getAllNotes`.
Redux: [`src/renderer/store/bookNotes.ts`](../src/renderer/store/bookNotes.ts).

---

## Item metadata overlays

[`library_item_metadata`](../src/electron/db/schema.ts) is a per-source overlay on a library item. Composite primary key `(itemLink, source)` with `source` `"user"` | `"file"`. `"user"` is written by the details **Edit metadata** form. `"file"` is reserved for later ComicInfo / EPUB extraction; nothing writes it in this change.

Null (or empty string / empty array) on a field means that source does not supply it. Display resolution is read-time in [`resolveItemMetadata`](../src/renderer/utils/libraryMetadata.ts):

**user overlay > tracker snapshot (`item_trackers.media` / `listState`) > file overlay > `library_items` title/author.**

There are no lock booleans. Tracker-only fields (`status`, `score`, `siteUrl`, `totalChapters`) have no user/file columns.

IPC: `db:library:getAllMetadata`, `db:library:setMetadata`. Omitted keys on set leave stored values; explicit `null` clears that overlay field.

The overlay `tags` JSON column is file-derived descriptive tags (ComicInfo later). It is not the user catalog.

---

## Library tags

User organization labels are a **catalog plus assignments**, not free-form strings on the item.

- [`library_tags`](../src/electron/db/schema.ts) is the global catalog (manga and book share one list). `name` is unique after trim and case-fold (`uq_library_tags_name` on `lower(trim(name))`). `color` is a CSS hex string for chips.
- [`library_item_tags`](../src/electron/db/schema.ts) is `(itemLink, tagId)` with cascade on both parents. Deleting a tag unassigns it from every item.

These tables ship in migration `0003` with the metadata/tracker tables. Assignment UI, IPC, and relocate rewrite are a follow-up; until then the tables stay empty.

---

## Trackers

[`item_trackers`](../src/electron/db/schema.ts) is one binding per library item per provider. Unique `(itemLink, provider)`. `provider` is a TEXT slug (`"anilist"` only in TypeScript). `remoteId` is TEXT so non-integer provider ids fit later. `remoteListId` is the remote list-entry id when the service splits media from "my list". `remoteUrl` is stored rather than rebuilt.

`media` and `listState` are rebuildable cache (`TrackerMediaSnapshot`, `TrackerListState`). `syncedAt` is local staleness. The remote service remains the source of truth.

AniList OAuth tokens stay in localStorage (not in this table) so DB backups do not include them. A one-shot import copies legacy `anilist_tracking` into this table; see [`src/renderer/features/anilist/README.md`](../src/renderer/features/anilist/README.md).

IPC: `db:trackers:getAll`, `db:trackers:upsert`, `db:trackers:remove`, `db:trackers:updateSnapshot`, ping `db:tracker:change`.

Renderer store: generic tracker rows live in `trackers.entries` ([`src/renderer/store/trackers.ts`](../src/renderer/store/trackers.ts)). AniList OAuth, the open list entry, and gallery track context stay in the `anilist` slice.

Callers that are not AniList UI (bar / search / edit / login) should read and write rows through the generic trackers APIs (`fetchAllTrackers`, `upsertTracker`, `removeTracker`, `updateTrackerSnapshot`, `selectTracker`). GraphQL helpers in [`src/renderer/utils/anilist.ts`](../src/renderer/utils/anilist.ts) stay AniList-named. Follow-up call-site conversion: [`src/renderer/store/trackers.md`](../src/renderer/store/trackers.md).

---

## Cover System

Library thumbnails are WebP files stored in `userData/covers/<libraryId>.webp`, generated by `sharp` in the main process.

### Flow

```mermaid
sequenceDiagram
    participant Reader
    participant Renderer
    participant IPC
    participant Main
    participant sharp

    Reader->>Renderer: chapter loaded, first image available
    Renderer->>IPC: covers:materialize { libraryId, sourceAbsolutePath }
    IPC->>Main: coverMaterialize.ts
    Main->>sharp: resize to 300px wide, save as WebP
    Main-->>IPC: { ok: true }
    IPC-->>Renderer: ok
    Renderer->>Renderer: dispatch fetchAllItemsWithProgress (refresh cover URL)
```

- **Source resolution**: [`src/renderer/utils/libraryCoverSources.ts`](../src/renderer/utils/libraryCoverSources.ts) — `resolveMangaCoverSourcePath` checks for a dedicated `cover.*` file in the manga root, falls back to the first page image.
- **Service layer**: [`src/renderer/utils/libraryCoverService.ts`](../src/renderer/utils/libraryCoverService.ts) — `materializeMangaLibraryThumbnail`, `materializeBookLibraryThumbnail`, `materializeBookCoverFromExtractedPath`, `pickAndApplyCustomCover`.
- **Reader flow**: [`src/renderer/features/reader/services/readerCoverFlows.ts`](../src/renderer/features/reader/services/readerCoverFlows.ts) — `applyMangaCoverAfterChapterLoad` and `applyMakeCoverFromPageImage` coordinate the reader-triggered cover updates.
- **Custom cover**: user can right-click a page in the manga reader → "Set as Cover", or use the "Pick Cover" button in the details panel.
- **Cache clear**: `covers:clearCache` IPC removes all files under `userData/covers/` and recreates the empty directory.
- **Bulk regenerate**: Settings → Library walks every library row. Missing files/folders are skipped (not extracted or parsed) and a single warning reports how many were skipped.

The `library_items.cover` column stores only user-picked non-WebP paths (e.g. a `cover.jpg` in the manga root). The WebP thumbnail at `userData/covers/<id>.webp` is separate and not stored in the DB — the renderer resolves it from the library item `id` at render time via `libraryCoverSrc` in [`src/renderer/utils/libraryCover.ts`](../src/renderer/utils/libraryCover.ts).

---

## Redux Library Slice

[`src/renderer/store/library.ts`](../src/renderer/store/library.ts) maintains `items: Record<string, LibraryItemWithProgress | null>` keyed by `link`, and `metadata: Record<string, LibraryItemMetadata[]>` keyed by the same path. Favourite, note, and metadata thunks merge the IPC result into that map so the UI updates before `db:library:change` refetch.

Key thunks:

| Thunk | Purpose |
| --- | --- |
| `fetchAllItemsWithProgress` | Loads entire library + progress from DB |
| `fetchAllMetadata` | Loads overlay rows, grouped by `itemLink` |
| `addLibraryItem` | Adds/upserts item; triggers cover flow |
| `updateCurrentItemProgress` | Writes current reader progress to DB (flush on close) |
| `updateMangaProgress` | Mid-read progress update |
| `updateBookProgress` | EPUB scroll position update |
| `deleteLibraryItem` | DB delete (cascades bookmarks/notes/trackers/metadata) + store removal |
| `updateChaptersRead` | Toggle one chapter read/unread |
| `updateChaptersReadAll` | Mark all chapters read/unread |
| `setLibraryItemFavourite` | Sets or clears `favouritedAt` |
| `setLibraryItemNote` | Persists `library_items.note` |
| `setLibraryItemMetadata` | Upserts one overlay (`user` or, later, `file`) |
| `relocateLibraryItem` | Rewrites path + child FKs; remaps store keys before refetch |

---

## Legacy Migration (JSON -> SQLite)

Before v2.19.7 the library and bookmarks were stored in `userData/bookmarks.json` and `userData/history.json`.

On first launch after upgrade, `checkForJSONMigration` in [`src/electron/util/migrate.ts`](../src/electron/util/migrate.ts) detects these files and offers a one-time migration dialog.
If accepted:

1. Backs up `data.db` with a timestamp.
2. Calls `db.migrateFromJSON(history, bookmarks)`.
3. Renames old JSON files to `.old`.

The old files are never deleted automatically; they remain as `.old` backups.

---

## Schema Migrations (Drizzle)

Migration files live in `drizzle/` and are applied at startup by `DatabaseService.initialize()`.

### Migration 0001 — FK guard

Migration 0001 rebuilds `library_items` via DROP + RENAME. SQLite `PRAGMA foreign_keys` is ignored
inside a Drizzle-managed transaction, which means a plain `DROP TABLE library_items` would cascade-delete
all children. The guard:

1. Checks whether `library_items` already has the `id` column (if yes, 0001 already ran — skip).
2. If 0001 is pending, sets `PRAGMA foreign_keys = OFF` on the connection **before** `migrate()` opens its transaction.
3. After `migrate()` completes (in the `finally` block), restores `PRAGMA foreign_keys = ON`.

See [`src/electron/db/index.ts`](../src/electron/db/index.ts) (`withForeignKeysOffAsync` around `migrate()`).

### Migration 0003 — additive metadata

Adds `library_items.favouritedAt`, `note`, and `extra`, plus `item_trackers`, `library_item_metadata`, `library_tags`, and `library_item_tags`. The SQL is `ALTER TABLE ... ADD COLUMN` and `CREATE TABLE` only (`drizzle/0003_*.sql`) - no `__new_library_items` rebuild (the FK-cascade hazard 0001 was patched for).

### Pre-migration normalisation

`normalizeLegacyMangaDataBeforeMigration` in [`src/electron/db/legacyNormalize.ts`](../src/electron/db/legacyNormalize.ts) runs before `migrate()`:

- Backfills `manga_bookmarks.chapterName` from the old `link` column when missing or `"~"`.
- Deduplicates `manga_bookmarks` rows on the new `(itemLink, chapterName, page)` key (keeps `MIN(id)`).
- Backfills `manga_progress.chapterName` from the old `chapterLink` column.

This is safe to re-run (idempotent) — it early-exits if the old columns are already absent.

---

## Verify / Troubleshoot

Manual checks after a version upgrade:

- Open any manga and verify the chapter list shows history (green read indicators).
- Confirm bookmarks still appear in the side-list.
- For EPUB: open a book and verify the previous scroll position is restored.
- If covers are blank after upgrade: right-click any item in the gallery → "Refresh Cover" or "Set as Cover".

Commands:

```
pnpm test:db          # Run DB integration tests against a temp SQLite file
pnpm drizzle:studio   # Open Drizzle Studio UI to inspect data.db directly
```

---

## Library database backups

Automatic snapshots of `data.db` only (not covers or settings). Implementation: [`src/electron/util/dbBackup.ts`](../src/electron/util/dbBackup.ts). Settings UI under General → Library Database Backup. Config lives in `main-settings.json` (`dbBackup.*`).

On disk under `userData/backups/`:

| Path | Role |
| --- | --- |
| `data-<unixMs>.db` | Published backup (newest `dbBackup.keepCount` kept after each backup publish) |
| `data-<unixMs>.db.tmp` | In-progress publish file (cleaned on startup) |
| `restore-pending.json` | Queued restore across relaunch |
| `data.db.tmp` (next to live DB) | Staging file while swapping during restore |

### What happens on auto backup

1. Hourly timer or OS `powerMonitor` resume calls `createBackupIfDue()` (fire-and-forget).
2. Skips if disabled, not due, already backing up, or `data.db` missing.
3. Runs better-sqlite3 online `backup()` on the **live** app connection into `backups/data-<ms>.db.tmp`, then renames to `data-<ms>.db`, prunes to `dbBackup.keepCount`, bumps `lastSuccessAt`.
4. Online backup transfers pages in batches (default ~100 pages per event-loop turn), so the main process **yields** between batches instead of freezing for the whole copy.

```mermaid
sequenceDiagram
    participant Timer as hourly_or_resume
    participant Backup as createBackup
    participant SQLite as live_data_db
    participant IPC as library_IPC
    participant UI as renderer

    Timer->>Backup: createBackupIfDue
    Backup->>SQLite: backup 100 pages
    Note over Backup,SQLite: yields event loop
    IPC->>SQLite: open item / progress write
    Backup->>SQLite: next 100 pages
    Backup->>UI: mainSettings sync lastSuccessAt
```

Cold start: if a backup is due, it runs **before** the main window is created (`runDbBackupStartupBeforeOpen`), which can delay first paint on a large DB.

### UI and opening items during backup

| Layer | Effect |
| --- | --- |
| Renderer (home / reader chrome) | Not blocked. Separate process; no auto-backup modal. |
| Main process | Mostly cooperative. Short sync bursts for mkdir / rename / prune / settings write + Redux sync. |
| Opening a library item mid-backup | Safe. Same SQLite connection; IPC reads/writes run between backup page batches. Snapshot consistency follows SQLite's backup API (a write that commits after a batch may land in live DB but not in that backup file; the next successful backup includes it). |
| Mutex | Only skips a second backup; does **not** pause library IPC. |

Restore is not concurrent: queue pending → relaunch → swap **before** the long-lived DB opens.

### Edge cases

| Case | Behavior |
| --- | --- |
| Second auto/manual backup while one runs | Skipped (`isBackingUp`) |
| Quit during backup | `before-quit` awaits in-flight work, then closes SQLite |
| Connection closed mid-backup | better-sqlite3 aborts pending backups |
| Backup fails | Log; do not bump `lastSuccessAt`; remove tmp |
| Missing / corrupt restore source | Dialog; clear pending (avoids relaunch loop); live DB unchanged |
| Staging failure during restore | Dialog; **keep** pending so next launch can retry; leave live DB if rename did not succeed |
| Path like `../data-….db` on restore | `path.basename` keeps the file under `backups/` |
| Import external `.db` | Integrity-check → copy into `backups/data-<ms>.db` → same pending restore + relaunch |
| Probing several restores | Restore/import do **not** prune; older originals stay. Prune runs only on Backup Now / scheduled backup (`dbBackup.keepCount`) |
| App asleep for weeks | Due check on resume + hourly timer |

Manual test notes: Settings → Backup Now; confirm `userData/backups/`; fill the keep set and Restore the oldest (stage-before-prune); truncated backup must leave live DB unchanged; Import & Restore a copied `data.db` from elsewhere; restore two different list entries and confirm older files remain until Backup Now.
