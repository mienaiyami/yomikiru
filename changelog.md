> [!Note]
> **Community Discord Server**: A Discord server for Yomikiru and Collection Extension is now open. Join for discussions, usage help, feedback, and updates. See [Discussion #495](https://github.com/mienaiyami/yomikiru/discussions/495).

> [!Note]
> To get this beta and later ones: in Settings, switch the update channel to **beta**, then **Check for update**. You do not need to download builds from GitHub by hand.

> [!Important]
> **Known Issue with Updates (July 2025)**: Due to recent Windows security policy changes, some users may experience crashes during the auto-update process. If updates fail, please:
>
> 1. Download the latest version manually from the releases page
> 2. Install it over your existing installation
>
> Issue is only present to users using "Setup" version.
> For more information, see [Announcement #451](https://github.com/mienaiyami/yomikiru/discussions/451)

# unreleased

- fix: Reader Presets settings use memoized preset selectors so the panel no longer triggers unstable `useSelector` warnings or extra re-renders.
- feat: AniList tracker covers are saved as `covers/tracker-<id>.webp` when a title is tracked or its snapshot is refreshed (details bar, progress sync). That file is separate from the library thumbnail and includes a solid-color image when AniList has no raster cover. Gallery tiles and details always use the local file (or the library cover if it is not there yet); AniList search and the AniList editor still show the remote image.
- feat: AniList cover pick prefers extraLarge, then large, then medium, then a solid color when the API returns no image URL.
- fix: Opening the app offline no longer pops AniList login/request error dialogs; only a rejected token warns.

# 2.25.0-beta

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
