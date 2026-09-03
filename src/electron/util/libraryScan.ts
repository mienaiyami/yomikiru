import fs from "node:fs";
import path from "node:path";
import {
    classifyLibraryNode,
    collectLibraryScanTargetFromEventPath,
    collectLibraryScanTargets,
    compileLibraryScanSkipRegex,
    listMangaChapterChildren,
    resolveLibraryRealPath,
} from "@common/library/classify";
import {
    type LibraryFolder,
    isLibraryScanDue,
    listForeignLibraryFolderSkipPaths,
    withLibraryScanTimestamps,
} from "@common/library/folders";
import { isBookFileName, isMangaFileName, isPdfFileName } from "@common/library/formats";
import { findCoverSidecar } from "@common/library/images";
import {
    LIBRARY_FOLDER_WATCH_DEBOUNCE_MS,
    LIBRARY_FOLDER_WATCH_DEPTH_PAD,
    LIBRARY_SCAN_INTERVAL_POLL_MS,
    LIBRARY_SCAN_MAX_DEPTH_CEILING,
    type LibraryScanReason,
    type LibraryScanStartRequest,
    type LibraryScanStartResult,
    type LibraryScanStatus,
} from "@common/types/libraryScan";
import type { DatabaseService } from "@electron/db";
import { libraryItems, libraryItemTags, libraryTags } from "@electron/db/schema";
import { LIBRARY_ITEM_LINK_CHANGE_CHANNELS, pingDatabaseChange } from "@electron/ipc/database";
import { ipc } from "@electron/ipc/utils";
import { withEpubArchivePackage, withResolvedFirstImage } from "@electron/util/contentSource";
import { materializeCoverFromSourcePath, materializeCoverFromStream } from "@electron/util/coverMaterialize";
import { mainLibraryIo } from "@electron/util/libraryFs";
import { createMainLogger } from "@electron/util/logger";
import { MainSettings } from "@electron/util/mainSettings";
import { watch as chokidarWatch } from "chokidar";
import { inArray } from "drizzle-orm";
import { BrowserWindow } from "electron";

const log = createMainLogger("libraryScan");
const io = mainLibraryIo;

let dbRef: DatabaseService | null = null;

const idleScanResult = (): LibraryScanStartResult => ({
    started: false,
    cancelled: false,
    added: 0,
    skipped: 0,
    failed: 0,
});
let inFlight = false;
let currentStatus: LibraryScanStatus | null = null;
let abort: AbortController | null = null;
let didStartup = false;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
/** Active watcher depth and cleanup keyed by normalized library root. */
const watchers = new Map<string, { maxDepth: number; stop: () => void }>();
const watchDebounce = new Map<string, ReturnType<typeof setTimeout>>();
const watchQueued = new Map<string, Set<string>>();

const normalizeRoot = (raw: string): string => path.normalize(raw.trim());

/** Stores the latest status and broadcasts it to every living renderer window. */
const broadcastStatus = (status: LibraryScanStatus | null): void => {
    currentStatus = status;
    for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
        try {
            ipc.send(window.webContents, "libraryScan:status", status);
        } catch (err) {
            log.error("libraryScan:status broadcast failed", err);
        }
    }
};

/** Throws the shared cancellation sentinel used by manual scans and watch flushes. */
const throwIfAborted = (): void => {
    if (abort?.signal.aborted) {
        const err = new Error("library scan cancelled");
        err.name = "AbortError";
        throw err;
    }
};

/** Current status for late-joining windows. */
export const getLibraryScanStatus = (): LibraryScanStatus | null => currentStatus;

/**
 * Asks the in-flight walk to stop. Cancelled roots are not stamped.
 */
export const cancelLibraryScan = (): void => {
    if (!inFlight || !abort) return;
    abort.abort();
    log.info("library scan cancel requested");
};

/**
 * Other configured roots a walk of `currentRoot` must not enter.
 * Ancestors are omitted because excluding one would also exclude the current walk.
 */
