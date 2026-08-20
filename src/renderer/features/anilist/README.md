# AniList Integration

> Last updated: 2026-08-20. Covers the unreleased library-item metadata / tracker work on top of v2.24.x.

Yomikiru can track reading progress on [AniList](https://anilist.co) (manga and novels).
The integration is fully optional and requires a personal AniList OAuth token.

---

## Table of Contents

- [AniList Integration](#anilist-integration)
  - [Table of Contents](#table-of-contents)
  - [Authentication](#authentication)
  - [Tracker rows](#tracker-rows)
  - [One-shot localStorage import](#one-shot-localstorage-import)
  - [AniList Bar](#anilist-bar)
  - [Search and Link](#search-and-link)
  - [Edit Entry](#edit-entry)
  - [Auto-Update Progress](#auto-update-progress)
  - [Gallery Context Tracking](#gallery-context-tracking)
  - [Redux](#redux)
  - [AniList module](#anilist-module)

---

## Authentication

Entry: [`AniLogin.tsx`](AniLogin.tsx)

The user must supply a personal AniList OAuth token. No OAuth flow is initiated from within the app (to avoid requiring a client ID or redirect server).

Steps:

1. Open Settings → AniList section (or click "Login" in the AniList bar).
2. Click the link to the AniList developer page to generate a token.
3. Paste the token into the input.
4. Click "Login" — the token is validated against the AniList API.

The token is stored in `localStorage` via `setAnilistStorageToken` (key `anilist_token`). It stays in localStorage on purpose: library DB backups must not include the OAuth secret. On startup, `App.tsx` calls `initAnilist()`, which loads the stored token and runs `checkAnilistToken`; if the token is invalid, a dialog prompts the user to re-login.

---

## Tracker rows

Live tracking lives in SQLite `item_trackers`, not localStorage. Each row is keyed by `(itemLink, provider)` with `provider = "anilist"` today. `itemLink` is `library_items.link` (`ON DELETE CASCADE`). `remoteId` is the AniList media id (stored as TEXT). `remoteListId` is the MediaList entry id when known. `remoteUrl` is the canonical AniList page. `media` and `listState` are rebuildable cache (`TrackerMediaSnapshot` / `TrackerListState`) stamped with `syncedAt`.

Redux `trackers.entries` is `ItemTracker[]` loaded by `fetchAllTrackers` (`db:trackers:getAll`). Add / remove / cache go through `db:trackers:upsert`, `db:trackers:remove`, and `db:trackers:updateSnapshot`. A `db:tracker:change` ping refetches the list.

Relocate rewrites `item_trackers.itemLink` in the same DB transaction as other child FKs. Removing a library item cascades the tracker row.

The legacy `Anilist.TrackItem` type (`localURL` + `anilistMediaId`) is import-only.

---

## One-shot localStorage import

Older builds stored `{ localURL, anilistMediaId }[]` under `anilist_tracking`. On first launch after this change:

1. Skip if `anilist_tracking_imported` is already set.
2. Read `anilist_tracking`.
3. Upsert `{ itemLink, provider: "anilist", remoteId }` when a `library_items` row exists for that path; log and skip orphans.
4. Set the marker. **Never delete** `anilist_tracking`.

`importAnilistTrackingFromStorage` runs after `fetchAllItemsWithProgress` so the library map is populated.

---

## AniList Bar

Entry: [`AnilistBar.tsx`](AnilistBar.tsx)

The `AnilistBar` component appears in:

- The manga reader side-list (`variant="bar"`, default).
- The EPUB reader side-list (`variant="bar"`).
- Gallery manga/book details (`variant="compact"`).

**Bar** (reader): progress counter with `+` / `-`, an edit control, and Track when unlinked. Progress uses a debounced 1-second save via `setAnilistListProgress`.

**Compact** (gallery details): Track, or a status/count control that opens the existing search/edit overlays. No `+` / `-` on this page. While the list entry is loading, the control stays a same-height disabled button (brand, or cached progress when the tracker snapshot has it). A failed fetch is a **Network Error** button; tooltip is Retry.

When `localLibraryLink` prop is provided (gallery details), tracking resolves from that path instead of the open reader item.

The session `currentListEntry` is shared. The bar only shows it when `mediaId` matches this item's `remoteId`, so opening details does not flash Network Error (or another title's progress) before the fetch returns.

After a list-entry fetch, `cacheAnilistListEntry` writes description, genres, staff author, chapter count, score, and related fields into the tracker cache for details About / author / genres. The list-entry request is keyed on the remote media id (and edit-overlay open state), not the whole tracker row, so cache writes do not refetch.

---

## Search and Link

Entry: [`AnilistSearch.tsx`](AnilistSearch.tsx)

When "Track with AniList..." is selected (reader bar or gallery context menu), the search overlay opens.

1. User types a title → `searchAnilistMedia(query)` calls the AniList GraphQL API.
2. Results show cover, title (English/Romaji/Native), format, status, and chapter count when the API returns them.
3. Selecting a result:
   - Dispatches `addAnilistTracker({ itemLink, anilistMediaId })` (`db:trackers:upsert`).
   - The bar later calls `getAnilistListEntry(mediaId)` (`SaveMediaListEntry`) to create or fetch the list entry and cache the snapshot.

Adult content is only shown when the viewer's AniList `displayAdultContent` option is true (loaded during `checkAnilistToken`; no in-app toggle).

---

## Edit Entry

Entry: [`AnilistEdit.tsx`](AnilistEdit.tsx)

Full progress editor overlay. Fields:

- **Status** — Planning, Current, Completed, Paused, Dropped, Repeating.
- **Score** — numeric.
- **Progress** — chapter/episode count.
- **Progress Volumes** — volume count.
- **Repeat** — reread count.
- **Private** — mark entry private on AniList.
- **Started / Completed** dates — fuzzy date input.

Saves via `setAnilistListEntry` (GraphQL mutation `SaveMediaListEntry`). Untracking dispatches `removeAnilistTracker`.

---

## Auto-Update Progress

`autoUpdateAnilistProgress` in manga / book reader settings:

When enabled, finishing a manga chapter (last page) or advancing book progress calls `setAnilistListProgress`, updates session `currentListEntry`, then `updateTrackerSnapshot` with `toAnilistTrackerSnapshotUpdate` so the local tracker cache stays in sync. AniList bar/edit still use `cacheAnilistListEntry` (same payload helper).

This only triggers when the item is linked (an `item_trackers` row for that path) and a valid `currentListEntry` is set in the Redux slice.

---

## Gallery Context Tracking

When the user right-clicks a gallery item and selects "Track with AniList...":

1. `setGalleryTrackContext({ link, title })` is dispatched to `anilist` slice.
2. `setAnilistSearchOpen(true)` opens the search overlay.
3. `AnilistSearch` reads `galleryTrackContext` (when set) instead of the reader state to know which item to link.

On close or after linking, `galleryTrackContext` is cleared to `null`. After a library relocate, `relocateGalleryTrackContext` rewrites the session link; tracker rows themselves are rewritten in the DB transaction.

---

## Redux

Generic tracker rows: [`src/renderer/store/trackers.ts`](../../store/trackers.ts) (`trackers.entries`). AniList session: [`src/renderer/store/anilist.ts`](../../store/anilist.ts).

**Rule:** AniList UI in this folder (and Settings / login) may use `addAnilistTracker`, `removeAnilistTracker`, `cacheAnilistListEntry`, `selectAnilistTracker`. Library, gallery details, and reader cache writes use the generic trackers APIs (`selectTracker`, `updateTrackerSnapshot`). GraphQL (`getAnilistListEntry`, `setAnilistListEntry`, `setAnilistListProgress`) stays here. Boundary: [`src/renderer/store/trackers.md`](../../store/trackers.md).

| State key | Slice | Type | Description |
| --- | --- | --- | --- |
| `entries` | `trackers` | `ItemTracker[]` | DB tracker rows for every provider |
| `token` | `anilist` | `string \| null` | AniList OAuth token (null = not logged in) |
| `currentListEntry` | `anilist` | `ListEntry \| null` | AniList list entry for the currently open / gallery item |
| `galleryTrackContext` | `anilist` | `{link, title} \| null` | Set when search is opened from the gallery |

Thunks: `fetchAllTrackers`, `upsertTracker`, `removeTracker`, `updateTrackerSnapshot` on the trackers slice. AniList wrappers: `importAnilistTrackingFromStorage`, `addAnilistTracker`, `removeAnilistTracker`, `cacheAnilistListEntry`.

`ui.isOpen.anilist.edit` / `.login` / `.search` — transient open/close flags in the `ui` slice.

---

## AniList module

[`src/renderer/utils/anilist.ts`](../../utils/anilist.ts)

Named exports (no static class). Call `initAnilist()` once at app startup to validate the stored token. GraphQL calls use the in-memory session token, falling back to the persisted `anilist_token` so requests still work before that startup effect (Settings is always mounted).

| Export | Description |
| --- | --- |
| `initAnilist()` | Load stored token into module state and validate it |
| `checkAnilistToken(token)` | Validates token against AniList API |
| `searchAnilistMedia(query)` | Search media by title; returns array of results. GraphQL `type: MANGA` includes novels |
| `getAnilistListEntry(mediaId)` | Create or fetch a MediaListEntry for the given media |
| `setAnilistListEntry(data)` | Save mutation for the current MediaListEntry |
| `setAnilistListProgress(n)` | Update progress count; returns updated `ListEntry` |
| `getAnilistStorageToken` / `setAnilistStorageToken` | Token localStorage persistence |
| `readStoredTracking` | Legacy `anilist_tracking` read for the one-shot import |
| `toTrackerMediaSnapshot` / `toTrackerListState` / `toAnilistTrackerSnapshotUpdate` / `authorFromAnilistStaff` | Map GraphQL payloads into DB cache columns / `updateTrackerSnapshot` args |

The GraphQL mutation (`SaveMediaListEntry`) is a module-level query string and requests description, genres, chapters, volumes, averageScore, coverImage.large, idMal, and staff (for cached author) in addition to the list-entry fields.

API calls use the shared HTTP client (`@common/http` / axios). Token is sent as `Authorization: Bearer <token>` header.
