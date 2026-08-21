# Research: library scan, watching, and continue vs catalogue

Primary-source notes behind [library-discovery.md](library-discovery.md). Not a blog roundup. Yomikiru code facts match [library.md](library.md) and the sources named below.

---

## Yomikiru today (code)

Manual **Add valid items** (`LibrarySettings.tsx` -> `addMangaFolderAtNormalizedPath`):

- Only immediate children of Default Location (`baseDir`).
- Validates with `DirectoryValidatorService` options `maxSubdirectoryDepth: 1`, `firstImageOnly: true` (`mangaSeriesFirstImageScanOptions`).
- No images at this level: recurse into the **first** non-empty subdirectory only; then depth is exhausted.
- Any image at the current folder (including a series-root cover) counts as success. Import then stores `chapterName` from `dirname(firstImage)`, which for a cover is the **series folder name**, not a chapter.
- Packed chapter files (`.cbz` in the series folder, no loose images) fail validation (the helper looks for images).
- EPUB has a separate **recursive** walk.

`addLibraryItem` always inserts `manga_progress` / `book_progress` with `lastReadAt` defaulting to now. Gallery Continue Reading and classic History both filter `item.progress`. Details Start vs Continue already keys off progress truthiness. `getAllAndProgress` left-joins; types allow `progress: null`; the add path never produces it.

Gallery details lists **direct children** as chapters: dirs with images, or packed/PDF files; skips root image files; omits empty dirs (`MangaDetailsPanel.refreshChapters`). That is the series contract. The reader treats the opened path as a **chapter** and `dirname` as the library `link` (`Reader.tsx` `loadImgs`).

Relocate (`relocateLibraryItem`): rewrite `link` + child `itemLink`s, keep `id`. If `newLink` is already a library row, return `null`. Opening a moved folder therefore creates a **second** row; Locate onto that path fails.

Chokidar is already on `window.chokidar` (Locations list refresh and reader side-list, depth 0, ~1s debounce). Settings already warn that filesystem watch on large chapter lists can be heavy (`autoRefreshSideList`).

---

## Other apps (first-party)

### Komga

- [Libraries](https://komga.org/docs/guides/libraries/) — many libraries; roots must not overlap; scan on startup; scan interval; optional empty-trash after scan.
- [Scan](https://komga.org/docs/guides/scan-analysis-refresh/) — **Series = every subfolder at any depth**; **Book = each file** in that folder. Not an image-folder walker. Nested volume folders become extra series ([gotson/komga#46](https://github.com/gotson/komga/issues/46)).
- [Local artwork](https://komga.org/docs/guides/local-artwork-assets/) — series posters named `cover`, `default`, `folder`, `series`, or `poster`.
- [Read progress](https://komga.org/docs/guides/read-progress/) — unread vs in-progress vs series unread count; written by readers, not by scan.
- [One-shots](https://komga.org/docs/guides/oneshots/) — special directory name; Recently Added Series vs Books are different.

Do **not** copy “every folder is a series” for Yomikiru chapter-image trees.

### Kavita

- [Libraries](https://wiki.kavitareader.com/guides/admin-settings/libraries/) — one named library may have **several folders** (multiple drives). Do not pick a series folder as the root. Per-library file types and exclude globs. Image library type: series name = top-level folder.
- [`Parser.IsCoverImage`](https://github.com/Kareadita/Kavita/blob/f02e1f7d1f04c9df994eb94a85683798755cc7d6/API/Services/Tasks/Scanner/Parser/Parser.cs) — `cover` or `folder` in the filename; not `backcover`.
- [General: folder watching](https://wiki.kavitareader.com/guides/admin-settings/general/) — global watch default off; when on, coalesce about 10 minutes. Docker/WSL2 watch unsupported.
- On Deck query ([`SeriesRepository`](https://github.com/Kareadita/Kavita/blob/4ac13f1f/API/Data/Repositories/SeriesRepository.cs)): `PagesRead > 0` and not finished, plus last-progress / last-chapter-added cutoffs. Newly scanned series do not appear On Deck.
- Dashboard streams: On Deck, Recently Added, Recently Updated are separate ([customization](https://wiki.kavitareader.com/guides/features/customization/)).

Steal: multi-folder roots, named covers, catalogue vs On Deck, delayed/optional watch.

### Mihon / Suwayomi local

- [Mihon local source](https://mihon.app/docs/guides/local-source/) — hard two-level `local / series / chapter`; `cover.jpg` beside chapters; pull to refresh.
- [Suwayomi Local Source](https://github.com/Suwayomi/Suwayomi-Server/wiki/Local-Source) — same layout; example chapter-internal `01 - cover.jpg` is a **page**.

This is Yomikiru’s current import assumption and the extra-grouping-folder failure.

### Calibre

- [GUI adding books](https://manual.calibre-ebook.com/en/gui.html) — recursive folder add; each folder can be one book.
- Auto-add is a **drop folder that imports then deletes** the file (Calibre GUI Automatic Adding). Do not copy; Yomikiru must not move or delete the user’s tree.

### Plex (UX only)

- [On Deck vs Recently Added](https://support.plex.tv/articles/200380843-overview/)
- [Continue Watching vs Recently Added](https://support.plex.tv/articles/navigating-the-big-screen-apps/)

In-progress is not "new files." Yomikiru gallery already has Library + Continue Reading; import currently dumps into Continue Reading.

### Node watch

[Node.js `fs.watch` caveats](https://nodejs.org/docs/latest/api/fs.html#fswatchfilename-options-listener): inconsistent; Windows `EPERM` on delete; unreliable on NFS/SMB and some VMs. Chokidar is already a Yomikiru dependency.

---

## Implications (analysis)

1. Do not copy Komga “every folder is a series” (file-as-book). Yomikiru series are folders whose children are chapters.
2. Do not keep Mihon’s two-level rule as the only scan.
3. Do copy Kavita multi-folder roots, named covers, and On Deck requiring real reads.
4. Scan adds unread catalogue rows. Continue Reading is progress. Recently Added (`createdAt`) is optional later, not Continue Reading.
5. Watch optional and delayed; interval + Scan now is enough for the first ship.
6. Never delete user files on scan (unlike Calibre auto-add).
7. Relocate-into-occupied-path must merge; opening a moved folder should prefer relocate-before-add.