const listForeignSkipPaths = (currentRoot: string, folders: readonly LibraryFolder[]): string[] =>
    listForeignLibraryFolderSkipPaths(
        io,
        currentRoot,
        folders.map((folder) => folder.path),
    );

/** Returns a folder row only when its configured root currently exists. */
const libraryFolderScanRoot = (folder: LibraryFolder) => {
    const p = folder.path.trim();
    if (!p || !fs.existsSync(p)) return null;
    return folder;
};

/** Filters, normalizes, and de-duplicates folder rows selected for one scan reason. */
const rootsFromFolders = (
    folders: readonly LibraryFolder[],
    include: (folder: LibraryFolder) => boolean,
): LibraryFolder[] => {
    const out: LibraryFolder[] = [];
    const seen = new Set<string>();
    for (const folder of folders) {
        if (!include(folder)) continue;
        const root = libraryFolderScanRoot(folder);
        if (!root) continue;
        const n = resolveLibraryRealPath(io, root.path);
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(root);
    }
    return out;
};

/**
 * Catalogue realpaths, plus leftover alias keys (stored link is not the realpath, or two
 * stored links share a realpath) for a one-shot merge at the start of a library scan.
 */
type CatalogueLinkIndex = {
    existing: Set<string>;
    dirty: { canonical: string; type: "manga" | "book" }[];
};

/** Builds skip keys and leftover-alias keys for one scan. */
const indexCatalogueLinks = async (): Promise<CatalogueLinkIndex> => {
    if (!dbRef) return { existing: new Set(), dirty: [] };
    const rows = await dbRef.db.select({ link: libraryItems.link, type: libraryItems.type }).from(libraryItems);
    const existing = new Set<string>();
    const firstStored = new Map<string, string>();
    const typeByCanonical = new Map<string, "manga" | "book">();
    const dirtyCanonical = new Set<string>();
    for (const row of rows) {
        const canonical = resolveLibraryRealPath(io, row.link);
        existing.add(canonical);
        typeByCanonical.set(canonical, row.type);
        const prev = firstStored.get(canonical);
        if (prev === undefined) firstStored.set(canonical, row.link);
        else if (prev !== row.link) dirtyCanonical.add(canonical);
        if (row.link !== canonical) dirtyCanonical.add(canonical);
    }
    const dirty = [...dirtyCanonical].map((canonical) => ({
        canonical,
        type: typeByCanonical.get(canonical) ?? "manga",
    }));
    return { existing, dirty };
};

/**
 * Adds configured folder tags without replacing existing assignments.
 * The whole union is skipped when settings contain an unknown tag id.
 */
const unionFolderTags = async (itemLink: string, tagIds: readonly number[]): Promise<void> => {
    if (!dbRef || tagIds.length === 0) return;
    const uniqueIds = [...new Set(tagIds)];
    const existingTags = await dbRef.db
        .select({ id: libraryTags.id })
        .from(libraryTags)
        .where(inArray(libraryTags.id, uniqueIds));
    if (existingTags.length !== uniqueIds.length) {
        log.warn("scan tag union skipped; unknown tag id", { itemLink, uniqueIds });
        return;
    }
    await dbRef.db
        .insert(libraryItemTags)
        .values(uniqueIds.map((tagId) => ({ itemLink, tagId })))
        .onConflictDoNothing();
};

