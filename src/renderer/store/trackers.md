# Tracker store vs AniList helpers

SQLite `item_trackers` is provider-agnostic. Renderer code that **reads or writes those rows** should go through [`trackers.ts`](trackers.ts), not AniList-named thunks. AniList-named APIs stay for GraphQL, OAuth, and AniList UI.

---

## Generic APIs (`store/trackers.ts`)

Use these from library, gallery details, app bootstrap, relocate, readers (cache writes), and any future provider:

| Export | Role |
| --- | --- |
| `fetchAllTrackers` | Load every `item_trackers` row (`db:trackers:getAll`) |
| `upsertTracker` | Insert or replace a row (`itemLink`, `provider`, `remoteId`, ...) |
| `removeTracker` | Delete one `(itemLink, provider)` row |
| `updateTrackerSnapshot` | Write cached `media` / `listState` / `syncedAt` |
| `selectTracker(state, itemLink, provider)` | One row, or `undefined` |

`resolveItemMetadata` already takes a generic `ItemTracker`. Pass whatever `selectTracker` returns.

`provider: "anilist"` at those call sites is the row discriminator while `TrackerProvider` has one member. Do not add a "first tracker for this item" picker until a second provider exists.

---

## AniList-only APIs (keep)

**GraphQL / token** ([`utils/anilist.ts`](../utils/anilist.ts)): `getAnilistViewer`, `getAnilistListEntry`, `setAnilistListEntry`, `setAnilistListProgress`, `searchAnilistMedia`, storage token helpers, `toTrackerMediaSnapshot`, `toTrackerListState`, `toAnilistTrackerSnapshotUpdate`. These know the AniList payload; they are not DB thunks.

**Session slice** ([`anilist.ts`](anilist.ts)): `token`, `currentListEntry`, `galleryTrackContext`, `setAnilistToken`, `setAnilistCurrentListEntry`, `setGalleryTrackContext`, `runAnilistLegacyStartupIfClaimed`, `importAnilistTrackingFromStorage`.

**AniList UI** (`features/anilist/*`, Settings AniList, login): may keep calling `addAnilistTracker`, `removeAnilistTracker`, `cacheAnilistListEntry`, `selectAnilistTracker`. Those are thin wrappers over the generic thunks with `provider: "anilist"`.

Cache write after a GraphQL list-entry returns:

```ts
void dispatch(updateTrackerSnapshot(toAnilistTrackerSnapshotUpdate(itemLink, data)));
```

---

## Converted call sites

| File | Row API |
| --- | --- |
| [`MangaDetailsPanel.tsx`](../features/home/gallery/components/MangaDetailsPanel.tsx) | `selectTracker(store, link, "anilist")` |
| [`BookDetailsPanel.tsx`](../features/home/gallery/components/BookDetailsPanel.tsx) | same |
| [`Reader.tsx`](../features/reader/manga/Reader.tsx) | `updateTrackerSnapshot(toAnilistTrackerSnapshotUpdate(...))` after auto-progress |
| [`EPubReader.tsx`](../features/reader/epub/EPubReader.tsx) | same |

Readers still call `setAnilistListProgress` and `setAnilistCurrentListEntry`: auto-progress is AniList GraphQL + session. Only the **DB cache write** is generic.

### Already generic / AniList-UI (leave)

- App.tsx: `fetchAllTrackers` on every window boot (with bookmarks / notes / metadata) and on `db:tracker:change`. After library hydrate, `runAnilistLegacyStartupIfClaimed` may migrate legacy localStorage tracking (once per process) and refetch only when that import wrote rows. Clearing `currentListEntry` / gallery track context on reader close is AniList session.
- [`GalleryView.tsx`](../features/home/gallery/GalleryView.tsx): `setGalleryTrackContext` + AniList search overlay is AniList UI.
- [`AnilistBar.tsx`](../features/anilist/AnilistBar.tsx), [`AnilistSearch.tsx`](../features/anilist/AnilistSearch.tsx), [`AnilistEdit.tsx`](../features/anilist/AnilistEdit.tsx), login / Settings.

Do **not** dump OAuth or GraphQL into the trackers slice. A second provider gets a new UI + mapping module and still uses `upsertTracker` / `selectTracker`.

---

## Related

- Schema / IPC: [`docs/library.md`](../../../docs/library.md) (Trackers)
- AniList feature: [`features/anilist/README.md`](../features/anilist/README.md)
