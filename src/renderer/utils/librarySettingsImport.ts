import type { LibraryItemWithProgress } from "@common/types/db";
import { setAppSettings } from "@store/appSettings";
import store, { type AppDispatch } from "@store/index";
import { addLibraryItem, fetchAllItemsWithProgress } from "@store/library";
import { setLibraryScanBusy } from "@store/ui";
import { dialogUtils } from "@utils/dialog";
import EPUB from "@utils/epub";
import { formatUtils } from "@utils/file";
import { materializeBookCoverFromExtractedPath, materializeMangaRootAfterAdd } from "@utils/libraryCoverService";
import {
    fetchMangaCoverMaterializeSource,
    mangaDedicatedCoverPathForDb,
    type ValidateDirectoryFn,
} from "@utils/libraryCoverSources";
import { createRendererLogger } from "@utils/logger";
import {
    type CollectLibraryScanTargetsOpts,
    clampLibraryScanMaxDepth,
    classifyLibraryNode,
    collectLibraryScanTargetFromEventPath,
    collectLibraryScanTargets,
    LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
    LIBRARY_SCAN_MAX_DEPTH_CEILING,
    listMangaChapterChildren,
} from "@utils/mangaChapters";

const log = createRendererLogger("utils/librarySettingsImport");

const LIBRARY_FOLDER_CONTENT = ["manga", "book", "both"] as const;

/**
 * How often the app re-checks whether an interval scan is due.
 * User-facing spacing is {@link LibraryScanSettingsSlice.scanIntervalMinutes}, not this poll.
 */
export const LIBRARY_SCAN_INTERVAL_POLL_MS = 60_000;

/** One minute in ms; {@link isLibraryScanDue} multiplies the user interval by this. */
const LIBRARY_SCAN_INTERVAL_MINUTE_MS = 60_000;

/**
 * How long watch events sit before classify-upward runs.
 * ponytail: coalesces copy/extract bursts; upgrade: longer quiet window or ignore incomplete folders.
 */
export const LIBRARY_FOLDER_WATCH_DEBOUNCE_MS = 2000;

/**
 * Extra chokidar depth past {@link LibraryScanSettingsSlice.libraryFolders} maxDepth so
 * chapter page files still fire events. Ceiling plus this is the named watch-depth bound.
 */
const LIBRARY_FOLDER_WATCH_DEPTH_PAD = 3;

/**
 * Max allowed skew between catalogue `createdAt` and progress `lastReadAt` for the
 * unused-progress heuristic. Upgrade: store an explicit "never read" flag on add.
 */
export const UNUSED_PROGRESS_CREATED_AT_WINDOW_MS = 120_000;

/**
 * Returns trimmed default-location path when it exists on disk; otherwise `null`.
 */
export const getExistingBaseDir = (raw: string | undefined): string | null => {
    const baseDir = raw?.trim();
    if (!baseDir || !window.fs.existsSync(baseDir)) return null;
    return baseDir;
};

export type AddEpubAtNormalizedPathOpts = {
    dispatch: AppDispatch;
    keepExtractedFiles: boolean;
};

/**
 * Reads an EPUB at `norm`, inserts a book catalogue row (no progress), and materializes its cover.
 */
export const addEpubAtNormalizedPath = async (
    norm: string,
    opts: AddEpubAtNormalizedPathOpts,
): Promise<"added" | "failed"> => {
    const { dispatch, keepExtractedFiles } = opts;
    try {
        const ed = await EPUB.readEpubFile(norm, keepExtractedFiles);
        const bookOpened = {
            type: "book" as const,
            link: norm,
            title: ed.metadata.title || window.path.basename(norm),
            author: ed.metadata.author,
            cover: null,
        };
        const added = await dispatch(
            addLibraryItem({
                type: "book",
                data: bookOpened,
            }),
        ).unwrap();
        if (added?.id != null) {
            await materializeBookCoverFromExtractedPath({
                dispatch,
                libraryId: added.id,
                coverAbsolutePath: ed.metadata.cover,
            });
        }
        return "added";
    } catch (e) {
        log.error("addEpubAtNormalizedPath failed", norm, e);
        return "failed";
    }
};

export type AddMangaFolderAtNormalizedPathOpts = {
    dispatch: AppDispatch;
    validateDirectory: ValidateDirectoryFn;
};

/**
 * Adds a manga series folder, one-shot folder, or packed/PDF file as a catalogue row (no progress).
 * Series folders must have listable chapter children. Thumbnails still use the first-image scan.
 *
 * @returns `"added"` on insert, `"skipped"` if the path is not a series or packed file.
 */