/** Adds one classified manga target and materializes its non-PDF cover when available. */
const addMangaPath = async (norm: string, tagIds: readonly number[]): Promise<"added" | "skipped" | "failed"> => {
    if (!dbRef) return "failed";
    try {
        const packed = io.fs.isFile(norm) && isMangaFileName(norm, io.path.extname);
        if (!packed) {
            if (!io.fs.isDir(norm)) return "skipped";
            const chapters = await listMangaChapterChildren(io, norm);
            if (chapters.length === 0) {
                const classified = await classifyLibraryNode(io, norm);
                if (classified.kind !== "oneshot") return "skipped";
            }
        }
        const item = await dbRef.addLibraryItem({
            type: "manga",
            data: {
                type: "manga",
                link: norm,
                title: path.basename(norm),
                author: null,
                cover: packed ? null : findCoverSidecar(io, norm) || null,
            },
        });
        await unionFolderTags(item.link, tagIds);
        const libraryId = item.id;
        if (libraryId != null && !isPdfFileName(norm, io.path.extname)) {
            await withResolvedFirstImage(norm, (source) =>
                typeof source === "string"
                    ? materializeCoverFromSourcePath(libraryId, source)
                    : materializeCoverFromStream(libraryId, source),
            );
        }
        return "added";
    } catch (err) {
        log.error("scan add manga failed", { path: norm }, err);
        return "failed";
    }
};

/** Adds one EPUB from package metadata while streaming its optional cover into the cache. */
const addBookPath = async (norm: string, tagIds: readonly number[]): Promise<"added" | "skipped" | "failed"> => {
    const db = dbRef;
    if (!db) return "failed";
    const added = await withEpubArchivePackage(norm, async (pkg) => {
        const item = await db.addLibraryItem({
            type: "book",
            data: {
                type: "book",
                link: norm,
                title: pkg.metadata.title,
                author: pkg.metadata.author.trim() ? pkg.metadata.author : null,
                cover: null,
            },
        });
        await unionFolderTags(item.link, tagIds);
        if (item.id != null) {
            const cover = await pkg.openCover();
            if (cover) await materializeCoverFromStream(item.id, cover);
        }
        return "added" as const;
    });
    if (added === "added") return "added";
    log.warn("scan skipped EPUB; extract or OPF parse failed", { path: norm });
    return "failed";
};

/** Dispatches one classified target to its content-specific catalogue writer. */
const addScanTarget = async (
    target: { type: "manga" | "book"; path: string },
    tagIds: readonly number[],
    existing: Set<string>,
): Promise<"added" | "skipped" | "failed"> => {
    if (existing.has(target.path)) return "skipped";
    const result =
        target.type === "book" || isBookFileName(target.path, io.path.extname)
            ? await addBookPath(target.path, tagIds)
            : await addMangaPath(target.path, tagIds);
    if (result === "added" || result === "skipped") existing.add(target.path);
    return result;
};

/**
 * Classifies and adds every requested root in order while broadcasting aggregate progress.
 * A root enters `completedPaths` only after all of its targets finish.
 */
const walkAndAdd = async (
    folders: readonly LibraryFolder[],
    allFolders: readonly LibraryFolder[],
): Promise<{ added: number; skipped: number; failed: number; collapsed: number; completedPaths: string[] }> => {
    let added = 0;
    let skipped = 0;
    let failed = 0;
    let collapsed = 0;
    const completedPaths: string[] = [];
    const { existing, dirty } = await indexCatalogueLinks();
    if (dbRef) {
        for (const row of dirty) {
            if (await dbRef.collapsePathIdentity(row.canonical, row.type)) collapsed += 1;
        }
    }
    const rootCount = folders.length;

    for (let i = 0; i < folders.length; i += 1) {
        throwIfAborted();
        const folder = folders[i];
        if (!folder) continue;
        const compiled = compileLibraryScanSkipRegex(folder.skipPattern);
        const skipRegex = compiled.status === "ok" ? compiled.regex : null;
        const baseStatus = {
            rootIndex: i + 1,
            rootCount,
            rootPath: folder.path,
            currentPath: folder.path,
            added,
            skipped,
            failed,
            addIndex: 0,
            addTotal: 0,
        };
        broadcastStatus({ ...baseStatus, phase: "walking" });
        const targets = await collectLibraryScanTargets(io, folder.path, {
            content: folder.content,
            maxDepth: folder.maxDepth,
            existingLinks: existing,
            skipRoots: listForeignSkipPaths(folder.path, allFolders),
            skipRegex,
            onWalkProgress: (currentPath) => {
                if (abort?.signal.aborted) return;
                broadcastStatus({ ...baseStatus, phase: "walking", currentPath, added, skipped, failed });
            },
            shouldStop: () => abort?.signal.aborted ?? false,
        });
        throwIfAborted();
        const addTotal = targets.length;
        for (let t = 0; t < targets.length; t += 1) {
            throwIfAborted();
            const target = targets[t];
            if (!target) continue;
            broadcastStatus({
                ...baseStatus,
                phase: "adding",
                added,
                skipped,
                failed,
                addIndex: t + 1,
                addTotal,
            });
            const result = await addScanTarget(target, folder.tagIds, existing);
            if (result === "added") added += 1;
            else if (result === "failed") failed += 1;
            else skipped += 1;
        }
        completedPaths.push(folder.path);
    }
    return { added, skipped, failed, collapsed, completedPaths };
};

