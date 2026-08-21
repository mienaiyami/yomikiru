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
    classifyLibraryNode,
    collectLibraryScanTargets,
    LIBRARY_SCAN_MAX_DEPTH_CEILING,
    listMangaChapterChildren,
} from "@utils/mangaChapters";

const log = createRendererLogger("utils/librarySettingsImport");

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
    scanDefaultLocationIntervalHours: number;
    scanDefaultLocationLastAtMs: number;
    libraryFolders: {
        path: string;
        content: "manga" | "book" | "both";
        maxDepth: number;
        scanOnStart: boolean;
        scanIntervalHours: number;
        watch: boolean;
        lastScanAtMs: number;
    }[];
};

/**
 * How often the app re-checks whether an interval scan is due.
 * User-facing spacing is {@link LibraryScanSettingsSlice.scanIntervalHours}, not this poll.
 */
export const LIBRARY_SCAN_INTERVAL_POLL_MS = 60_000;

/** One walkable root for {@link scanRootAndAddLibraryItems}. */
export type LibraryScanRoot = {
    path: string;
    content: CollectLibraryScanTargetsOpts["content"];
    maxDepth: number;
};

/**
 * True when `intervalHours` is on and enough time has passed since `lastScanAtMs`.
 * `lastScanAtMs` of 0 means never scanned.
 */
export const isLibraryScanDue = (lastScanAtMs: number, intervalHours: number, now = Date.now()): boolean => {
    if (intervalHours <= 0) return false;
    if (lastScanAtMs <= 0) return true;
    return now - lastScanAtMs >= intervalHours * 3_600_000;
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
    return { path: base, content: "both", maxDepth: LIBRARY_SCAN_MAX_DEPTH_CEILING };
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
    if (isLibraryScanDue(settings.scanDefaultLocationLastAtMs, settings.scanDefaultLocationIntervalHours, now)) {
        pushUniqueRoot(out, defaultLocationRoot(settings));
    }
    for (const folder of settings.libraryFolders) {
        if (!isLibraryScanDue(folder.lastScanAtMs, folder.scanIntervalHours, now)) continue;
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

/** Acquires the process-wide scan lock. Returns false when another scan holds it. */
const tryBeginLibraryScan = (): boolean => {
    if (libraryScanInFlight) {
        log.info("library scan skipped; already running");
        return false;
    }
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
    if (!tryBeginLibraryScan()) return { added: 0, skipped: 0, failed: 0, ran: false };
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
    if (!tryBeginLibraryScan()) return;
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