export const addMangaFolderAtNormalizedPath = async (
    norm: string,
    opts: AddMangaFolderAtNormalizedPathOpts,
): Promise<"added" | "skipped" | "failed"> => {
    const { dispatch, validateDirectory } = opts;
    try {
        const isPackedFile = window.fs.isFile(norm) && formatUtils.mangaFile.test(norm);
        if (!isPackedFile) {
            if (!window.fs.isDir(norm)) return "skipped";
            const chapters = await listMangaChapterChildren(norm);
            if (chapters.length === 0) {
                const classified = await classifyLibraryNode(norm);
                if (classified.kind !== "oneshot") return "skipped";
            }
        }

        const mangaOpened = {
            type: "manga" as const,
            link: norm,
            title: window.path.basename(norm),
            author: null,
            cover: isPackedFile ? null : mangaDedicatedCoverPathForDb(norm),
        };
        const added = await dispatch(
            addLibraryItem({
                type: "manga",
                data: mangaOpened,
            }),
        ).unwrap();
        const firstPageImage = await fetchMangaCoverMaterializeSource(norm, validateDirectory);
        await materializeMangaRootAfterAdd({
            dispatch,
            libraryId: added?.id,
            mangaDir: norm,
            firstPageImage,
        });
        return "added";
    } catch (e) {
        log.error("addMangaFolderAtNormalizedPath failed", norm, e);
        return "failed";
    }
};

export type ScanRootAndAddLibraryItemsOpts = {
    dispatch: AppDispatch;
    keepExtractedFiles: boolean;
    validateDirectory: ValidateDirectoryFn;
    content: CollectLibraryScanTargetsOpts["content"];
    /** Grouping-folder steps from the root; capped by {@link LIBRARY_SCAN_MAX_DEPTH_CEILING}. */
    maxDepth: number;
    /** Mutated when a path is added or skipped so later roots in the same run do not re-add it. */
    existingLinks: Set<string>;
    /** 1-based index and target count after classify, before each add. */
    onProgress?: (done: number, total: number) => void;
};

/**
 * Classifies under `root` and inserts catalogue rows for series, packed manga, and books.
 * Skips existing `link`s and does not write progress.
 */
export const scanRootAndAddLibraryItems = async (
    root: string,
    opts: ScanRootAndAddLibraryItemsOpts,
): Promise<{ added: number; skipped: number; failed: number }> => {
    const { dispatch, keepExtractedFiles, validateDirectory, content, existingLinks, onProgress } = opts;
    const maxDepth = Math.min(Math.max(0, opts.maxDepth), LIBRARY_SCAN_MAX_DEPTH_CEILING);
    const targets = await collectLibraryScanTargets(root, { content, maxDepth, existingLinks });
    let added = 0;
    let skipped = 0;
    let failed = 0;
    let i = 0;
    for (const target of targets) {
        i += 1;
        onProgress?.(i, targets.length);
        if (existingLinks.has(target.path)) {
            skipped += 1;
            continue;
        }
        if (target.type === "book") {
            const r = await addEpubAtNormalizedPath(target.path, { dispatch, keepExtractedFiles });
            if (r === "added") {
                added += 1;
                existingLinks.add(target.path);
            } else failed += 1;
            continue;
        }
        const r = await addMangaFolderAtNormalizedPath(target.path, { dispatch, validateDirectory });
        if (r === "added") {
            added += 1;
            existingLinks.add(target.path);
        } else if (r === "skipped") {
            skipped += 1;
            existingLinks.add(target.path);
        } else failed += 1;
    }
    return { added, skipped, failed };
};

/**
 * Post-import confirmation after a library scan.
 */
export const showImportFinishedSummary = async (added: number, skipped: number, failed: number): Promise<void> => {
    await dialogUtils.confirm({
        title: "Import finished",
        message: `Added ${added}. Skipped ${skipped}. Failed ${failed}.`,
        noOption: true,
        type: "info",
    });
};

/** Settings fields needed to decide which folders Scan now / start / interval walk. */
export type LibraryScanSettingsSlice = {
    baseDir: string;
    scanDefaultLocation: boolean;
    scanDefaultLocationIntervalMinutes: number;
    scanDefaultLocationLastAtMs: number;
    scanDefaultLocationMaxDepth: number;
    libraryFolders: {
        path: string;
        content: "manga" | "book" | "both";
        maxDepth: number;
        scanOnStart: boolean;
        scanIntervalMinutes: number;
        watch: boolean;
        lastScanAtMs: number;
    }[];
};

/** One walkable root for {@link scanRootAndAddLibraryItems}. */
export type LibraryScanRoot = {
    path: string;
    content: CollectLibraryScanTargetsOpts["content"];
    maxDepth: number;
};