/** Persists last-scan timestamps for roots that completed without cancellation. */
const stampCompleted = async (paths: readonly string[]): Promise<void> => {
    if (paths.length === 0) return;
    const folders = withLibraryScanTimestamps(MainSettings.settings.library.folders, paths);
    await MainSettings.updateSettings({ library: { folders } });
};

/** Selects existing roots according to explicit paths or the request reason's folder flags. */
const selectScanRoots = (request: LibraryScanStartRequest): LibraryFolder[] => {
    const folders = MainSettings.settings.library.folders;
    if (request.paths && request.paths.length > 0) {
        const wanted = new Set(request.paths.map(normalizeRoot).filter(Boolean));
        return rootsFromFolders(folders, (folder) => wanted.has(normalizeRoot(folder.path)));
    }
    if (request.reason === "startup") return rootsFromFolders(folders, (folder) => folder.scanOnStart);
    if (request.reason === "interval") {
        return rootsFromFolders(folders, (folder) =>
            isLibraryScanDue(folder.lastScanAtMs, folder.scanIntervalMinutes),
        );
    }
    return rootsFromFolders(folders, () => true);
};

/**
 * Caller must already hold `inFlight`. Walks `folders`, stamps on success (not watch/cancel).
 */
const runScan = async (
    reason: LibraryScanReason,
    folders: readonly LibraryFolder[],
): Promise<LibraryScanStartResult> => {
    const empty = { started: true, cancelled: false, added: 0, skipped: 0, failed: 0 };
    if (folders.length === 0 || !dbRef) return { ...empty, started: false };
    const allFolders = MainSettings.settings.library.folders;
    try {
        const result = await walkAndAdd(folders, allFolders);
        throwIfAborted();
        const last = folders[folders.length - 1];
        broadcastStatus({
            phase: "refreshing",
            rootIndex: folders.length,
            rootCount: folders.length,
            rootPath: last?.path ?? "",
            currentPath: last?.path ?? "",
            added: result.added,
            skipped: result.skipped,
            failed: result.failed,
            addIndex: 0,
            addTotal: 0,
        });
        if (reason !== "watch") await stampCompleted(result.completedPaths);
        pingDatabaseChange(
            result.collapsed > 0 || result.added > 0 ? LIBRARY_ITEM_LINK_CHANGE_CHANNELS : "db:library:change",
        );
        log.info("library scan finished", { reason, ...result });
        return {
            started: true,
            cancelled: false,
            added: result.added,
            skipped: result.skipped,
            failed: result.failed,
        };
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            log.info("library scan cancelled", { reason });
            return { started: true, cancelled: true, added: 0, skipped: 0, failed: 0 };
        }
        log.error("library scan failed", { reason }, err);
        return { started: true, cancelled: false, added: 0, skipped: 0, failed: 0 };
    } finally {
        inFlight = false;
        abort = null;
        broadcastStatus(null);
    }
};

/**
 * Starts a process-wide library scan and waits until it finishes or is cancelled.
 */
