> [!Note]
> **Community Discord Server**: A Discord server for Yomikiru and Collection Extension is now open. Join for discussions, usage help, feedback, and updates. See [Discussion #495](https://github.com/mienaiyami/yomikiru/discussions/495).

> [!Note]
> To get this beta and later ones: in Settings, switch the update channel to **beta**, then **Check for update**. You do not need to download builds from GitHub by hand.
<!-- 
> [!Important]
> **Known Issue with Updates (July 2025)**: Due to recent Windows security policy changes, some users may experience crashes during the auto-update process. If updates fail, please:
>
> 1. Download the latest version manually from the releases page
> 2. Install it over your existing installation
>
> Issue is only present to users using "Setup" version.
> For more information, see [Announcement #451](https://github.com/mienaiyami/yomikiru/discussions/451) -->

# 2.25.0-beta

### 2.25.0-beta.11

Electron 44 and reader/gallery follow-ups since beta.7: 64-bit builds on Windows 10 or later, high-bitdepth AVIF covers, catalog shortcuts, virtualized long lists, and fixes for zen scroll, EPUB extract races, and gallery layout.

- feat: The desktop shell is Electron 44 (Chromium 152). Builds are 64-bit only and need Windows 10 or later (macOS 13 or later if you build a Mac package). The 32-bit setup and the 32-bit portable zip are no longer real 32-bit builds. The 64-bit portable zip and the 64-bit setup stay, and copies of those files are also uploaded under the old 32-bit filenames so an existing 32-bit install can update on 64-bit Windows. Those extra files are release assets only; the release-notes download table does not list them. Windows 7, 8, and 8.1 are not supported. The last stable that still supports them is 2.24.0, and the last beta is 2.25.0-beta.7. Library covers can decode high-bitdepth AVIF images that previously failed to materialize. Dragging a folder or file onto the window still opens it. Copying a path, theme, or preset still waits until the clipboard write finishes before the control shows Copied. `better-sqlite3` is 12. Its transactions must stay synchronous, so library writes that used to `await` inside a transaction now run synchronously.
- feat: The Shortcuts settings tab is driven by the command catalog. Commands sit in grouped Settings-style sections with compact key chips (remove is always visible), an Add control that records after you click it, and Reset per command — including window actions that used to be fixed. You can assign the same key to more than one command; the row notes a same-screen competition or a key reused on another screen, and does not block the assignment. Changes apply immediately without a restart. Bindings use physical keyboard codes; Settings, Usage, and the application menu show those chords (the menu does not register a second accelerator). Ctrl+scroll reader width stays a pointer gesture. Enter, Shift+Enter, and Space on chrome (submit, click, toggle) are not Shortcuts commands. List Select stays Enter.
- feat: Long lists only keep visible rows in memory, so opening a huge library, a manga with hundreds of chapters, or a long EPUB table of contents stays smooth instead of hitching while the whole list mounts. That covers gallery covers, classic Location / History / Bookmarks, manga and EPUB side lists (Content, Bookmarks, Notes), gallery manga chapter lists, and AniList search results. Auto-focus and locate still jump to the current chapter; the old "too many chapters" hide-Content warning is gone. Also fixes large empty gaps between gallery cover rows after you remove titles or progress. (also fixes #544)
- feat: Gallery home section tabs (and the matching details list tabs / type filter) show a hover tooltip with the section name when the window is narrow enough that the button label is hidden. (#539)
- feat: Language settings explain that you can make your own translation pack, with a detailed link to Usage steps (export the default zip, extract it, edit `pack.json` and the other JSON files in a text editor, zip again, install, then select the pack).
- feat: Book reader **Continuous chapters** settings show a short hint plus **More Info** that jumps to the existing Usage section instead of a long in-panel description.
- fix: AniList search results use the full result-row height again (covers and titles were clipped into the row above). Closing gallery details no longer flashes a cover across the window: the cover grid stays laid out while details are open, and a hidden width of 0 is not treated as a one-column gallery.
- fix: Opening an EPUB no longer fails with `ENOTEMPTY` when a second open deletes the extract folder while 7-Zip is still writing. The destination wipe retries that Windows race, overlapping unzips of the same folder share one extract, and invalid locators with apostrophes in ids no longer throw from `querySelector`. Incomplete leftover extracts (`SOURCE` present but `container.xml` missing) are extracted again instead of reused.
- fix: Entering or leaving zen mode keeps the same place on a tall page. The reading column changes width with the side-list peek, scrollbar, and fullscreen, so fit-to-width pages change height; the view stays on the same point in the page instead of sliding ahead. This was most noticeable on long manhwa strips.

### 2.25.0-beta.7

Gallery and reader follow-ups since beta.6: details layout options, tag/tracking filters, cycle shortcuts, per-title reader presets, experimental EPUB continuous chapters, and library path alias hardening.

- feat: Gallery details can switch between the existing resizable header and a resizable metadata sidebar. The selected view, header height, and sidebar width are remembered across manga and books; horizontal view keeps local progress and tags beside a portrait cover while notes and tracker metadata flow below.
- feat: Gallery section tabs and type filters can now be cycled with rebindable shortcut pairs, and the same first-bar pair switches manga or book details tabs. The shortcuts wrap, work while the related search field is focused, and are added with defaults without changing existing bindings.
- feat: EPUB **Continuous chapters (experimental)** is an independent book reader preset option. The current renderer keeps chapters in one virtualized scroll with a light break between them, avoiding a full reader rebuild at chapter boundaries; progress percent is through the whole book (from file sizes), shows two decimal places, and gets a wider TopBar input while enabled. Per-title preset memory can retain title-specific behavior. Reopening restores the saved chapter and paragraph; chapter jumps, percentage seeking, and layout restoration share cancellable navigation. Scroll-position capture is viewport-bounded and throttled. Find stays in the current chapter (whole-book search later). AniList auto-progress is off while enabled. The old Settings **EPUB: Load By Chapter** toggle is gone (it did not actually load the whole book). The native scrollbar can still look wrong because most chapters are not measured.
- feat: Optional **Remember preset per title** (Settings -> Reader presets, on by default). Each title can keep its own reader layout (so manga and manhwa can differ). Opening a title restores the last preset used there; in-reader changes stay on that title. Select in Reader presets remains the default for titles that do not have one yet.
- feat: Gallery tag filter is a three-state control per tag (off, include, exclude) in one list. Include still means any of those tags; exclude hides titles that have any of the excluded tags (untagged titles stay visible when you only exclude). The closed control shows the tag name when only one is included or excluded, otherwise `+n -m`, plus the same colour-mark grid (circles for include, triangles for exclude). Saved as signed ids in `galleryTagFilterIds` so older include-only lists keep working.
- feat: When AniList is connected, the gallery toolbar now has a remembered three-state tracking filter for all titles, tracked titles, and untracked titles. It stays inactive while signed out so a hidden filter never narrows the gallery.
- fix: Gallery search now stays active while switching between Continue, Library, Bookmarks, and Favourites.
- fix: The custom tag colour picker now sits beside the tag name when creating or renaming a tag, separate from the fixed-colour preset row.
- fix: Unpinned reader side list no longer covers the left edge of pages when zen mode is off. The reading area is inset by the closed-list peek (the resize strip); zen mode and a pinned list are unchanged. (#551)
- fix: A library folder (or file) and a symlink/junction to the same place stay one catalogue row. Scan, watch, Settings folder add, and first-time reader add store the resolved path. Duplicate rows from the same disk object merge when that path is added or on the next library scan (progress and tags follow the relocate merge rules). Show in File Explorer uses the resolved location. Pointing a symlink at a different place does not keep progress on the alias.
- docs: Privacy policy page, linked from README and About.
- **dev**: Library scan unit tests stub DB change pings without loading the full IPC database module.

### 2.25.0-beta.6

Follow-up to the gallery beta: AniList covers are stored on disk, manga next/prev and sidelist search work again after rename/delete, and a few editor/reader glitches from beta.4 are fixed.

- feat: AniList tracker covers are saved as `covers/tracker-<id>.webp` when a title is tracked or its snapshot is refreshed (details bar, progress sync). That file is separate from the library thumbnail and includes a solid-color image when AniList has no raster cover. Gallery tiles and details always use the local file (or the library cover if it is not there yet); AniList search and the AniList editor still show the remote image.
- feat: AniList cover pick for save, gallery, and details uses `extraLarge`, then `large`, then `medium`, then a solid color. Search and the AniList editor use `large`, then `medium`, then color.
- feat: Gallery details cover right-click adds **Show cover in File Explorer** for the displayed image file (library WebP, tracker WebP, or user-picked cover), above the existing library tile menu.
- fix: Opening the app offline no longer pops AniList login/request error dialogs; only a rejected token warns.
- fix: Materialized library and tracker covers encode at a max edge matched to AniList `extraLarge` (with WebP quality for on-screen details). Existing files update when you regenerate thumbnails or when a tracker cover is written again.
- fix: AniList editor cover art stays inside the dialog (contained poster with a max height).
- fix: Reader Presets settings use memoized preset selectors so the panel no longer triggers unstable `useSelector` warnings or extra re-renders.
- fix: Space works in gallery **Edit metadata** fields and on the dialog buttons. Typing in those fields or the details item note no longer runs window shortcuts such as Home. (#537)
- fix: Next/previous manga chapter (shortcut or side-list buttons) opens at the first page instead of keeping the previous chapter's page. Continue and bookmarks still restore their stored page. (#536)
- fix: Opening a manga chapter at a stored page (Continue, bookmark) no longer flashes the first page while images finish loading.
- fix: Manga prev/next no longer opens a missing folder when the sibling was renamed or deleted (including before auto-refresh). Next/prev rescans the series and opens the chapter that now sits in that place, and a second next/prev after a chapter switch still follows the new link while content is loading.
- fix: Manga sidelist search no longer traps prev/next/random in the query unless the filter pin is on. Unpinned search only filters the displayed list and clears when you change chapter, so rename/delete refresh and chapter nav follow the full list again. (#507)
- **dev**: Document the Sharp 10-bit AVIF cover decode blocker and the intended Electron/Sharp upgrade path (`docs/electron-upgrade-sharp-avif-cover-blocker.md`).
- **dev**: `pnpm release` runs unit tests and only tags/pushes if they pass.

### 2.25.0-beta.4

Gallery mode has been on my mind for a long time. I started working on it almost over a year ago, but until the last couple of months I only really got about ~10% of the way there; life and other priorities kept getting in the way. The last two months I finally pushed hard to get it into a shape you can actually try.

Huge thanks for waiting and for the support along the way. This build is still a beta: there will be bugs, rough edges, and some things that are missing on purpose or just not finished yet. If something feels wrong, broken, or incomplete, please say so, feedback and feature requests help a lot before this goes stable.

Join Discord for chat and quicker feedback: <https://discord.gg/UHwBN9g22e> · [Discussion #495](https://github.com/mienaiyami/yomikiru/discussions/495)

---

## Before you update

### Breaking / behaviour changes

1. **Default Location moved**  
   It now lives under Library settings. On first launch after upgrade it is reset once. The app will ask you to pick your Home library folder, or you can use the system home folder until you change it later.

2. **Books are EPUB-only**  
   Standalone `.html`, `.xhtml`, and `.txt` are no longer opened, listed as chapters, or registered in Windows “Open with”. Old library rows for those files stay until you remove them. The Style Settings text-file badge toggle is gone.

3. **“Focus sidelist search” shortcut is gone**  
   Replaced by **Focus search** (default `/` and `Ctrl+Shift+F`) for the search field on the current page (home, gallery, reader sidelist, Settings, AniList, etc.).

4. **Library scan does not invent reading progress**  
   Scan catalogues titles only. Continue Reading stays empty until you open a title.

5. **Database schema updates**  
   First launch may migrate the library DB. The app snapshots `data.db` into `backups/` before that (even if auto-backup is off). Prefer quitting and restoring if a migrate fails.

### Still there

- Classic home list still works — Gallery is a toggle, not a forced replacement.
- AniList login token stays in localStorage (not inside DB backups).
- Existing library rows, progress, bookmarks, and notes are kept across the upgrade.

### How to get the beta

1. In Settings, switch the update channel to **beta**, then use **Check for update**. You do not need to download this build from GitHub by hand.
2. Stay on the beta channel so later beta builds are offered the same way.
3. Report problems with the **beta** label so fixes can land before stable.

---

## Highlights

- **Gallery home** — cover grid with Continue / Library / Bookmarks / Favourites, details pages, multi-select, tags, favourites, notes, and metadata.
- **Real library scanning** — extra folders, scan on start / interval, live disk watch, skip rules, folder tags, progress in the title bar.
- **Bundled 7-Zip** — CBZ/ZIP, CBR/RAR, CB7/7z without installing system `unrar`.
- **Library DB backups** — automatic + manual backup/restore in Settings.
- **App language** — English built-in; install community language packs as zip.
- **Settings search** — jump to any setting, shortcut, About, or Usage section.
- **Reader scroll stutter** addressed (#523).

---

## What’s new

### Gallery home (experimental)

Toggle **Classic / Gallery** in the top bar.

- Cover grid with sections: **Continue**, **Library**, **Bookmarks**, **Favourites**.
- Toolbar: search, sort (where it applies), view modes (Cover + Title / Cover Only / Compact / List), grid size.
- Type filter: All / Manga·Webcomic / eBook (EPUB; not PDF).
- Tag filter is multi-select (OR): one tag name, a count, or “No filter” when closed.
- **Details page**: large cover, Continue/Start, favourite, edit title/author/About/genres, note, path copy, Show in File Explorer, chapter/bookmark/note lists.
- AniList **Track** is always on the details page (disabled until you log in; tip when untracked). Tracked titles keep status and get **Open on AniList** above About.
- Edited titles show everywhere; original folder/file name stays muted in parentheses when different.
- When AniList is tracked: releasing status, score, chapter count, and optional AniList cover (switchable back to library cover).
- **Locate on disk** when a folder/EPUB is missing; keep progress and bookmarks.
- Empty image folders hidden in chapter lists (packed archives still listed).

### Selection and bulk actions

- Checkbox multi-select on gallery tiles (Shift-range), details lists, and classic Bookmark / History (toggle under Other Settings → Classic List Checkboxes).
- Overflow: Copy Path, Bookmark, Remove from Library, Favourites, Mark Read/Unread, Delete Notes, **Remove Progress**, etc.
- Shortcut **Delete selected** (default `Delete`) for the current selection (not while typing or in the reader).

### Library tags, favourites, notes, metadata

- Tag catalog with colours; several tags per title; filter the grid by one or more tags (OR).
- Star favourites from tiles or details.
- Per-title note and editable metadata overlay.
- AniList tracking stored on the library item in the DB (survives Locate; removed with the item). Tracker rows hydrate on every window boot. Old `anilist_tracking` localStorage is imported once.

### Library scan and folders

- **Library** is the first Settings section: Default Location, extra folders (manga / books / both, depth), Scan now, scan on start, interval (minutes), **Watch**.
- Scan runs in the main process; title-bar popover shows live status + Cancel.
- Skip nested library folders, per-root skip regex, and `yomikiru-ignore` / `.yomikiru-ignore` sentinels.
- Attach catalog tags to newly found titles per folder; **Apply to existing** (union; confirms when many).
- One-shot image folders stay as that folder.
- Moving a series and opening/locating the new path can update or merge the old row.
- **Clear unused progress** and **Remove Progress** without deleting the catalogue entry.
- EPUB scan/title/author/cover improved; covers stream from archives without full extract.

### Archives (7-Zip)

- One bundled 7-Zip backend for CBZ/ZIP, CBR/RAR, CB7/7z (no system `unrar`).
- Same backend for reader extract, language packs, and portable-update ZIPs.

### Backups

- Automatic library DB snapshots under `userData/backups/`.
- Settings: enable, interval, keep N newest, Backup Now, list + Restore, Import & Restore.
- Always snapshot before a schema migrate.

### Language / i18n

- App UI driven by catalogs; Settings → Language for community packs (zip). Missing keys fall back to English.

### Settings and shortcuts

- **Settings search**; **Focus search** (`/` / `Ctrl+Shift+F`); clear (**x**) on search fields with text.

### Covers

- Library thumbnails as WebP on the main process (`covers/<id>.webp`).
- Select Cover / Make Cover / **Reset Cover**.
- After the library-id migration, one window can prompt to **generate gallery thumbnails** once the UI settles (skip anytime; regenerate later in Library settings).
- Settings: clear, regenerate, bulk-import (missing paths skipped and reported).

---

## Fixes worth calling out

- Reader scroll stutter / lag after presets (#523), plus follow-up so progress still saves without reintroducing stutter.
- Re-opening a library title no longer wipes author, custom cover, or progress.
- Make Cover targets the correct one-shot library row; Reset Cover restores folder/EPUB/packed defaults.
- Updater no longer re-alerts announcements from bad GitHub error bodies.
- Packed chapters stay under their parent series.
- AniList adult-content preference stays in sync; Track stays visible and trackers stay hydrated across remounts.
- EPUB scan accepts more real-world OPF/NCX; temp cover files released on Windows.
- Gallery bookmarks open correctly; language select boots cleanly; side-list focus scroll fixed.
- Popovers trap Tab focus; search Focus works when a button/select is focused.

### 2.24.0

<https://github.com/mienaiyami/yomikiru/releases/tag/v2.24.0>
