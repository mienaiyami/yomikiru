# Research: FK parent for progress / bookmarks / notes — `link` vs `id`

> Date: 2026-08-09. Primary sources only (schema, drizzle/, DatabaseService, Redux, covers, AniList, relocate IPC, docs). No application code changes.

**Question:** Should child rows (`manga_progress`, `book_progress`, `manga_bookmarks`, `book_bookmarks`, `book_notes`) keep foreign keys to `library_items.link`, or switch to `library_items.id`?

**Verdict (short):** Keep `library_items.link` as the FK parent. See [§4 Recommendation](#4-recommendation).

---

## 1. Current state (cited)

### Schema

Source of truth: [`src/electron/db/schema.ts`](../src/electron/db/schema.ts).

- `library_items.id` — integer PK, autoincrement.
- `library_items.link` — `text().notNull().unique()` (absolute filesystem path).
- All five child tables use `itemLink: text().references(() => libraryItems.link, { onDelete: "cascade" })`.
- Drizzle `references()` here sets **ON DELETE CASCADE** only; there is **no** `onUpdate: "cascade"` in schema (defaults to no action). Confirmed in SQL and snapshot:
  - [`drizzle/0000_robust_the_professor.sql`](../drizzle/0000_robust_the_professor.sql): `REFERENCES library_items(link) ON UPDATE no action ON DELETE cascade` (all child FKs).
  - [`drizzle/meta/0001_snapshot.json`](../drizzle/meta/0001_snapshot.json): `"onDelete": "cascade", "onUpdate": "no action"` for every `itemLink` FK.

### Docs

[`docs/library.md`](library.md) (Library Items):

> `link` is the absolute filesystem path and is the natural key. `id` is an auto-increment integer used for the cover system.

Same doc: Locate on disk (`db:library:relocateItem`) rewrites `library_items.link` and every child `itemLink` while **keeping the same `id`**.

### History

| Era | Fact | Source |
| --- | --- | --- |
| Initial SQLite schema | `library_items.link` was the **PRIMARY KEY**; children already FK'd `itemLink` → `link` | [`drizzle/0000_robust_the_professor.sql`](../drizzle/0000_robust_the_professor.sql) lines 39–47, 49–71 |
| Migration 0001 | Added surrogate `id` PK; `link` became UNIQUE; **child FKs left on `link`** | [`drizzle/0001_redundant_sentinel.sql`](../drizzle/0001_redundant_sentinel.sql); commit `754a18d` message: *"Add library_items surrogate id (PK autoincrement), keep link UNIQUE; rebuild via SQL migration with INSERT..SELECT so FKs on itemLink stay valid"* |
| Covers | Cache path is `userData/covers/<libraryId>.webp` | [`src/electron/util/coverMaterialize.ts`](../src/electron/util/coverMaterialize.ts) (`coverFilePathForLibraryId`); [`src/renderer/utils/libraryCover.ts`](../src/renderer/utils/libraryCover.ts) (`canonicalCoverAbsolutePath`); [`docs/library.md`](library.md) Cover System |
| Relocate | Rewrites parent `link` + all child `itemLink`s with FK briefly off | [`DatabaseService.relocateLibraryItem`](../src/electron/db/index.ts) (JSDoc + body ~lines 133–194); plan [`.cursor/plans/missing_library_path_ux_5410965c.plan.md`](../.cursor/plans/missing_library_path_ux_5410965c.plan.md) |
| Redux library | `items: Record<string, …>` keyed by `link` | [`src/renderer/store/library.ts`](../src/renderer/store/library.ts) (`fetchAllItemsWithProgress.fulfilled`: `acc[item.link] = item`) |
| Legacy JSON → SQLite | Parent path derived from history/bookmark JSON links; inserts use that path as `library_items.link` / `itemLink` | [`DatabaseService.migrateFromJSON`](../src/electron/db/index.ts) (`parentLink = path.dirname(...)` / `item.data.link`); [`docs/library.md`](library.md) Legacy Migration |

### Split of responsibilities today

| Concern | Key used | Source |
| --- | --- | --- |
| Child FKs / progress / bookmarks / notes | `link` (`itemLink`) | `schema.ts` |
| Cover WebP cache filename | `id` | `coverMaterialize.ts`, `libraryCover.ts` |
| Open / continue / gallery selection | filesystem `link` | reader IPC `reader:loadLink` takes `{ link: string }` ([`src/common/types/ipc.ts`](../src/common/types/ipc.ts)); library slice keyed by link |
| AniList tracker binding | path string `localURL` (localStorage, not SQLite) | [`src/renderer/store/anilist.ts`](../src/renderer/store/anilist.ts); [`src/renderer/types/anilist.d.ts`](../src/renderer/types/anilist.d.ts) |

This split was **intentional** in `754a18d`: introduce `id` for covers without re-parenting child FKs.

---

## 2. Costs of keeping `link` as FK parent (cited)

### Relocate is a multi-table rewrite under FK-off

Because FKs are `ON UPDATE no action`, changing `library_items.link` alone would orphan or reject children. `relocateLibraryItem` therefore:

1. Sets `PRAGMA foreign_keys = OFF` via `withForeignKeysOff`.
2. In one better-sqlite3 transaction, `UPDATE`s five child tables’ `itemLink`, then `UPDATE library_items SET link`.
3. Restores FKs in `finally`.

Cited: JSDoc and implementation in [`src/electron/db/index.ts`](../src/electron/db/index.ts) (`relocateLibraryItem`); same FK-off lesson as migration 0001 (PRAGMA ignored inside Drizzle migrator transactions — comment at lines 73–85).

**Mitigation already shipped:** Locate UX + IPC + Redux optimistic remaps + tests (`index.test.ts` relocate case; `library.relocate.test.ts`). Plan: `missing_library_path_ux_5410965c.plan.md`.

### Renderer / Redux must remap path keys on relocate

Not only the DB:

- Library slice: delete `items[oldLink]`, write `items[newLink]`, rewrite nested `progress.itemLink` — [`library.ts`](../src/renderer/store/library.ts) `relocateLibraryItem.fulfilled`.
- Bookmarks / bookNotes slices: remap `Record` keys and each row’s `itemLink` — [`bookmarks.ts`](../src/renderer/store/bookmarks.ts), [`bookNotes.ts`](../src/renderer/store/bookNotes.ts).
- Thunk JSDoc explicitly: callers should update AniList `localURL` and UI selection holding `oldLink`.

### AniList is path-keyed outside the DB

`relocateAnilistTrackerLocalURL` patches `tracking[].localURL` and `galleryTrackContext.link` in Redux + `localStorage`. Comment in [`anilist.ts`](../src/renderer/store/anilist.ts):

> Temp only: tracking is still in localStorage … Planned follow-up is to store AniList trackers in the DB so relocate can rewrite them with other `itemLink` FKs instead of this renderer patch.

`dispatchRelocateLibraryItem` in [`libraryMissingPath.ts`](../src/renderer/utils/libraryMissingPath.ts) always remaps AniList after a successful relocate. **Switching child FKs to `id` would not remove this path remap** until AniList storage itself stops using `localURL` as the join key.

### String FK surface area

- IPC progress/bookmark/note channels take `{ itemLink: string }` — [`src/common/types/ipc.ts`](../src/common/types/ipc.ts) (`db:manga:*`, `db:book:*`).
- Redux bookmarks/notes maps are keyed by `itemLink` string — [`bookmarks.ts`](../src/renderer/store/bookmarks.ts) comment: `map of key:itemLink value: bookmarks`.
- Path strings complicate composite keys in UI helpers: [`listSelectionActions.ts`](../src/renderer/features/home/classic/listSelectionActions.ts) uses `\0` separator because *"paths may contain `::`"*.
- Chapter open still joins disk path: `resolveMangaChapterPath(itemLink, chapterName)` — [`mangaChapterPath.ts`](../src/renderer/utils/mangaChapterPath.ts).

These are real costs, but they match the domain: the app’s primary user-facing identity for an item **is** a filesystem path (open folder / `.epub`, missing-path Find, AniList local file bind).

### FK-off windows are sensitive (production)

Any future path rewrite or parent-table rebuild must remember the 0001 CASCADE wipe hazard ([`docs/library.md`](library.md) Migration 0001 — FK guard; `DatabaseService.initialize`). Keeping link-as-FK does not create that hazard by itself; **table rebuilds** do. Relocate already documents the same constraint.

---

## 3. Costs of switching to `id` as FK parent (cited)

### Migration surface (SQLite + skip-update)

SQLite cannot cheaply retarget an FK column in place. A switch would look like rebuilds of all five child tables (new integer column → `library_items.id`, copy rows via join on `link`, drop old, rename) — the same class of operation as 0001’s `DROP TABLE library_items`, which **required** connection-level `foreign_keys = OFF` to avoid CASCADE wiping children ([`index.ts`](../src/electron/db/index.ts) initialize comment; [`0001_redundant_sentinel.sql`](../drizzle/0001_redundant_sentinel.sql)).

Production-safe rules in-repo (`.cursor/rules/production-safe-upgrades.mdc`): additive preferred; never DROP/rebuild parent with CASCADE children while FKs on; migrations must be idempotent and work after skipped versions. A five-table FK retarget is the opposite of “smallest correct change.”

### IPC / API / type churn

Today nearly every child DB channel is path-addressed (`itemLink`). A switch implies:

- Schema + Drizzle relations (`fields: [*.itemLink], references: [libraryItems.link]` in [`schema.ts`](../src/electron/db/schema.ts)).
- Zod validators (`UpdateMangaProgressSchema` / bookmark insert schemas require `itemLink`) — [`validator.ts`](../src/electron/db/validator.ts).
- `DatabaseChannels` in [`ipc.ts`](../src/common/types/ipc.ts) and handlers in [`ipc/database.ts`](../src/electron/ipc/database.ts).
- Redux thunks/slices, fixtures (`src/test/fixtures/libraryItem.ts`), db tests, RTL/unit tests touching bookmarks/progress.
- Unique indexes that include `itemLink` (e.g. `uq_manga_bookmarks_item_chapter_page` on `(itemLink, chapterName, page)` in schema / 0001).

Rough scale: `itemLink` appears across **30+** source files under `src/` (rg count).

### What becomes easier

- **`relocateLibraryItem` DB half:** with FKs on `id`, relocating is essentially `UPDATE library_items SET link = ? WHERE id = ?` (or `WHERE link = ?`) — no child `itemLink` UPDATEs, no FK-off for that path rewrite. Cover cache already stays valid because relocate **keeps `id`** ([`index.ts`](../src/electron/db/index.ts) JSDoc: *"Keeps the same row `id` (cover cache stays valid)"*).
- Child rows stop storing duplicated long path strings (storage/index nicety; not a user-visible bug today).

### What does **not** become easier (still path-keyed)

- Redux **library** slice remains naturally keyed by path for open/lookup (`selectLibraryItem` derives dir from reader path — [`library.ts`](../src/renderer/store/library.ts)).
- AniList `localURL` remapping still required ([`anilist.ts`](../src/renderer/store/anilist.ts)).
- Reader load / missing-path UX still deal in filesystem paths ([`ipc.ts`](../src/common/types/ipc.ts) `reader:loadLink`; [`libraryMissingPath.ts`](../src/renderer/utils/libraryMissingPath.ts)).
- Chapter path resolution still needs the parent folder path + `chapterName` ([`mangaChapterPath.ts`](../src/renderer/utils/mangaChapterPath.ts)).

So id-as-FK mainly simplifies **one already-implemented** DB transaction, while forcing a large migrate + IPC rewrite and leaving most UX identity on `link`.

### Dual-key mental load during transition

Skip-update users may sit on DBs that still have `itemLink` text FKs; healers must accept both shapes or rebuild idempotently. The project already carries legacy normalize for pre-0001 columns ([`legacyNormalize.ts`](../src/electron/db/legacyNormalize.ts)); another dual-era FK target increases that burden.

---

## 4. Recommendation

**Keep `library_items.link` as the foreign key parent for progress, bookmarks, and notes.**

### Why (Yomikiru-specific, ponytail)

1. **Already the deliberate design after introducing `id`.** Commit `754a18d` added surrogate `id` for covers and **explicitly kept** `itemLink` → `link`. Docs still state link = natural key, id = covers ([`docs/library.md`](library.md)).
2. **Domain key is the path.** Open/read/continue, gallery selection, legacy JSON import, and AniList `localURL` are all path-centric. Child FKs aligned with that key avoid a permanent join through `id` for every progress/bookmark call that already has a path in hand.
3. **The main tax of link-as-FK is relocate — and it is paid.** `relocateLibraryItem` + Redux remaps + AniList patch + tests exist. Switching FKs would not delete AniList/path remap work.
4. **Switch cost vs benefit fails production/skip-update constraints.** Five-table FK retarget + IPC/Redux churn risks CASCADE data loss (the exact class of bug 0001 guards against) for a smaller relocate SQL body. Prefer not to ship another DROP/rebuild era for skip-update users.

### If keeping: what **not** to do

- **Do not** “fix” relocate by adding `ON UPDATE CASCADE` alone and assuming the app is done — Redux maps and AniList `localURL` still need remaps ([`library.ts`](../src/renderer/store/library.ts), [`anilist.ts`](../src/renderer/store/anilist.ts)); SQLite/Drizzle update-cascade behavior would not replace those layers.
- **Do not** half-migrate (e.g. only progress → `id`, bookmarks still on `link`).
- **Do not** re-key Redux bookmarks/notes to numeric `id` while DB FKs remain on `link` (split-brain keys).
- **Do not** DROP/rebuild `library_items` (or children) without the established FK-off guard pattern ([`DatabaseService.initialize`](../src/electron/db/index.ts) / relocate’s `withForeignKeysOff`).
- **Do not** treat cover `id` as a reason to re-parent children — covers already use `id` without needing child FKs on `id`.

### Optional later (only if a stronger driver appears)

Revisit id-as-FK **together with** moving AniList trackers into SQLite keyed by `library_items.id` (already noted as a planned follow-up in [`anilist.ts`](../src/renderer/store/anilist.ts)). Even then, weigh against IPC churn; the library slice may still stay path-keyed for open.

### If ever switching: minimal migration sketch (not recommended now)

1. Preflight: ensure every child `itemLink` joins exactly one `library_items.link` (orphan report; abort on orphans).
2. Connection-level `foreign_keys = OFF` (same pattern as 0001 / relocate).
3. For each child table: create `__new_*` with `itemId integer REFERENCES library_items(id) ON DELETE CASCADE`, `INSERT…SELECT` joining old `itemLink` to `library_items.link`, drop old, rename; recreate indexes/uniques on `itemId`.
4. Restore FKs; idempotent guard (e.g. column rename already applied → skip).
5. Sweep IPC/validators/Redux/tests from `itemLink` → `itemId` (or keep path in API and resolve to `id` only inside `DatabaseService` — smaller renderer churn, still needs schema migrate).
6. Simplify `relocateLibraryItem` to update `library_items.link` only; keep Redux/AniList path remaps.

---

## 5. Source index

| Claim | Primary source |
| --- | --- |
| Child FK → `link`, CASCADE delete, no update cascade | `src/electron/db/schema.ts`; `drizzle/0000_*.sql`; `drizzle/meta/0001_snapshot.json` |
| link natural key; id for covers | `docs/library.md` |
| Original PK was `link` | `drizzle/0000_robust_the_professor.sql` |
| id added; FKs stayed on link | `drizzle/0001_redundant_sentinel.sql`; commit `754a18d` |
| Relocate rewrites link + child itemLinks, FK off, keeps id | `src/electron/db/index.ts` `relocateLibraryItem` |
| Cover path `userData/covers/<id>.webp` | `coverMaterialize.ts`; `libraryCover.ts`; `docs/library.md` |
| Redux library keyed by link | `src/renderer/store/library.ts` |
| Bookmarks/notes keyed by itemLink; remap on relocate | `src/renderer/store/bookmarks.ts`; `bookNotes.ts` |
| AniList `localURL` path + relocate patch | `src/renderer/store/anilist.ts`; `libraryMissingPath.ts` |
| Legacy JSON keyed by path | `DatabaseService.migrateFromJSON`; `docs/library.md` |
| IPC child APIs use `itemLink` | `src/common/types/ipc.ts` |
| Relocate product intent | `.cursor/plans/missing_library_path_ux_5410965c.plan.md` |
