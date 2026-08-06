# Reader scroll performance (#523)

Standalone notes for [GitHub issue #523](https://github.com/mienaiyami/yomikiru/issues/523) (scroll lag / stutter after recent versions). Enough to understand, verify, and continue work without prior chat context.

## Symptom

- Keyboard / mouse scrolling in the manga and EPUB readers feels laggy or jerky.
- Chapter open can feel slower.
- Reporter: **last good** build `v2.23.2-beta.5`; **bad** from `v2.23.2-beta.6` through `v2.24.0`.
- With DevTools open on bad builds: Redux selector stability warnings on launch and again when opening a comic/EPUB. Those warnings were absent on `beta.5`.

Not caused by DB writes on every scroll. Manga/EPUB progress is persisted on chapter open/close (and similar), not from the scroll handler.

## Root cause

Regression landed with **reader settings presets** in `v2.23.2-beta.6` (commit `7b948c2` and related).

### Unstable Redux selectors (primary)

`useAppSelector` uses reference equality. These selectors returned a **new object/array every call** even when data was unchanged:

| Selector / pattern | File | Effect |
| --- | --- | --- |
| `getShortcutsMapped` via `Object.fromEntries(...)` | `src/renderer/store/shortcuts.ts` | New object every time. Settings panels subscribed without `shallowEqual` (unlike older call sites). |
| `presets.filter(p => p.type === type)` inside `useAppSelector` | `src/renderer/features/reader/components/ReaderPresetSection.tsx` | New array every time ("Selector unknown" in DevTools). |

Scroll updates the current page (or EPUB percent) in Redux. That notifies subscribers. Unstable selectors made **ReaderSettings / EPubReaderSettings / ReaderPresetSection** re-render on every page tick even though shortcuts and preset lists did not change. DevTools warnings added more cost when the console was open.

### Amplifiers (not the beta.5 -> beta.6 cutover alone)

1. Manga `Reader` selected the whole manga reader slice (`getReaderMangaState`). Updating `content.progress.currentPage` produced a new slice reference and re-reconciled the image tree.
2. EPUB `onScroll` always called `setBookProgress` and `makeScrollPos()` (Redux position update), so every wheel tick could re-render.
3. Saving `readerPresets.json` broadcast `fs:fileChanged` to **all** windows including the saver. Refresh re-parsed and, if Zod normalized, **saved again** -> parse/save loops and slower chapter open.

## What was fixed

### 1. Memoized selectors

- `getShortcutsMapped` -> `createSelector` in `src/renderer/store/shortcuts.ts`.
- `getMangaPresets`, `getBookPresets`, `getActiveMangaPresetName`, `getActiveBookPresetName` -> `createSelector` in `src/renderer/store/readerPresets.ts`.
- Manga/book preset UI are separate components (`MangaReaderPresetSection` / `BookReaderPresetSection`), each subscribed to one typed selector (avoids `Manga[] | Book[]` union issues).
- Settings panels use the active-preset-name selectors instead of inline `.find`.

### 2. Manga page updates

File: `src/renderer/features/reader/manga/Reader.tsx`

- `changePageNumber` only calls `setCurrentPageNumber` / `setCurrentImageRow` when the value actually changed (refs avoid stale closures).
- Redux `updateReaderMangaCurrentPage` still runs from a `useEffect` on `currentPageNumber`, so it only fires on real page changes.
- Component selects **primitives** (link, open page, chapter name, total pages, etc.) instead of the whole reader slice, so a page tick does not force the image list to depend on a new `state.reader` object for unrelated fields.

**Not done for manga:** full "light-C" (scroll only writes refs; flush React only when displayed page changes). Current approach is guard + narrow selectors. See Remaining work.

### 3. EPUB progress (light-C)

File: `src/renderer/features/reader/epub/EPubReader.tsx`

- Scroll always updates the progress `<input>` via `bookProgressRef`.
- React `bookProgress` state and `makeScrollPos()` (Redux chapter position) run only when the **integer percent** changes (`flushedBookProgressRef`).
- Chapter change resets the flush ref and percent to 0.
- Bookmark UI calls `makeScrollPos` directly (fresh CSS path).
- Before close/save, `App.closeReader` calls `window.app.flushEpubScrollPos` (registered by `EPubReader`) so Redux position is current even if percent did not change since the last flush.

### 4. Preset file sync

- Main: `src/electron/ipc/fs.ts` - on `fs:saveFile`, do **not** send `fs:fileChanged` to the saving window (`sourceWindowId`).
- Renderer: `src/renderer/App.tsx` - ignore events where `sourceWindowId === currentWindow.id()` (belt and suspenders).
- Preload: `src/electron/preload.ts` - expose `electron.currentWindow.id()`.
- `refreshReaderPresets` no longer writes the file when parse only normalizes. Startup load may still persist a one-time normalize. Intentional saves (autosave / user actions) still write.

## How to verify

1. Build/run current tree; open DevTools.
2. Open a manga chapter and an EPUB.
3. Confirm **no** warnings like:
   - `Selector getShortcutsMapped returned a different result when called with the same parameters`
   - `Selector unknown returned a different result...`
4. Scroll with wheel and keyboard; compare feel to `v2.23.2-beta.5` if available.
5. Optional: two windows, change a preset in one; the other should refresh; the saver should not re-parse in a loop.

Suggested check: `pnpm check`

## Remaining work

Each item is independent; pick by remaining user pain.

### A. Manga light-C alignment

EPUB flushes React only when displayed percent changes. Manga still invokes `changePageNumber` on every scroll event and early-returns inside.

To align:

1. On scroll, write candidate page/row into refs only.
2. Flush `setCurrentPageNumber` / `setCurrentImageRow` / Redux when displayed page or row changes, and on chapter load / unmount.
3. Keep primitive selectors from the shipped fix.

Do this if scroll still stutters after the guard.

### B. Narrow EPUB Redux subscriptions

`EPubReader` still selects broad `store.reader` and `getReaderBook`. When `makeScrollPos` updates book progress (on percent change), immer still gives new content references and the whole EPUB tree may re-render.

Fix like manga: select primitives (link, loading, chapter id for notes/bookmarks) and keep percent UI on local state.

### C. Avoid layout read during manga render

In manga `Reader` JSX, `className` uses `readerRef.current?.offsetHeight` and `imgContRef.current?.scrollHeight` (forced reflow every render). Move `noOverflow` to `useLayoutEffect` / `ResizeObserver` + state/flag.

### D. Unstable selectors outside the reader

Reader path was cleaned. Elsewhere, search for:

- `useAppSelector` + `.filter(` / `.map(` returning new arrays
- `Object.fromEntries` / object literals in selectors without `createSelector` or `shallowEqual`

Memoize or pass `shallowEqual` at the call site.

### E. Debounce preset autosave disk writes

User presets default `autosave: true` (`src/renderer/utils/readerPresets.ts`). Settings edits hit disk via `readerPresetsAutosaveMiddleware`. Self-echo is fixed; high-frequency writes while dragging sliders can still hitch. Debounce autosave writes (e.g. 300-500ms) separately from the echo fix.

## Key files

| Area | Path |
| --- | --- |
| Shortcuts selector | `src/renderer/store/shortcuts.ts` |
| Preset selectors / refresh | `src/renderer/store/readerPresets.ts` |
| Preset UI | `src/renderer/features/reader/components/ReaderPresetSection.tsx` |
| Manga reader | `src/renderer/features/reader/manga/Reader.tsx` |
| Manga settings | `src/renderer/features/reader/manga/components/ReaderSettings.tsx` |
| EPUB reader | `src/renderer/features/reader/epub/EPubReader.tsx` |
| EPUB settings | `src/renderer/features/reader/epub/EPubReaderSettings.tsx` |
| File change IPC | `src/electron/ipc/fs.ts` |
| File change listener | `src/renderer/App.tsx` |
| Window id | `src/electron/preload.ts` |
| Autosave middleware | `src/renderer/store/readerPresetsAutosaveMiddleware.ts` |
| Reader page Redux | `src/renderer/store/reader.ts` (`updateReaderMangaCurrentPage`) |

## Version bisect (reporter)

| Version | Scroll stutter |
| --- | --- |
| `v2.23.2-beta.5` and earlier (in reporter's list) | No |
| `v2.23.2-beta.6` onward through `v2.24.0` | Yes |

Rough changelog between beta.5 and beta.6 includes reader presets, preset keybinds, EPUB background settings, AniList manual chapter tracking for EPUB, and related refactors - large surface; selectors above are the matched DevTools signal.
