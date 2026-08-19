# Tracker store vs AniList helpers

SQLite `item_trackers` is provider-agnostic. Renderer code that **reads or writes those rows** should go through [`trackers.ts`](trackers.ts), not AniList-named thunks. AniList-named APIs stay for GraphQL, OAuth, and AniList UI.

This file is the follow-up checklist. **Do not convert call sites in the same commit that only adds this doc.**

---

## Generic APIs (`store/trackers.ts`)

Use these from library, gallery details, app bootstrap, relocate, and any future provider:

| Export | Role |
| --- | --- |
| `fetchAllTrackers` | Load every `item_trackers` row (`db:trackers:getAll`) |
| `upsertTracker` | Insert or replace a row (`itemLink`, `provider`, `remoteId`, ...) |
| `removeTracker` | Delete one `(itemLink, provider)` row |
| `updateTrackerSnapshot` | Write cached `media` / `listState` / `syncedAt` |
| `selectTracker(state, itemLink, provider)` | One row, or `undefined` |

`resolveItemMetadata` already takes a generic `ItemTracker`. Pass whatever `selectTracker` returns.

---

## AniList-only APIs (keep)

**GraphQL / token** ([`utils/anilist.ts`](../utils/anilist.ts)): `getAnilistListEntry`, `setAnilistListEntry`, `setAnilistListProgress`, `searchAnilistMedia`, `checkAnilistToken`, storage token helpers, `toTrackerMediaSnapshot`, `toTrackerListState`. These know the AniList payload; they are not DB thunks.

**Session slice** ([`anilist.ts`](anilist.ts)): `token`, `currentListEntry`, `galleryTrackContext`, `setAnilistToken`, `setAnilistCurrentListEntry`, `setGalleryTrackContext`, `importAnilistTrackingFromStorage`.

**AniList UI** (`features/anilist/*`, Settings AniList, login): may keep calling `addAnilistTracker`, `removeAnilistTracker`, `cacheAnilistListEntry`, `selectAnilistTracker`. Those are thin wrappers over the generic thunks with `provider: "anilist"`.

---

## Follow-up (next commit)

Goal: outside AniList UI, dispatch / select only the generic trackers APIs. Mapping from `Anilist.ListEntry` stays in `utils/anilist.ts`.

Suggested shape for a cache write after a GraphQL list-entry returns:

```ts
void dispatch(
    updateTrackerSnapshot({
        itemLink,
        provider: "anilist",
        remoteListId: String(data.id),
        remoteUrl: data.media.siteUrl,
        media: toTrackerMediaSnapshot(data.media),
        listState: toTrackerListState(data),
        syncedAt: new Date(),
    }),
);
```

Optional: extract that object from `cacheAnilistListEntry` into a payload helper in `utils/anilist.ts` so AniList UI and the reader share one field list without AniList-named DB thunks at library/reader call sites.

### Convert

| File | Today | Next |
| --- | --- | --- |
| [`MangaDetailsPanel.tsx`](../features/home/gallery/components/MangaDetailsPanel.tsx) | `selectAnilistTracker` | `selectTracker(store, link, "anilist")` |
| [`BookDetailsPanel.tsx`](../features/home/gallery/components/BookDetailsPanel.tsx) | same | same |
| [`Reader.tsx`](../features/reader/manga/Reader.tsx) | `cacheAnilistListEntry` after auto-progress | `updateTrackerSnapshot` + mapping helpers |
| [`EPubReader.tsx`](../features/reader/epub/EPubReader.tsx) | same | same |

Keep `setAnilistListProgress` and `setAnilistCurrentListEntry` in the readers: auto-progress is an AniList GraphQL + session update. Only the **DB cache write** should be generic.

### Already generic / AniList-UI (leave)

- [`App.tsx`](../App.tsx): `fetchAllTrackers` on boot and `db:tracker:change`. Clearing `currentListEntry` / gallery track context on reader close is AniList session.
- [`GalleryView.tsx`](../features/home/gallery/GalleryView.tsx): `setGalleryTrackContext` + AniList search overlay is AniList UI.
- [`AnilistBar.tsx`](../features/anilist/AnilistBar.tsx), [`AnilistSearch.tsx`](../features/anilist/AnilistSearch.tsx), [`AnilistEdit.tsx`](../features/anilist/AnilistEdit.tsx), login / Settings.

Do **not** dump OAuth or GraphQL into the trackers slice. A second provider gets a new UI + mapping module and still uses `upsertTracker` / `selectTracker`.

---

## Related

- Schema / IPC: [`docs/library.md`](../../../docs/library.md) (Trackers)
- AniList feature: [`features/anilist/README.md`](../features/anilist/README.md)
