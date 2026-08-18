# AniList Integration

> Last updated: 2026-08-18. Covers v2.24.x.

Yomikiru can track reading progress on [AniList](https://anilist.co) (manga and novels).
The integration is fully optional and requires a personal AniList OAuth token.

---

## Table of Contents

- [AniList Integration](#anilist-integration)
  - [Table of Contents](#table-of-contents)
  - [Authentication](#authentication)
  - [Tracking Store](#tracking-store)
  - [AniList Bar](#anilist-bar)
  - [Search and Link](#search-and-link)
  - [Edit Entry](#edit-entry)
  - [Auto-Update Progress](#auto-update-progress)
  - [Gallery Context Tracking](#gallery-context-tracking)
  - [Redux Slice](#redux-slice)
  - [AniList Utility Class](#anilist-utility-class)

---

## Authentication

Entry: [`AniLogin.tsx`](AniLogin.tsx)

The user must supply a personal AniList OAuth token. No OAuth flow is initiated from within the app (to avoid requiring a client ID or redirect server).

Steps:

1. Open Settings → AniList section (or click "Login" in the AniList bar).
2. Click the link to the AniList developer page to generate a token.
3. Paste the token into the input.
4. Click "Login" — the token is validated against the AniList API.

The token is stored in `localStorage` via `AniList.setStorageToken` (key `ANILIST_TOKEN`). On startup, `AniList.checkToken` verifies it is still valid; if not, a dialog prompts the user to re-login.

---

## Tracking Store

`AniList.TrackStore` is a `localStorage`-persisted JSON array of tracking items:

```
TrackItem {
  localURL: string      // absolute filesystem path of the manga/book
  mediaId: number       // AniList media id
  mediaListId: number   // AniList media list entry id (for mutations)
}
```

Stored in `localStorage` under a fixed key via `AniList.setStorageTracking` / `AniList.loadTrackingFromStorage`.
Redux slice mirrors this as `anilist.tracking` (array).

---

## AniList Bar

Entry: [`AnilistBar.tsx`](AnilistBar.tsx)

The `AnilistBar` component appears in:

- The manga reader side-list (`variant="bar"`, default).
- The EPUB reader side-list (`variant="bar"`).
- Gallery manga/book details (`variant="compact"`).

**Bar** (reader): progress counter with `+` / `-`, an edit control, and Track when unlinked. Progress uses a debounced 1-second save via `AniList.setCurrentMangaProgress`.

**Compact** (gallery details): Track, or a status/count control that opens the existing search/edit overlays. No `+` / `-` on this page.

When `localLibraryLink` prop is provided (gallery details), tracking resolves from that path instead of the open reader item.

---

## Search and Link

Entry: [`AnilistSearch.tsx`](AnilistSearch.tsx)

When "Track with AniList..." is selected (reader bar or gallery context menu), the search overlay opens.

1. User types a title → `AniList.search(query)` calls the AniList GraphQL API.
2. Results show cover, title (English/Romaji/Native), format, status, episode/chapter count.
3. Selecting a result:
   - Calls `AniList.addEntry(mediaId)` to create or fetch the media list entry.
   - Stores `{ localURL, mediaId, mediaListId }` in the tracking store.
   - Dispatches `setAnilistCurrentManga(mangaData)` so the reader bar shows the linked entry.

Adult content is only shown when `AniList.displayAdultContent = true` (no UI toggle currently; controlled by the AniList account setting).

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

Saves via `AniList.updateEntry(data)` (GraphQL mutation `SaveMediaListEntry`).

---

## Auto-Update Progress

`autoUpdateAnilistProgress` in manga reader settings:

When enabled, every time the manga reader detects the user has completed a chapter (last page reached), it calls `AniList.setCurrentMangaProgress` to increment the AniList progress count by 1 automatically.

This only triggers when the item is linked (exists in `anilist.tracking`) and a valid `currentManga` is set in the Redux slice.

---

## Gallery Context Tracking

When the user right-clicks a gallery item and selects "Track with AniList...":

1. `setGalleryTrackContext({ link, title })` is dispatched to `anilist` slice.
2. `setAnilistSearchOpen(true)` opens the search overlay.
3. `AnilistSearch` reads `galleryTrackContext` (when set) instead of the reader state to know which item to link.

On close or after linking, `galleryTrackContext` is cleared to `null`.

---

## Redux Slice

[`src/renderer/store/anilist.ts`](../../store/anilist.ts)

| State key | Type | Description |
| --- | --- | --- |
| `token` | `string \| null` | AniList OAuth token (null = not logged in) |
| `tracking` | `TrackItem[]` | All local-to-AniList links |
| `currentManga` | `MangaData \| null` | AniList data for the currently open item |
| `galleryTrackContext` | `{link, title} \| null` | Set when search is opened from the gallery |

`ui.isOpen.anilist.edit` / `.login` / `.search` — transient open/close flags in the `ui` slice.

---

## AniList Utility Class

[`src/renderer/utils/anilist.ts`](../../utils/anilist.ts)

Static class. Key methods:

| Method | Description |
| --- | --- |
| `checkToken(token)` | Validates token against AniList API |
| `search(query)` | Search media by title; returns array of results |
| `addEntry(mediaId)` | Create or fetch a MediaListEntry for the given media |
| `updateEntry(data)` | Save mutation for a MediaListEntry (status, score, progress, etc.) |
| `setCurrentMangaProgress(n)` | Update progress count; returns updated MangaData |
| `getStorageToken` / `setStorageToken` | localStorage persistence |
| `loadTrackingFromStorage` / `setStorageTracking` | TrackStore persistence |

The GraphQL mutation (`SaveMediaListEntry`) is defined as a static string field on the class and supports all MediaListEntry fields.

API calls use the shared HTTP client (`@common/http` / axios). Token is sent as `Authorization: Bearer <token>` header.
