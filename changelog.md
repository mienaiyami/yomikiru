> [!Note]
> **Community Discord Server**: A Discord server for Yomikiru and Collection Extension is now open. Join for discussions, usage help, feedback, and updates. See [Discussion #495](https://github.com/mienaiyami/yomikiru/discussions/495).

# 2.25.1

- fix: Mouse back and forward run their shortcut once per click. Releasing the button was running it again, so a page binding turned two pages and a scroll binding kept scrolling.

# 2.25.0

Previous stable: <https://github.com/mienaiyami/yomikiru/releases/tag/v2.24.0>

Gallery mode has been on my mind for a long time. I started working on it almost over a year ago, but until the last couple of months I only really got about ~10% of the way there; life and other priorities kept getting in the way. The last stretch I finally pushed hard to get it into a shape you can use every day.

Huge thanks for waiting and for the support along the way. This is the stable cut of the 2.25 beta line (through 2.25.0-beta.13, plus the fixes that landed after that beta). If something still feels wrong, please say so.

Join Discord for chat and quicker feedback: <https://discord.gg/UHwBN9g22e> · [Discussion #495](https://github.com/mienaiyami/yomikiru/discussions/495)

- [Before you update](#before-you-update)
- [Highlights](#highlights)
- [Gallery](#gallery)
- [Library, scan, and files](#library-scan-and-files)
- [Reader](#reader)
- [Settings and shortcuts](#settings-and-shortcuts)
- [Fixes](#fixes-worth-calling-out)

---

## Before you update

### Requirements

- **Electron 44** (Chromium 152). Builds are **64-bit only**.
- **Windows 10 or later.** Windows 7, 8, and 8.1 are not supported. The last stable that still supports them is **2.24.0**. The last beta is **2.25.0-beta.7**.
- macOS builds need **macOS 13 or later**.
- The 32-bit setup and 32-bit portable zip are no longer real 32-bit builds. The 64-bit portable zip and the 64-bit setup stay, and copies of those files are also uploaded under the old 32-bit filenames so an existing 32-bit install can update on 64-bit Windows. Those extra files are release assets only; the download table does not list them.

### Behaviour changes

1. **Default Location moved**  
   It now lives under Library settings. On first launch after upgrade it is reset once. The app will ask you to pick your Home library folder, or you can use the system home folder until you change it later.

2. **Books are EPUB-only**  
   Standalone `.html`, `.xhtml`, and `.txt` are no longer opened, listed as chapters, or registered in Windows “Open with”. Old library rows for those files stay until you remove them. The Style Settings text-file badge toggle is gone.

3. **“Focus sidelist search” shortcut is gone**  
   Replaced by **Focus search** (default `/` and `Ctrl+Shift+F`) for the search field on the current page (home, gallery, reader sidelist, Settings, AniList, etc.).

4. **Database schema updates**  
   First launch may migrate the library DB. The app snapshots `data.db` into `backups/` before that (even if auto-backup is off). Prefer quitting and restoring if a migrate fails.

5. **“EPUB: Load By Chapter” is gone**  
   It did not actually load the whole book. Whole-book reading is the book-preset option **Continuous chapters (experimental)** below.

### Still there

- Classic home list still works. Gallery is a toggle, not a forced replacement.
- AniList login token stays in localStorage (not inside DB backups).
- Existing library rows, progress, bookmarks, and notes are kept across the upgrade.

---

## Highlights

- **Gallery home** — cover grid with Continue / Library / Bookmarks / Favourites, details pages, multi-select, tags, favourites, notes, and metadata.
- **Real library scanning** — extra folders, scan on start / interval, live disk watch, skip rules, folder tags, progress in the title bar.
- **Bundled 7-Zip** — CBZ/ZIP, CBR/RAR, CB7/7z without installing system `unrar`.
- **Library DB backups** — automatic and manual backup/restore in Settings.
- **App language** — English built-in; install community language packs as zip.
- **Settings search and a real shortcut editor** — jump to any setting, and rebind commands from the catalog.
- **Reader** — per-title presets, experimental continuous EPUB chapters, and delete page / chapter from the manga reader.
- **Reader scroll stutter** addressed (#523).

---

## Gallery

Toggle **Classic / Gallery** in the top bar.

- Cover grid with sections: **Continue**, **Library**, **Bookmarks**, **Favourites**. Search stays active when you switch sections.
- Toolbar: search, sort (where it applies), view modes (Cover + Title / Cover Only / Compact / List), grid size.
- Type filter: All / Manga·Webcomic / eBook (EPUB; not PDF).
- **Tag filter** is one three-state list per tag (off, include, exclude). Include still means any of those tags. Exclude hides titles that have any excluded tag; untagged titles stay visible when you only exclude. The closed control shows the tag name when only one is included or excluded, otherwise `+n -m`, with the colour-mark grid (circles for include, triangles for exclude). Saved as signed ids in `galleryTagFilterIds`, so an older include-only list still works.
- When AniList is connected, a remembered tracking filter (all / tracked / untracked) sits on the toolbar. While signed out it stays inactive, so a hidden filter never narrows the gallery.
- Section tabs, type filters, details list tabs, and the details back button show a hover tooltip from the start of the control. Tab labels stay visible until the window is 1650px wide or narrower. (#539)
- Rebindable shortcut pairs cycle gallery section tabs and type filters, and the same first-bar pair switches manga or book details tabs. They wrap, and they work while the related search field is focused. Defaults are added without changing bindings you already set.
- **Details** can use the resizable header or a resizable metadata sidebar. The view, header height, and sidebar width are remembered across manga and books. Horizontal view keeps local progress and tags beside a portrait cover; notes and tracker metadata flow below.
- Details page: large cover, Continue/Start, favourite, edit title/author/About/genres, note, path copy, Show in File Explorer, chapter/bookmark/note lists.
- AniList **Track** is always on the details page (disabled until you log in; tip when untracked). Tracked titles keep status and get **Open on AniList** above About.
- Edited titles show everywhere. The original folder/file name stays muted in parentheses when it differs.
- When AniList is tracked: releasing status, score, chapter count, and a local AniList cover you can switch back to the library cover.
- **Locate on disk** when a folder or EPUB is missing; progress and bookmarks stay.
- Empty image folders are hidden in chapter lists (packed archives are still listed).
- Long cover grids only keep visible rows in memory, including after you remove titles or progress, so a huge library does not hitch or leave large empty gaps. (#544)

### Selection and bulk actions

- Checkbox multi-select on gallery tiles (Shift-range), details lists, and classic Bookmark / History (toggle under Other Settings → Classic List Checkboxes).
- Overflow: Copy Path, Bookmark, Remove from Library, Favourites, Mark Read/Unread, Delete Notes, **Remove Progress**, and the rest of the tile menu.
- Shortcut **Delete selected** (default `Delete`) for the current selection (not while typing or in the reader).

### Tags, favourites, notes, metadata

- Tag catalog with colours. The custom colour picker sits beside the tag name when you create or rename a tag, separate from the fixed-colour presets. Several tags per title.
- Star favourites from tiles or details.
- Per-title note and editable metadata overlay. Space works in **Edit metadata** and on the dialog buttons. Typing there, or in the details note, no longer runs window shortcuts such as Home. (#537)
- AniList tracking is stored on the library item in the DB (survives Locate; removed with the item). Tracker rows hydrate on every window boot. Old `anilist_tracking` localStorage is imported once.

---

## Library, scan, and files

- **Library** is the first Settings section: Default Location, extra folders (manga / books / both, depth), Scan now, scan on start, interval (minutes), **Watch**.
- Scan runs in the main process. The title-bar popover shows live status and Cancel. It adds titles to the library only. Continue Reading still fills when you open a title.
- Skip nested library folders, per-root skip regex, and `yomikiru-ignore` / `.yomikiru-ignore` sentinels.
- Attach catalog tags to newly found titles per folder. **Apply to existing** unions tags and confirms when many titles are affected.
- One-shot image folders stay as that folder.
- Moving a series and opening or locating the new path can update or merge the old row.
- A folder or file and a symlink or junction to the same place stay **one catalogue row**. Scan, watch, Settings folder add, and first-time reader add store the resolved path. Duplicate rows from the same disk object merge when that path is added or on the next library scan (progress and tags follow the relocate merge rules). Show in File Explorer uses the resolved location. Pointing a symlink at a different place does not keep progress on the alias.
- **Clear unused progress** and **Remove Progress** without deleting the catalogue entry.
- EPUB scan, title, author, and cover are improved. Covers stream from archives without a full extract.
- One bundled 7-Zip backend for CBZ/ZIP, CBR/RAR, and CB7/7z (no system `unrar`). The same backend extracts for the reader, language packs, and portable-update ZIPs.
- Automatic library DB snapshots under `userData/backups/`. Settings: enable, interval, keep N newest, Backup Now, list, Restore, Import & Restore. Always snapshot before a schema migrate.
- Extracted archives, EPUBs, and rendered PDFs use a temp folder inside the app data directory by default, so a system temp cleanup does not delete that cache. A saved path that is still the system temp directory is replaced with that folder. Any other folder you set is kept.
- Manga pages can be JPEG XL (`.jxl`) in a folder or inside an archive. The reader turns on Chromium's JPEG XL decoder at startup. Generated library thumbnails still go through Sharp, whose prebuilt binaries do not decode JPEG XL, so a chapter whose cover source is only `.jxl` does not get an automatic thumbnail. (#375)
- App UI is driven by catalogs. Settings → Language installs community packs (zip). Missing keys fall back to English. Language settings explain how to make your own pack, with a link to Usage (export the default zip, extract it, edit `pack.json` and the other JSON files, zip again, install, then select the pack).
- Privacy policy, linked from the README and About.

### Covers

- Library thumbnails are WebP on the main process (`covers/<id>.webp`). High-bitdepth AVIF sources that used to fail can be materialized.
- Select Cover / Make Cover / **Reset Cover**. Make Cover targets the one-shot library row. Reset Cover restores folder, EPUB, or packed defaults.
- AniList tracker covers are saved as `covers/tracker-<id>.webp` when a title is tracked or its snapshot is refreshed (details bar, progress sync). That file is separate from the library thumbnail and includes a solid-color image when AniList has no raster cover. Gallery tiles and details use the local file (or the library cover if it is not there yet). AniList search and the AniList editor still show the remote image.
- Cover pick for save, gallery, and details uses `extraLarge`, then `large`, then `medium`, then a solid color. Search and the AniList editor use `large`, then `medium`, then color. Library and tracker covers encode at a max edge matched to AniList `extraLarge`. Existing files update when you regenerate thumbnails or when a tracker cover is written again.
- Right-click the details cover for **Show cover in File Explorer** (library WebP, tracker WebP, or the user-picked file), above the existing library tile menu.
- After the library-id migration, one window can prompt to **generate gallery thumbnails** once the UI settles (skip anytime; regenerate later in Library settings).
- Settings: clear, regenerate, bulk-import (missing paths skipped and reported).
- Opening the app offline no longer pops AniList login or request error dialogs. Only a rejected token warns. AniList editor cover art stays inside the dialog.

---

## Reader

- Optional **Remember preset per title** (Settings → Reader presets, on by default). Each title can keep its own reader layout, so manga and manhwa can differ. Opening a title restores the last preset used there. In-reader changes stay on that title. Select in Reader presets remains the default for titles that do not have one yet.
- **Continuous chapters (experimental)** is a book reader preset option, separate from the manga presets. Chapters stay in one virtualized scroll with a light break between them, without rebuilding the reader at chapter boundaries. Progress percent is through the whole book (from file sizes), shows two decimal places, and the TopBar input is wider while it is on. Reopening restores the saved chapter and paragraph. Chapter jumps, percentage seeking, and layout restoration share cancellable navigation. Scroll-position capture is viewport-bounded and throttled. Find stays in the current chapter (whole-book search later). AniList auto-progress is off while this is on. The settings row is a short hint plus **More Info**, which jumps to Usage. The native scrollbar can still look wrong because most chapters are not measured.
- Next or previous manga chapter (shortcut or side-list buttons) opens at the first page. Continue and bookmarks still restore their stored page. Opening at a stored page no longer flashes the first page while images finish loading. (#536)
- Prev/next no longer opens a missing folder when the sibling was renamed or deleted (including before auto-refresh). It rescans the series and opens the chapter that now sits in that place. A second next/prev after a chapter switch still follows the new link while content is loading.
- Sidelist search no longer traps prev/next/random in the query unless the filter pin is on. Unpinned search only filters the displayed list and clears when you change chapter. (#507)
- Unpinned side list no longer covers the left edge of pages when zen mode is off. The reading area is inset by the closed-list peek. Zen mode and a pinned list are unchanged. (#551)
- Entering or leaving zen mode keeps the same place on a tall page (fit-to-width pages change height when the column width changes). Most noticeable on long manhwa strips.
- You can permanently delete a page, the current chapter, or chapters already marked read. Delete page is on the image right-click menu and on Delete. In two-page mode Delete removes both pages in the current row. Delete chapter is on the reader menu, each side-list chapter, and Shift+Delete. Deleting the open chapter opens the next chapter. Delete read chapters is only on the side-list chapter menu and keeps the open chapter. Page delete works for image folders. An archive or PDF can be deleted only as a whole chapter. Bookmarks on a removed page move with the pages that follow. (#554)
- Side-list bookmark and note rows keep their full height (bookmarks were clipped to the compact chapter-row size; notes were short of the quote-and-date layout).
- Book side-list auto-focus and locate scroll to the current chapter when it is nested in the table of contents. A link that points at the chapter file with a fragment still matches that row, including a fragment that contains a slash. A parent that repeats the same file link no longer hides the nested row.
- Long lists only mount visible rows: manga and EPUB side lists (Content, Bookmarks, Notes), gallery chapter lists, classic Location / History / Bookmarks, and AniList search results. Auto-focus and locate still jump to the current chapter. The old “too many chapters” hide-Content warning is gone.
- Opening an EPUB no longer fails with `ENOTEMPTY` when a second open deletes the extract folder while 7-Zip is still writing. Overlapping unzips of the same folder share one extract. Incomplete leftover extracts are extracted again instead of reused.

---

## Settings and shortcuts

- **Settings search.** **Focus search** (`/` / `Ctrl+Shift+F`). Clear (**x**) on search fields that have text.
- The Shortcuts tab is driven by the command catalog. Commands sit in grouped sections with compact key chips (remove is always visible), an Add control that records after you click it, and Reset per command, including window actions that used to be fixed. The same key can be assigned to more than one command. The row notes a same-screen competition or a key reused on another screen, and does not block the assignment. Changes apply immediately without a restart. Bindings use physical keyboard codes. Settings, Usage, and the application menu show those chords. Ctrl+scroll reader width stays a pointer gesture. Enter, Shift+Enter, and Space on chrome (submit, click, toggle) are not Shortcuts commands. List Select stays Enter.
- Copying a path, theme, or preset waits until the clipboard write finishes before the control shows Copied.

---

## Fixes worth calling out

- Reader scroll stutter / lag after presets (#523), plus a follow-up so progress still saves without bringing the stutter back.
- Re-opening a library title no longer wipes author, custom cover, or progress.
- Updater no longer re-alerts announcements from a bad GitHub error body.
- EPUB scan accepts more real-world OPF/NCX. Temp cover files are released on Windows.
- Gallery bookmarks open correctly. Language select boots cleanly. Side-list focus scroll is fixed.
- Popovers trap Tab focus. Search Focus works when a button or select is focused.
- AniList search rows use their full height again (covers and titles were clipped into the row above).
- Closing gallery details no longer flashes a cover across the window. The cover grid stays laid out while details are open, and a hidden width of 0 is not treated as a one-column gallery.