/**
 * True when `intervalMinutes` is on and enough time has passed since `lastScanAtMs`.
 * `lastScanAtMs` of 0 means never scanned.
 */
export const isLibraryScanDue = (lastScanAtMs: number, intervalMinutes: number, now = Date.now()): boolean => {
    if (intervalMinutes <= 0) return false;
    if (lastScanAtMs <= 0) return true;
    return now - lastScanAtMs >= intervalMinutes * LIBRARY_SCAN_INTERVAL_MINUTE_MS;
};

/**
 * Walkable root for one library-folder row when that path exists on disk.
 */
export const libraryFolderScanRoot = (
    folder: LibraryScanSettingsSlice["libraryFolders"][number],
): LibraryScanRoot | null => {
    const p = folder.path.trim();
    if (!p || !window.fs.existsSync(p)) return null;
    return { path: p, content: folder.content, maxDepth: folder.maxDepth };
};

const defaultLocationRoot = (settings: LibraryScanSettingsSlice): LibraryScanRoot | null => {
    if (!settings.scanDefaultLocation) return null;
    const base = getExistingBaseDir(settings.baseDir);
    if (!base) return null;
    return {
        path: base,
        content: "both",
        maxDepth: clampLibraryScanMaxDepth(settings.scanDefaultLocationMaxDepth),
    };
};

const pushUniqueRoot = (out: LibraryScanRoot[], root: LibraryScanRoot | null): void => {
    if (!root) return;
    const n = window.path.normalize(root.path);
    if (out.some((r) => window.path.normalize(r.path) === n)) return;
    out.push(root);
};

/**
 * True when `candidate` matches an existing library-folder path (after normalize).
 */
export const isDuplicateLibraryFolderPath = (folders: readonly { path: string }[], candidate: string): boolean => {
    const n = window.path.normalize(candidate.trim());
    if (!n) return false;
    return folders.some((f) => window.path.normalize(f.path) === n);
};

/**
 * Narrows a select value to a library-folder content filter.
 */
export const isLibraryFolderContent = (
    value: string,
): value is LibraryScanSettingsSlice["libraryFolders"][number]["content"] =>
    (LIBRARY_FOLDER_CONTENT as readonly string[]).includes(value);

/**
 * Default extra-folder row after the user picks a directory.
 */
export const newLibraryFolderSetting = (
    folderPath: string,
): LibraryScanSettingsSlice["libraryFolders"][number] => ({
    path: window.path.normalize(folderPath),
    content: "both",
    maxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
    scanOnStart: false,
    scanIntervalMinutes: 0,
    watch: false,
    lastScanAtMs: 0,
});

/**
 * Roots Scan now walks: Default Location when opted in, plus every existing library folder.
 */
export const listManualLibraryScanRoots = (settings: LibraryScanSettingsSlice): LibraryScanRoot[] => {
    const out: LibraryScanRoot[] = [];
    pushUniqueRoot(out, defaultLocationRoot(settings));
    for (const folder of settings.libraryFolders) {
        pushUniqueRoot(out, libraryFolderScanRoot(folder));
    }
    return out;
};

/**
 * Roots to walk just after library hydrate when the user enabled scan-on-start.
 * Opting in Default Location also includes that folder on start.
 */
export const listStartupLibraryScanRoots = (settings: LibraryScanSettingsSlice): LibraryScanRoot[] => {
    const out: LibraryScanRoot[] = [];
    pushUniqueRoot(out, defaultLocationRoot(settings));
    for (const folder of settings.libraryFolders) {
        if (!folder.scanOnStart) continue;
        pushUniqueRoot(out, libraryFolderScanRoot(folder));
    }
    return out;
};

/**
 * Roots whose interval is due. Does not include scan-on-start-only folders that are not due.
 */
export const listDueIntervalLibraryScanRoots = (
    settings: LibraryScanSettingsSlice,
    now = Date.now(),
): LibraryScanRoot[] => {
    const out: LibraryScanRoot[] = [];
    if (isLibraryScanDue(settings.scanDefaultLocationLastAtMs, settings.scanDefaultLocationIntervalMinutes, now)) {
        pushUniqueRoot(out, defaultLocationRoot(settings));
    }
    for (const folder of settings.libraryFolders) {
        if (!isLibraryScanDue(folder.lastScanAtMs, folder.scanIntervalMinutes, now)) continue;
        pushUniqueRoot(out, libraryFolderScanRoot(folder));
    }
    return out;
};

