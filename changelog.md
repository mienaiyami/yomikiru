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

# 2.24.1 (unreleased)

- feat: **Gallery home** (experimental) — switch Classic / Gallery from the top bar. Gallery is a cover grid with **Continue** / **Library** / **Favourites** sections, a toolbar (search, sort, Cover + Title / Cover Only / Compact / List, grid-size slider), and detail panels for manga (chapters and bookmarks) and books (bookmarks and notes). Right-click a tile or details cover for Continue Reading, Show in File Explorer, copy path, Remove from Library (files stay on disk), and AniList tracking when connected. Favourites is reserved for a future feature.
- feat: gallery home has an item type filter (**All** / **Manga/Webcomic** / **eBook**) after the section tabs. Manga/Webcomic covers every image-based series (manga, manhwa, manhua, comics, webtoons); eBook covers EPUB only, not PDF. The choice is remembered across launches and applies to Continue, Library, and Favourites.
- feat: checkbox multi-select on gallery tiles (Shift-click for a range), on manga/book details lists (chapters, bookmarks, notes), and optionally on classic Bookmark / History rows (**Other Settings → Classic List Checkboxes**). The selection toolbar offers Select All, Invert (gallery/details), and an overflow menu for bulk Copy Path, Bookmark, Remove, Mark as Read/Unread, Delete Notes, and related actions. Gallery/details support `Ctrl+A` / `Cmd+A` and `Esc` (not while typing in search).
- feat: library cover thumbnails are generated on the main process as WebP under user data `covers/<library id>.webp`. Gallery prefers that cache; **Select Cover** still stores a custom absolute path when you pick one. Library settings can clear, regenerate, or bulk-import thumbnails.
- feat: when a library folder or EPUB is missing on disk, gallery details and classic History/Bookmark offer **Locate on disk** (re-link the path and keep progress/bookmarks; confirm if the chosen name does not match) or remove the entry. Gallery manga chapter lists hide empty image folders (packed archives still listed).
- feat: search fields show a clear (**x**) button inside the field while they contain text; it can be reached with `Tab`.
- feat: symbolic links to directories are treated as directories in Locations / home location, so linked folders can be browsed and opened.
- fix: stop reader scroll stutter caused by unstable Redux selectors and progress updates after reader presets (#523).
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