export const startLibraryScan = async (request?: LibraryScanStartRequest): Promise<LibraryScanStartResult> => {
    const req = request ?? { reason: "manual" };
    if (inFlight) return idleScanResult();
    if (!dbRef) return idleScanResult();
    const roots = selectScanRoots(req);
    if (roots.length === 0) return idleScanResult();
    inFlight = true;
    abort = new AbortController();
    return runScan(req.reason, roots);
};

/** Closes one watcher and clears its queued/debounced work. */
const closeWatcher = (root: string): void => {
    const watcher = watchers.get(root);
    if (watcher) {
        watcher.stop();
        watchers.delete(root);
    }
    const timer = watchDebounce.get(root);
    if (timer) {
        clearTimeout(timer);
        watchDebounce.delete(root);
    }
    watchQueued.delete(root);
};

/** Watch depth includes chapter descendants so a page copy can trigger classify-upward. */
const watchDepth = (maxDepth: number): number =>
    Math.min(
        Math.max(0, maxDepth) + LIBRARY_FOLDER_WATCH_DEPTH_PAD,
        LIBRARY_SCAN_MAX_DEPTH_CEILING + LIBRARY_FOLDER_WATCH_DEPTH_PAD,
    );

/** Classifies queued changes upward under one root and adds newly completed titles. */
const flushWatchRoot = async (root: string, eventPaths: string[]): Promise<void> => {
    const folder = MainSettings.settings.library.folders.find((row) => normalizeRoot(row.path) === root);
    if (!folder || eventPaths.length === 0) return;
    const { existing } = await indexCatalogueLinks();
    const compiled = compileLibraryScanSkipRegex(folder.skipPattern);
    const skipRegex = compiled.status === "ok" ? compiled.regex : null;
    const allFolders = MainSettings.settings.library.folders;
    let added = 0;
    let skipped = 0;
    let failed = 0;
    for (let index = 0; index < eventPaths.length; index += 1) {
        throwIfAborted();
        const eventPath = eventPaths[index];
        if (!eventPath) continue;
        const baseStatus = {
            rootIndex: 1,
            rootCount: 1,
            rootPath: root,
            currentPath: eventPath,
            added,
            skipped,
            failed,
            addIndex: index + 1,
            addTotal: eventPaths.length,
        };
        broadcastStatus({ ...baseStatus, phase: "walking" });
        try {
            const target = await collectLibraryScanTargetFromEventPath(io, eventPath, root, {
                content: folder.content,
                maxDepth: folder.maxDepth,
                existingLinks: existing,
                skipRoots: listForeignSkipPaths(root, allFolders),
                skipRegex,
            });
            if (!target) continue;
            throwIfAborted();
            broadcastStatus({ ...baseStatus, phase: "adding" });
            const result = await addScanTarget(target, folder.tagIds, existing);
            if (result === "added") added += 1;
            else if (result === "failed") failed += 1;
            else skipped += 1;
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") throw err;
            failed += 1;
            log.error("library folder watch classify failed", { eventPath, root }, err);
        }
    }
    if (added > 0) {
        pingDatabaseChange(LIBRARY_ITEM_LINK_CHANGE_CHANNELS);
        log.info("library folder watch added", { root, added });
    }
};

/** Debounces watcher bursts and retries after any process-wide scan holding the shared lock. */
const scheduleWatchFlush = (root: string): void => {
    const prev = watchDebounce.get(root);
    if (prev) clearTimeout(prev);
    watchDebounce.set(
        root,
        setTimeout(() => {
            watchDebounce.delete(root);
            const queued = watchQueued.get(root);
            if (!queued || queued.size === 0) return;
            if (inFlight) {
                scheduleWatchFlush(root);
                return;
            }
            const eventPaths = [...queued];
            queued.clear();
            void (async () => {
                if (inFlight) {
                    for (const p of eventPaths) queued.add(p);
                    scheduleWatchFlush(root);
                    return;
                }
                inFlight = true;
                abort = new AbortController();
                try {
                    await flushWatchRoot(root, eventPaths);
                } catch (err) {
                    if (err instanceof Error && err.name === "AbortError") {
                        log.info("library folder watch flush cancelled", { root });
                    } else {
                        log.error("library folder watch flush failed", { root }, err);
                    }
                } finally {
                    inFlight = false;
                    abort = null;
                    broadcastStatus(null);
                }
            })();
        }, LIBRARY_FOLDER_WATCH_DEBOUNCE_MS),
    );
};