/** Patches last-scan timestamps for roots that were walked. */
export const withLibraryScanTimestamps = (
    settings: LibraryScanSettingsSlice,
    scannedPaths: readonly string[],
    now = Date.now(),
): Pick<LibraryScanSettingsSlice, "libraryFolders" | "scanDefaultLocationLastAtMs"> => {
    const scanned = new Set(scannedPaths.map((p) => window.path.normalize(p)));
    const base = getExistingBaseDir(settings.baseDir);
    const defaultScanned = Boolean(base && scanned.has(window.path.normalize(base)));
    return {
        scanDefaultLocationLastAtMs: defaultScanned ? now : settings.scanDefaultLocationLastAtMs,
        libraryFolders: settings.libraryFolders.map((folder) =>
            scanned.has(window.path.normalize(folder.path)) ? { ...folder, lastScanAtMs: now } : folder,
        ),
    };
};

let libraryScanInFlight = false;

/** Acquires the process-wide scan lock. Returns false when Scan now, a scheduled walk, or a watch flush holds it. */
const tryBeginLibraryScan = (): boolean => {
    if (libraryScanInFlight) return false;
    libraryScanInFlight = true;
    return true;
};

/** Releases the process-wide scan lock. */
const endLibraryScan = (): void => {
    libraryScanInFlight = false;
};

/**
 * Classifies and inserts under each root. Caller must hold the scan lock.
 */
const walkLibraryScanRoots = async (
    roots: readonly LibraryScanRoot[],
    opts: Omit<ScanRootAndAddLibraryItemsOpts, "content" | "maxDepth">,
): Promise<{ added: number; skipped: number; failed: number }> => {
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const links = new Set(opts.existingLinks);
    for (const root of roots) {
        const r = await scanRootAndAddLibraryItems(root.path, {
            ...opts,
            content: root.content,
            maxDepth: root.maxDepth,
            existingLinks: links,
        });
        added += r.added;
        skipped += r.skipped;
        failed += r.failed;
    }
    return { added, skipped, failed };
};

/**
 * Walks each root in order. Skips when another scan is already running.
 */
export const scanLibraryRoots = async (
    roots: readonly LibraryScanRoot[],
    opts: Omit<ScanRootAndAddLibraryItemsOpts, "content" | "maxDepth">,
): Promise<{ added: number; skipped: number; failed: number; ran: boolean }> => {
    if (!tryBeginLibraryScan()) {
        log.info("library scan skipped; already running");
        return { added: 0, skipped: 0, failed: 0, ran: false };
    }
    try {
        const result = await walkLibraryScanRoots(roots, opts);
        return { ...result, ran: true };
    } finally {
        endLibraryScan();
    }
};

/**
 * Walks start/interval roots without locking the window. Sets {@link setLibraryScanBusy}
 * for the title-bar status. Library Settings Scan now still uses the full-window lock.
 * Holds the scan lock through catalogue refresh so a later poll cannot start a second walk.
 */
export const runScheduledLibraryScan = async (
    dispatch: AppDispatch,
    validateDirectory: ValidateDirectoryFn,
    roots: readonly LibraryScanRoot[],
): Promise<void> => {
    if (roots.length === 0) return;
    if (!tryBeginLibraryScan()) {
        log.info("scheduled library scan skipped; already running");
        return;
    }
    dispatch(setLibraryScanBusy(true));
    try {
        const state = store.getState();
        const result = await walkLibraryScanRoots(roots, {
            dispatch,
            keepExtractedFiles: state.appSettings.keepExtractedFiles,
            validateDirectory,
            existingLinks: new Set(Object.keys(state.library.items)),
        });
        dispatch(
            setAppSettings(
                withLibraryScanTimestamps(
                    store.getState().appSettings,
                    roots.map((r) => r.path),
                ),
            ),
        );
        await dispatch(fetchAllItemsWithProgress());
        log.info("scheduled library scan", result);
    } catch (e) {
        log.error("scheduled library scan failed", e);
    } finally {
        endLibraryScan();
        dispatch(setLibraryScanBusy(false));
    }
};

/**
 * True when progress exists but looks like a leftover from add-on-open (never actually read).
 * Manga: first page, no chapters marked read, timestamps within {@link UNUSED_PROGRESS_CREATED_AT_WINDOW_MS}.
 * Book: empty position and the same timestamp window.
 */
