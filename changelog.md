> [!Note]
> **Community Discord Server**: A Discord server for Yomikiru and Collection Extension is now open. Join for discussions, usage help, feedback, and updates. See [Discussion #495](https://github.com/mienaiyami/yomikiru/discussions/495).
>
<!-- 
> [!Note]
> To keep getting beta updates, check the beta update channel in settings after downloading the beta version.
>
> **Please report any issues you encounter with the beta tag so stable version can be released faster.** -->

> [!Important]
> **Known Issue with Updates (July 2025)**: Due to recent Windows security policy changes, some users may experience crashes during the auto-update process. If updates fail, please:
>
> 1. Download the latest version manually from the releases page
> 2. Install it over your existing installation
>
> Issue is only present to users using "Setup" version.
> For more information, see [Announcement #451](https://github.com/mienaiyami/yomikiru/discussions/451)

# unreleased

- feat: Library scan can skip other library folders, skip names with a per-root regex, and skip `yomikiru-ignore` / `.yomikiru-ignore` sentinels (file skips that folder; a folder with that name skips only itself). Default Location and extra folders can attach catalog tags to newly found titles, with Apply to existing for titles already in the library (union; confirms when more than one). The title bar shows live scan progress in a popover instead of a silent icon.

- feat: **Remove Progress** on library item context menus (gallery tiles, details cover, classic History) and the selection overflow menu. Confirms first; last position and chapter read marks are cleared. The library entry, bookmarks, and notes stay, so the title leaves Continue Reading until you open it again. Disabled when the item has no progress.

- feat: **Delete selected items** shortcut (default `Delete`, customizable in Settings → Shortcut Keys) removes the current multi-select: library tiles, classic History / Bookmarks, and details bookmarks or notes (same confirmations as the overflow menu). It does not run while typing, while the reader is open, or on manga chapter lists.

- feat: **Scan now** in Library settings walks nested folders under Default Location. A series is a folder whose direct children are chapter folders or packed/PDF files (same rule as gallery details); grouping folders are not added. EPUB files in the tree are added as books. Scan does not write reading progress, so Continue Reading stays empty until you open a title.

- feat: Library settings can add extra folders (manga, books, or both, default walk depth 2), optionally scan Default Location, **Scan now** across those roots, scan on start, interval scans (minutes; 0 is off), and live **Watch** (debounced; classifies from the changed path upward). Opening a one-shot image folder keeps that folder as the library item. Moving a series or book then opening or locating the new path can update the old row, or merge if a duplicate already exists at the new path. Scan now still locks the window; start, interval, and watch stay in the background with a title-bar status for start/interval. **Clear unused progress** removes leftover unread progress from older add-on-open rows (confirm first; catalogue stays).

- feat: Add Tracking (AniList search) uses the same list shortcuts as other search bars: move through results, Enter to link the focused title, Escape to close. The field still searches AniList remotely (not a local filter).
- feat: before a library schema update, the app copies `data.db` into `backups/` even if automatic backups are off. If that copy fails you can quit or continue without a backup; if the update itself fails you can restore that snapshot or open the backups folder.

- feat: books are EPUB-only. Standalone `.html`, `.xhtml`, and `.txt` files are no longer opened, listed as chapters, or registered in Windows Explorer "Open with". Remove still clears leftover associations from older builds. Existing library rows for those files are kept until you remove them. Manga chapter lists (reader side-list, gallery details, locate-first-chapter) no longer include EPUB files; the Style Settings text-file badge toggle is removed.
- feat: library tags are a catalog you create, then assign to titles (several per item, with a colour). Edit tags from gallery details. Filter the grid by one tag (with the type filter). Names are unique ignoring case; deleting a tag unassigns it.
- feat: gallery details is a cover-and-title page (back on the cover; current chapter beside last-read date, manga page, and chapters-read as read/total; title note beside that block from mid width). Opening the page focuses Continue/Start. Copy Path briefly shows Copied. Click the title note to edit it (Esc or click away saves it on the library item). Hero actions include favourite, edit metadata (title, author, About, genres), Show in File Explorer, and Copy Path. A title you save there shows on gallery tiles, classic History/Bookmarks, search, the reader sidebar, and the window title as the edited name with the original folder/file name muted in parentheses when they differ (window title uses the edited name only); search matches every title layer (edited, tracker, file, library). Reset on Edit metadata asks first, then clears those overlay fields. About and genres appear when a tracker cache or your overlay supplies them. When tracked, releasing status, score, and chapter count from the tracker sit above genres, separated by a divider (not your list status). The metadata section is auto-sized with a rem min and scrolls if taller; drag the divider to resize (quiet grip on the bar; cover scales; can go below that min; one remembered height for manga and books). Cover and title stay in view while About scrolls. When AniList has a cover, details and tiles use it until you switch to Cover: Default (remembered on the item). Manga Content has Locate current chapter (same control as the reader sidelist; scrolls only the chapter list). Missing-from-disk banner sits above the hero. List tabs use the same toolbar chrome as gallery home (no counts on the tabs; sort/refresh left of search on gallery home and details). Directory Up closes details and focuses gallery search, including after returning from the reader (not while Settings or AniList overlays are open, and not while typing in a field). AniList on this page is a compact Track/status control without +/-. Missing-from-disk uses the same error color as other in-app errors.
- feat: **Settings search** — type in the Settings overlay search field to jump to a setting, shortcut, About, or Usage section. Opening Settings focuses that field; use the same **Focus search** shortcut (`/` / `Ctrl+Shift+F`) while Settings is open. Other Settings and Style Settings jump to the individual control. After a jump, keyboard focus moves to a control in that section. Deep-links use stable target ids via `navigateToSetting`.
- feat: **Focus search** shortcut (default `/` and `Ctrl+Shift+F`) moves focus to the main search field on the current page: classic Continue Reading / History (then Bookmarks, then Locations), gallery toolbar or the open details list, manga sidelist, book find-in-page, AniList search, and Settings search while Settings is open. It does not run while typing in an input. The old manga-only **Focus sidelist search** command is removed (the new command uses its own defaults).
- feat: **Library database backups** — automatic snapshots of `data.db` under `userData/backups/` (`data-<unixMs>.db`), with cold-start + hourly / resume due-checks, Settings controls (enable, interval, how many newest to keep, Backup Now, list + Restore, Import & Restore), and restore via pending swap + relaunch before the DB opens. Corrupt restore sources show a dialog and clear pending; probing restores do not prune older originals.
- feat: **App language / translations** — i18next for renderer and Electron main, English catalogs under `src/common/i18n` (common, dialogs, menu, settings, home, reader, anilist, electron, usage), and a **Language** section in General settings after Theme (main setting `languageSourceId`). Menus, trays, settings chrome, home, reader, AniList, shared UI, and context menus use catalogs; Settings → Usage is a React skeleton with structured prose keys in the `usage` namespace (`usage.json`). Install, export, and remove single-locale community packs as zip files under user data; incomplete packs fall back to English.
- feat: AniList tracking is stored on the library item in the database (per title and provider), so Locate on disk keeps the link and removing the item removes the tracker. Existing `anilist_tracking` localStorage entries are imported once (orphans skipped; the original key is kept). The login token stays in localStorage and is not part of database backups. Tracked titles can cache About, genres, chapter count, and score for the details page. Tracker rows live in a generic `trackers` store; AniList keeps token and the open list entry. Helpers are prefixed (`checkAnilistToken`, `searchAnilistMedia`, `getAnilistListEntry`) so later providers do not collide.
- feat: **Gallery home** (experimental) — switch Classic / Gallery from the top bar. Gallery is a cover grid with **Continue** / **Library** / **Bookmarks** / **Favourites** sections, a toolbar (search on every section, sort on Library / Bookmarks / Favourites, Cover + Title / Cover Only / Compact / List, default Compact, grid-size slider), and detail panels for manga (chapters and bookmarks) and books (bookmarks and notes). Continue lists items with progress, newest last-read first (no sort control). Bookmarks lists titles that have at least one bookmark and uses the same sort as Library; opening a tile shows the Bookmarks list in the details panel (play still continues last progress). Right-click a tile or details cover for Continue Reading, Show in File Explorer, copy path, Add to / Remove from Favourites, Remove from Library (files stay on disk), and AniList tracking when connected. Favourites lists titles you have starred from a tile context menu or the details header (search and sort still shown). Selection overflow can add or remove Favourites (removing more than one asks first) and still remove from the library. List view rows are a bit taller, with a leading checkbox and cover aligned to the title. Keyboard focus in the gallery list jumps instantly.
- feat: gallery home has an item type filter (**All** / **Manga/Webcomic** / **eBook**) after the section tabs. Manga/Webcomic covers every image-based series (manga, manhwa, manhua, comics, webtoons); eBook covers EPUB only, not PDF. The choice is remembered across launches and applies to Continue, Library, Bookmarks, and Favourites.
- feat: **Library** is the first Settings section and includes **Default Location** (Locations tab folder), bulk import from that folder, and thumbnail clear/regenerate.
- feat: long library import and recursive EPUB scan lock the whole window (mouse and keyboard) until they finish.
- feat: checkbox multi-select on gallery tiles (Shift-click for a range), on manga/book details lists (chapters, bookmarks, notes), and on classic Bookmark / History rows by default (**Other Settings → Classic List Checkboxes** to turn off). The selection toolbar offers Select All, Invert (gallery/details), and an overflow menu for bulk Copy Path, Bookmark, Remove, Mark as Read/Unread, Delete Notes, and related actions. Gallery/details support `Ctrl+A` / `Cmd+A` and `Esc` (not while typing in search).
- feat: library cover thumbnails are generated on the main process as WebP under user data `covers/<library id>.webp`. Gallery prefers that cache; **Select Cover** still stores a custom absolute path when you pick one. Library settings can clear, regenerate (missing files and folders are skipped and reported in one warning), or bulk-import thumbnails.
- feat: when a library folder or EPUB is missing on disk, gallery details and classic History/Bookmark offer **Locate on disk** (re-link the path and keep progress/bookmarks; confirm if the chosen name does not match) or remove the entry. Gallery manga chapter lists hide empty image folders (packed archives still listed).
- feat: search fields show a clear (**x**) button inside the field while they contain text; it can be reached with `Tab`.
- feat: symbolic links to directories are treated as directories in Locations / home location, so linked folders can be browsed and opened.
- fix: re-opening a title already in the library no longer wipes a stored author, custom cover, or reading progress (conflict path updates title only; progress insert does not replace an existing row).
- fix: renderer HTTP requests no longer set User-Agent, which Chromium refused as an unsafe header.
- fix: popovers trap keyboard focus while open (Tab stays in the panel).
- fix: updater version and announcement checks ignore non-ok GitHub responses instead of parsing error HTML/JSON as content, which was re-showing the same announcements many times a day. An empty ok announcement body no longer wipes the local seen list.
- fix: stop reader scroll stutter caused by unstable Redux selectors and progress updates after reader presets (#523).
- fix: gallery AniList bar no longer refetches the list entry every time the tracker cache is written (details was looping). Tracking fills author from AniList staff when overlays omit it. About keeps line breaks and emphasis from HTML and scrolls with the metadata block. Genres sit above About; catalog tags sit above the item note. Edit metadata notes that AniList tracking can fill those fields.
- fix: AniList Track/status no longer shows Network Error before the list-entry fetch runs (or for another title's session entry). After a real miss, the same message is a button; tooltip Retry runs the fetch again.
- dev: gallery details and reader auto-progress persist tracker cache through `selectTracker` / `updateTrackerSnapshot`; AniList bar, search, and edit still use AniList-named wrappers.
- dev: AniList helpers are module functions (`initAnilist` at startup) instead of a static class; tracker rows and metadata overlays live in SQLite (`item_trackers`, `library_item_metadata`, plus `favouritedAt` / `note` / `extra` on `library_items`).
- dev: shared HTTP client (`src/common/http`) using axios for Electron main and the renderer; updater and AniList no longer use fetch / electron-fetch.
- dev: Vitest/RTL unit and temp-SQLite db test harness, Playwright Electron smoke (app opens to home), and CI coverage job.
- dev: `pnpm demo:setup` fetches a gitignored local sample library for gallery/format testing.
- dev: architecture, library, settings, and reader feature documentation.

# 2.24.0

### 2.23.2-beta.10

- feat: tray Hide all action and single-window tray click toggle (#514). Hide every window from the tray menu; when only one window exists, left-clicking the tray icon toggles that window's visibility.
- feat: book reader option to override EPUB-authored colors (#515). When enabled, your font, link, page, and content background colors can override styles from the book's CSS.
- feat: book reader content frame settings (#399). Separate content background, inline padding, and border from the page background; wallpaper padding applies to the content area.
- feat: structured, scoped logging for main process, preload, and renderer so log files are easier to follow.
- fix: updater download window handling and Linux update installation (clearer errors, unified sudo install path, smoother install-on-quit flow).
- dev: renderer logging uses `createRendererLogger` from `@utils/logger` only; direct `window.logger` use is removed from renderer code.

### 2.23.2-beta.9

- fix: repair reader presets JSON when keys are missing or invalid instead of replacing entire presets. This fixes the issue where all presets were invalidated just because of one invalid key. Now user manga/book presets cannot be deleted; reset defaults restores bundled presets and recreates User from current reader settings.
- fix: multi-window sync for settings, theme, reader presets, and shortcuts. After saves, other windows refresh with debounced JSON reads and retries instead of stale or failed loads.
- fix: environment variable setup in GitHub Actions for releases for detailed app info.

### 2.23.2-beta.8

- feat: add minimize to tray option (#489). When enabled, minimizing hides window to tray. Tray menu lists all windows; left-click restores or focuses, right-click shows window list and Exit.
- feat: add focus sidelist search keybind (ctrl+shift+f) and random chapter shortcut (r) (#507). Random chapter biases away from recently opened chapters; full shuffle mode (session-only) shuffles list once with prev/next following shuffled order.
- feat: add sidelist search persistence and prev/next navigation improvements (#507). "Fix search" toggle (session-only) keeps filter across chapter navigation; prev/next follows filtered list when active.
- feat: add reset button for color filter section in reader settings (#506).
- feat: add autosave toggle for reader presets. When enabled, changes to reader settings (manga and book) are saved automatically.
- feat: replace InputCheckboxColor with InputColor for book background layer settings to avoid confusion.
- fix: detailed about app info not loading.
- fix: arch linux build and release creation.

### 2.23.2-beta.6

- feat: add reader settings presets for manga and book (#281). Switch between reading modes (e.g. 2-page LTR manga vs vertical-scroll manhwa). Supports export/import, save from clipboard, keybinds to cycle/select presets (alt+1-5, alt+period/comma), and reorder presets via up/down buttons.
- feat: add reading background settings for book (EPUB) reader (#399). Wallpaper image with dim, brightness, contrast, layer overlay, and padding. Background layers stay fixed when zooming text.
- feat: add manual chapter tracking for book (EPUB) via Anilist (#379). Search manga and novels, edit progress, and auto-update based on chapter.
- feat: support mouse buttons 4 and 5 in key bindings (#393). Default bindings: mouse 4 for previous page, mouse 5 for next page.
- feat: add optional single-instance behavior via Use Existing Window (#490). When enabled, second launch focuses the existing window and opens files in it; when disabled, opens in a new window. Toggle in General Settings (all platforms).
- feat(settings): add Detailed Info dialog to About. Shows build commit, build date, build type, and OS release.
- fix: correct CSS URL handling and body/html selector scoping in book (EPUB) reader (#488). Fixes url() in `@font-face` and proper mapping of body/html selectors to the content container.
- fix: arch linux build entry in release markdown.

### 2.23.2-beta (earlier builds)

- feat: add arch linux support for auto-updates.
- fix: chapter list not refreshing after mark read/unread (#486) (#500) by `@jaathavan18`

### 2.23.1

<https://github.com/mienaiyami/yomikiru/releases/tag/v2.23.1>