/** Starts one symlink-compatible chokidar tree and queues relevant add/change events. */
const startWatcher = (root: string, maxDepth: number): void => {
    if (watchers.has(root)) return;
    if (!fs.existsSync(root)) {
        log.warn("library folder watch skipped; path missing", { path: root });
        return;
    }
    try {
        // statSync (not lstatSync) so a symlinked library folder still watches, matching preload isDir
        if (!fs.statSync(root).isDirectory()) {
            log.warn("library folder watch skipped; not a directory", { path: root });
            return;
        }
    } catch (err) {
        log.warn("library folder watch skipped; stat failed", { path: root }, err);
        return;
    }
    const watcher = chokidarWatch(root, {
        ignoreInitial: true,
        depth: watchDepth(maxDepth),
    });
    watcher.on("all", (event, eventPath) => {
        if (event === "unlink" || event === "unlinkDir") return;
        let queued = watchQueued.get(root);
        if (!queued) {
            queued = new Set();
            watchQueued.set(root, queued);
        }
        queued.add(eventPath);
        scheduleWatchFlush(root);
    });
    watchers.set(root, {
        maxDepth,
        stop: () => {
            void watcher.close();
        },
    });
};

/**
 * Opens or closes main-process chokidar to match folder watch flags from MainSettings.
 */
export const syncLibraryScanWatchers = (): void => {
    const wanted = new Map<string, number>();
    for (const folder of MainSettings.settings.library.folders) {
        if (!folder.watch) continue;
        const root = normalizeRoot(folder.path);
        if (!root) continue;
        wanted.set(root, folder.maxDepth);
    }
    for (const root of [...watchers.keys()]) {
        if (!wanted.has(root)) closeWatcher(root);
    }
    for (const [root, maxDepth] of wanted) {
        const current = watchers.get(root);
        if (current?.maxDepth === maxDepth) continue;
        if (current) closeWatcher(root);
        startWatcher(root, maxDepth);
    }
};

/** Called after MainSettings writes so watchers match the library block. */
export const onMainLibrarySettingsChanged = (): void => {
    syncLibraryScanWatchers();
};

/**
 * First living window: run scan-on-start once per process.
 */
export const notifyLibraryScanRendererReady = (): void => {
    if (didStartup) return;
    didStartup = true;
    void startLibraryScan({ reason: "startup" });
};

/**
 * Interval poll: walk due roots in main. No-op when a scan is already running.
 */
export const startLibraryScanScheduler = (): void => {
    if (intervalTimer) return;
    syncLibraryScanWatchers();
    intervalTimer = setInterval(() => {
        void startLibraryScan({ reason: "interval" });
    }, LIBRARY_SCAN_INTERVAL_POLL_MS);
};

/** Stops the interval timer and every library-folder watcher. */
export const stopLibraryScanScheduler = (): void => {
    if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
    }
    for (const root of [...watchers.keys()]) closeWatcher(root);
};

/**
 * Binds the open database used for catalogue writes. Call once from IPC register.
 */
export const setLibraryScanDatabase = (db: DatabaseService): void => {
    dbRef = db;
};

/**
 * Test-only reset of lock, status, startup flag, timers, and watchers.
 */
export const resetLibraryScanForTests = (): void => {
    inFlight = false;
    abort = null;
    currentStatus = null;
    didStartup = false;
    dbRef = null;
    stopLibraryScanScheduler();
};