export const isUnusedDummyProgress = (item: LibraryItemWithProgress): boolean => {
    if (!item.progress) return false;
    const createdAtMs = new Date(item.createdAt).getTime();
    const lastReadAtMs = new Date(item.progress.lastReadAt).getTime();
    if (!Number.isFinite(createdAtMs) || !Number.isFinite(lastReadAtMs)) return false;
    if (Math.abs(lastReadAtMs - createdAtMs) > UNUSED_PROGRESS_CREATED_AT_WINDOW_MS) return false;
    if (item.type === "manga") {
        const chapters = item.progress.chaptersRead;
        return item.progress.currentPage === 1 && (!Array.isArray(chapters) || chapters.length === 0);
    }
    return item.progress.position.trim() === "";
};

/**
 * Catalogue links whose progress {@link isUnusedDummyProgress} would drop.
 */
export const unusedDummyProgressLinks = (
    items: Readonly<Record<string, LibraryItemWithProgress | null | undefined>>,
): string[] =>
    Object.values(items)
        .filter((item): item is LibraryItemWithProgress => item != null && isUnusedDummyProgress(item))
        .map((item) => item.link);

type LibraryFolderWatchOpts = {
    dispatch: AppDispatch;
    keepExtractedFiles: boolean;
    validateDirectory: ValidateDirectoryFn;
};

const addWatchTarget = async (
    target: { type: "manga" | "book"; path: string },
    opts: LibraryFolderWatchOpts,
    existingLinks: Set<string>,
): Promise<boolean> => {
    if (existingLinks.has(target.path)) return false;
    if (target.type === "book") {
        const r = await addEpubAtNormalizedPath(target.path, {
            dispatch: opts.dispatch,
            keepExtractedFiles: opts.keepExtractedFiles,
        });
        if (r === "added") {
            existingLinks.add(target.path);
            return true;
        }
        return false;
    }
    const r = await addMangaFolderAtNormalizedPath(target.path, {
        dispatch: opts.dispatch,
        validateDirectory: opts.validateDirectory,
    });
    if (r === "added") {
        existingLinks.add(target.path);
        return true;
    }
    if (r === "skipped") existingLinks.add(target.path);
    return false;
};

/**
 * Starts chokidar on each extra folder with `watch` on. Classify-upward on add/change;
 * never auto-removes. Holds the process-wide scan lock during a flush so Scan now cannot overlap.
 * Returns a disposer that closes every watcher.
 */
export const startLibraryFolderWatches = (
    folders: LibraryScanSettingsSlice["libraryFolders"],
    opts: LibraryFolderWatchOpts,
): (() => void) => {
    const closers: (() => void)[] = [];
    for (const folder of folders) {
        if (!folder.watch) continue;
        const root = folder.path.trim();
        if (!root || !window.fs.existsSync(root) || !window.fs.isDir(root)) {
            log.warn("library folder watch skipped; path missing", { path: root });
            continue;
        }
        let timer: ReturnType<typeof setTimeout> | null = null;
        const queued = new Set<string>();
        const scheduleFlush = (): void => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                void flush();
            }, LIBRARY_FOLDER_WATCH_DEBOUNCE_MS);
        };
        const flush = async (): Promise<void> => {
            if (!tryBeginLibraryScan()) {
                scheduleFlush();
                return;
            }
            const paths = [...queued];
            queued.clear();
            try {
                const existingLinks = new Set(Object.keys(store.getState().library.items));
                let added = 0;
                for (const eventPath of paths) {
                    try {
                        const target = await collectLibraryScanTargetFromEventPath(eventPath, root, {
                            content: folder.content,
                            maxDepth: folder.maxDepth,
                            existingLinks,
                        });
                        if (!target) continue;
                        if (await addWatchTarget(target, opts, existingLinks)) added += 1;
                    } catch (e) {
                        log.error("library folder watch classify failed", { eventPath, root }, e);
                    }
                }
                if (added > 0) {
                    await opts.dispatch(fetchAllItemsWithProgress());
                    log.info("library folder watch added", { root, added });
                }
            } finally {
                endLibraryScan();
                if (queued.size > 0) scheduleFlush();
            }
        };
        const depth = Math.min(
            Math.max(0, folder.maxDepth) + LIBRARY_FOLDER_WATCH_DEPTH_PAD,
            LIBRARY_SCAN_MAX_DEPTH_CEILING + LIBRARY_FOLDER_WATCH_DEPTH_PAD,
        );
        const closeWatcher = window.chokidar.watch({
            path: root,
            event: "all",
            options: {
                ignoreInitial: true,
                depth,
            },
            callback: (event, eventPath) => {
                if (event === "unlink" || event === "unlinkDir" || event === "error") return;
                queued.add(eventPath);
                scheduleFlush();
            },
        });
        closers.push(() => {
            if (timer) clearTimeout(timer);
            closeWatcher();
        });
    }
    return () => {
        for (const close of closers) close();
    };
};
