import path from "node:path";
import type { AddToLibraryData } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import { rootReducer } from "@store/index";
import { makeBookItem, makeMangaItem } from "@test/fixtures/libraryItem";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import {
    addMangaFolderAtNormalizedPath,
    getExistingBaseDir,
    isDuplicateLibraryFolderPath,
    isLibraryFolderContent,
    isLibraryScanDue,
    isUnusedDummyProgress,
    type LibraryScanSettingsSlice,
    libraryItemLinksUnderScanRoot,
    listDueIntervalLibraryScanRoots,
    listForeignLibraryScanSkipPaths,
    listManualLibraryScanRoots,
    listStartupLibraryScanRoots,
    newLibraryFolderSetting,
    runScheduledLibraryScan,
    scanRootAndAddLibraryItems,
    showImportFinishedSummary,
    startLibraryFolderWatches,
    unusedDummyProgressLinks,
    withLibraryScanTimestamps,
} from "./librarySettingsImport";
import { LIBRARY_SCAN_DEFAULT_MAX_DEPTH, LIBRARY_SCAN_MAX_DEPTH_CEILING } from "./mangaChapters";

/** Fresh Redux store so import helpers can dispatch `addLibraryItem`. */
const makeStore = () =>
    configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });

/**
 * Installs a directory tree on `window.fs`. Keys are directory paths; values are
 * child basenames. `files` are leaf paths that `isFile` reports as files.
 */
const stubTree = (dirs: Record<string, string[]>, files: string[] = []): void => {
    const dirSet = new Set(Object.keys(dirs));
    const fileSet = new Set(files);
    stubFs({
        existsSync: (p) => dirSet.has(p) || fileSet.has(p),
        isDir: (p) => dirSet.has(p),
        isFile: (p) => fileSet.has(p),
        readdir: async (p) => dirs[p] ?? [],
        access: async () => undefined,
        stat: async () => ({ mtimeMs: 1 }),
    });
};

describe("getExistingBaseDir", () => {
    it("returns null for empty / missing paths", () => {
        expect(getExistingBaseDir(undefined)).toBeNull();
        expect(getExistingBaseDir("   ")).toBeNull();
        expect(getExistingBaseDir(path.join("missing", "dir"))).toBeNull();
    });

    it("returns trimmed path when it exists on disk", () => {
        const dir = path.join("testdata", "library");
        stubFs({ existsSync: (p) => p === dir });
        expect(getExistingBaseDir(`  ${dir}  `)).toBe(dir);
    });
});

describe("showImportFinishedSummary", () => {
    it("shows scan summary via dialog confirm", async () => {
        const handler = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:confirm", handler);
        await showImportFinishedSummary(2, 1, 0);
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Import finished",
                message: "Added 2. Skipped 1. Failed 0.",
                noOption: true,
                type: "info",
            }),
        );
    });
});

describe("addMangaFolderAtNormalizedPath", () => {
    it("adds a series folder without progress", async () => {
        const series = path.join("testdata", "Series A");
        const ch = path.join(series, "Ch01");
        stubTree({ [series]: ["Ch01"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);

        const captured: AddToLibraryData[] = [];
        onInvoke("db:library:addItem", async (request) => {
            captured.push(request);
            return {
                id: 1,
                type: "manga",
                link: request.data.link,
                title: request.data.title,
                author: null,
                cover: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                favouritedAt: null,
                note: null,
                extra: {},
            };
        });

        const store = makeStore();
        const result = await addMangaFolderAtNormalizedPath(series, {
            dispatch: store.dispatch,
            validateDirectory: async () => ({ isValid: true }),
        });
        expect(result).toBe("added");
        expect(captured).toHaveLength(1);
        expect(captured[0]?.type).toBe("manga");
        expect(captured[0]?.data.link).toBe(series);
        expect(captured[0]?.progress).toBeUndefined();
    });

    it("skips a grouping folder with no chapter children", async () => {
        const group = path.join("testdata", "folder1");
        const series = path.join(group, "Series A");
        const ch = path.join(series, "Ch01");
        stubTree({ [group]: ["Series A"], [series]: ["Ch01"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);
        const store = makeStore();
        const addHandler = vi.fn();
        onInvoke("db:library:addItem", addHandler);
        const result = await addMangaFolderAtNormalizedPath(group, {
            dispatch: store.dispatch,
            validateDirectory: async () => ({ isValid: true }),
        });
        expect(result).toBe("skipped");
        expect(addHandler).not.toHaveBeenCalled();
    });
});

describe("scanRootAndAddLibraryItems", () => {
    it("adds nested series under a grouping folder, not the group", async () => {
        const root = path.join("testdata", "lib");
        const group = path.join(root, "folder1");
        const series = path.join(group, "Series A");
        const ch = path.join(series, "Ch01");
        stubTree(
            {
                [root]: ["folder1"],
                [group]: ["Series A"],
                [series]: ["Ch01"],
                [ch]: ["01.jpg"],
            },
            [path.join(ch, "01.jpg")],
        );

        const captured: AddToLibraryData[] = [];
        onInvoke("db:library:addItem", async (request) => {
            captured.push(request);
            return {
                id: captured.length,
                type: request.data.type,
                link: request.data.link,
                title: request.data.title,
                author: request.data.author ?? null,
                cover: request.data.cover ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
                favouritedAt: null,
                note: null,
                extra: {},
            };
        });

        const store = makeStore();
        const result = await scanRootAndAddLibraryItems(root, {
            dispatch: store.dispatch,
            keepExtractedFiles: false,
            validateDirectory: async () => ({ isValid: true }),
            content: "both",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(result).toEqual({ added: 1, skipped: 0, failed: 0 });
        expect(captured.map((c) => c.data.link)).toEqual([series]);
        expect(captured[0]?.progress).toBeUndefined();
    });

    it("unions folder tag ids onto newly added items", async () => {
        const root = path.join("testdata", "lib");
        const series = path.join(root, "Series A");
        const ch = path.join(series, "Ch01");
        stubTree({ [root]: ["Series A"], [series]: ["Ch01"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);
        onInvoke("db:library:addItem", async (request) => ({
            id: 1,
            type: "manga",
            link: request.data.link,
            title: request.data.title,
            author: null,
            cover: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            favouritedAt: null,
            note: null,
            extra: {},
        }));
        const unioned: { itemLinks: string[]; tagIds: number[] }[] = [];
        onInvoke("db:library:unionItemTags", async (request) => {
            unioned.push(request);
            return request.itemLinks.flatMap((itemLink) => request.tagIds.map((tagId) => ({ itemLink, tagId })));
        });
        const store = makeStore();
        await scanRootAndAddLibraryItems(root, {
            dispatch: store.dispatch,
            keepExtractedFiles: false,
            validateDirectory: async () => ({ isValid: true }),
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
            tagIds: [4, 5],
        });
        expect(unioned).toEqual([{ itemLinks: [series], tagIds: [4, 5] }]);
    });
});

/** Extra-folder row for scan-root list tests. */
const testFolder = (
    over: Partial<LibraryScanSettingsSlice["libraryFolders"][number]> & { path: string },
): LibraryScanSettingsSlice["libraryFolders"][number] => ({
    content: "both",
    maxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
    scanOnStart: false,
    scanIntervalMinutes: 0,
    watch: false,
    lastScanAtMs: 0,
    skipPattern: "",
    tagIds: [],
    ...over,
});

/** Expected {@link LibraryScanRoot} fields besides path/content/maxDepth. */
const emptySkipMeta = { skipPattern: "", tagIds: [] as number[] };
const scanSettings = (
    over: Partial<LibraryScanSettingsSlice> & Pick<LibraryScanSettingsSlice, "baseDir">,
): LibraryScanSettingsSlice => ({
    scanDefaultLocation: false,
    scanDefaultLocationIntervalMinutes: 0,
    scanDefaultLocationLastAtMs: 0,
    scanDefaultLocationMaxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
    scanDefaultLocationSkipPattern: "",
    scanDefaultLocationTagIds: [],
    libraryFolders: [],
    ...over,
});

describe("isLibraryScanDue", () => {
    it("is never due when interval minutes is 0", () => {
        expect(isLibraryScanDue(0, 0, 1_000)).toBe(false);
        expect(isLibraryScanDue(1, 0, 1_000)).toBe(false);
    });

    it("is due when never scanned and interval is on", () => {
        expect(isLibraryScanDue(0, 1, 1_000)).toBe(true);
    });

    it("is due only after the interval has elapsed", () => {
        const minute = 60_000;
        expect(isLibraryScanDue(1_000, 1, 1_000 + minute - 1)).toBe(false);
        expect(isLibraryScanDue(1_000, 1, 1_000 + minute)).toBe(true);
    });
});

describe("listManualLibraryScanRoots", () => {
    it("omits Default Location when the opt-in is off", () => {
        const base = path.join("testdata", "home");
        stubFs({ existsSync: (p) => p === base });
        expect(listManualLibraryScanRoots(scanSettings({ baseDir: base }))).toEqual([]);
    });

    it("includes Default Location and folders, skipping missing and duplicate paths", () => {
        const base = path.join("testdata", "home");
        const extra = path.join("testdata", "drive");
        const missing = path.join("testdata", "gone");
        stubFs({ existsSync: (p) => p === base || p === extra });
        const roots = listManualLibraryScanRoots(
            scanSettings({
                baseDir: base,
                scanDefaultLocation: true,
                libraryFolders: [
                    testFolder({ path: extra, content: "manga", maxDepth: 4 }),
                    testFolder({ path: base, content: "book", maxDepth: 1 }),
                    testFolder({ path: missing, maxDepth: 2 }),
                ],
            }),
        );
        expect(roots).toEqual([
            { path: base, content: "both", maxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH, ...emptySkipMeta },
            { path: extra, content: "manga", maxDepth: 4, ...emptySkipMeta },
        ]);
    });

    it("uses scanDefaultLocationMaxDepth for Default Location", () => {
        const base = path.join("testdata", "home");
        stubFs({ existsSync: (p) => p === base });
        expect(
            listManualLibraryScanRoots(
                scanSettings({
                    baseDir: base,
                    scanDefaultLocation: true,
                    scanDefaultLocationMaxDepth: 4,
                }),
            ),
        ).toEqual([{ path: base, content: "both", maxDepth: 4, ...emptySkipMeta }]);
    });
});

describe("listStartupLibraryScanRoots", () => {
    it("includes opted-in Default Location and folders with scanOnStart", () => {
        const base = path.join("testdata", "home");
        const extra = path.join("testdata", "drive");
        stubFs({ existsSync: (p) => p === base || p === extra });
        const roots = listStartupLibraryScanRoots(
            scanSettings({
                baseDir: base,
                scanDefaultLocation: true,
                libraryFolders: [testFolder({ path: extra, content: "book", maxDepth: 3, scanOnStart: true })],
            }),
        );
        expect(roots.map((r) => r.path)).toEqual([base, extra]);
    });
});

describe("listDueIntervalLibraryScanRoots", () => {
    it("includes a folder only when its interval is due", () => {
        const extra = path.join("testdata", "drive");
        stubFs({ existsSync: (p) => p === extra });
        const folder = testFolder({ path: extra, scanIntervalMinutes: 1, lastScanAtMs: 1_000 });
        expect(
            listDueIntervalLibraryScanRoots(
                scanSettings({ baseDir: path.join("testdata", "home"), libraryFolders: [folder] }),
                1_000,
            ),
        ).toEqual([]);
        expect(
            listDueIntervalLibraryScanRoots(
                scanSettings({ baseDir: path.join("testdata", "home"), libraryFolders: [folder] }),
                1_000 + 60_000,
            ),
        ).toEqual([{ path: extra, content: "both", maxDepth: 2, ...emptySkipMeta }]);
    });
});

describe("withLibraryScanTimestamps", () => {
    it("stamps Default Location and matching folders", () => {
        const base = path.join("testdata", "home");
        const extra = path.join("testdata", "drive");
        stubFs({ existsSync: (p) => p === base || p === extra });
        const folder = testFolder({ path: extra });
        const patched = withLibraryScanTimestamps(
            scanSettings({
                baseDir: base,
                scanDefaultLocation: true,
                libraryFolders: [folder],
            }),
            [base, extra],
            9_000,
        );
        expect(patched.scanDefaultLocationLastAtMs).toBe(9_000);
        expect(patched.libraryFolders[0]?.lastScanAtMs).toBe(9_000);
    });
});

describe("listForeignLibraryScanSkipPaths", () => {
    it("excludes nested extra folders from Default Location and not the current root", () => {
        const base = path.join("testdata", "home");
        const extra = path.join(base, "completed");
        const other = path.join("testdata", "drive");
        stubFs({ existsSync: (p) => p === base || p === extra || p === other });
        const settings = scanSettings({
            baseDir: base,
            scanDefaultLocation: true,
            libraryFolders: [testFolder({ path: extra }), testFolder({ path: other })],
        });
        expect(listForeignLibraryScanSkipPaths(base, settings).sort()).toEqual([extra, other].sort());
        expect(listForeignLibraryScanSkipPaths(extra, settings)).toEqual([other]);
    });

    it("skips Default Location from an extra folder only when it sits inside that folder", () => {
        const extra = path.join("testdata", "drive");
        const base = path.join(extra, "home");
        stubFs({ existsSync: (p) => p === base || p === extra });
        const settings = scanSettings({
            baseDir: base,
            scanDefaultLocation: true,
            libraryFolders: [testFolder({ path: extra })],
        });
        expect(listForeignLibraryScanSkipPaths(extra, settings)).toEqual([base]);
    });

    it("does not skip Default Location from an extra folder when that scan is off", () => {
        const base = path.join("testdata", "home");
        const extra = path.join("testdata", "drive");
        stubFs({ existsSync: (p) => p === base || p === extra });
        const settings = scanSettings({
            baseDir: base,
            scanDefaultLocation: false,
            libraryFolders: [testFolder({ path: extra })],
        });
        expect(listForeignLibraryScanSkipPaths(extra, settings)).toEqual([]);
    });
});

describe("libraryItemLinksUnderScanRoot", () => {
    it("keeps items under the root and drops those inside a nested extra folder", () => {
        const root = path.join("testdata", "lib");
        const extra = path.join(root, "completed");
        const keep = path.join(root, "Keep");
        const nested = path.join(extra, "Done");
        expect(libraryItemLinksUnderScanRoot([keep, nested], root, [extra])).toEqual([keep]);
    });
});

describe("isDuplicateLibraryFolderPath", () => {
    it("matches normalized paths", () => {
        const dir = path.join("testdata", "lib");
        expect(isDuplicateLibraryFolderPath([{ path: dir }], `  ${dir}  `)).toBe(true);
        expect(isDuplicateLibraryFolderPath([{ path: dir }], path.join("testdata", "other"))).toBe(false);
    });
});

describe("newLibraryFolderSetting / isLibraryFolderContent", () => {
    it("normalizes the path and defaults scan fields off", () => {
        const dir = path.join("testdata", "lib");
        expect(newLibraryFolderSetting(`  ${dir}  `)).toMatchObject({
            path: window.path.normalize(`  ${dir}  `),
            content: "both",
            maxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
            scanOnStart: false,
            scanIntervalMinutes: 0,
            watch: false,
            lastScanAtMs: 0,
            skipPattern: "",
            tagIds: [],
        });
    });

    it("accepts only manga, book, or both", () => {
        expect(isLibraryFolderContent("manga")).toBe(true);
        expect(isLibraryFolderContent("both")).toBe(true);
        expect(isLibraryFolderContent("epub")).toBe(false);
    });
});

describe("isUnusedDummyProgress", () => {
    it("matches first-page manga progress stamped at create time", () => {
        const item = makeMangaItem(
            {},
            { currentPage: 1, chaptersRead: [], lastReadAt: new Date("2024-01-01T00:00:00.000Z") },
        );
        expect(isUnusedDummyProgress(item)).toBe(true);
        expect(unusedDummyProgressLinks({ [item.link]: item })).toEqual([item.link]);
    });

    it("rejects progress after a real read", () => {
        const item = makeMangaItem();
        expect(isUnusedDummyProgress(item)).toBe(false);
        expect(unusedDummyProgressLinks({ [item.link]: item })).toEqual([]);
    });

    it("matches empty-position book progress stamped at create time", () => {
        const item = makeBookItem({}, { position: "", lastReadAt: new Date("2024-01-01T00:00:00.000Z") });
        expect(isUnusedDummyProgress(item)).toBe(true);
    });
});

describe("runScheduledLibraryScan", () => {
    it("does not set the title-bar flag when there are no roots", async () => {
        const store = makeStore();
        await runScheduledLibraryScan(store.dispatch, async () => ({ isValid: true }), []);
        expect(store.getState().ui.libraryScanStatus).toBeNull();
        expect(store.getState().ui.blocks).toEqual([]);
    });

    it("sets then clears the title-bar flag around a walk", async () => {
        const series = path.join("testdata", "Scheduled Series");
        const ch = path.join(series, "Ch01");
        stubTree({ [series]: ["Ch01"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);
        const store = makeStore();
        const seenBusy: boolean[] = [];
        // record busy after each dispatch so the test sees the in-flight flag, not only the end state
        const dispatch: typeof store.dispatch = ((action: Parameters<typeof store.dispatch>[0]) => {
            const result = store.dispatch(action);
            seenBusy.push(store.getState().ui.libraryScanStatus != null);
            return result;
        }) as typeof store.dispatch;

        await runScheduledLibraryScan(dispatch, async () => ({ isValid: true }), [
            {
                path: series,
                content: "manga",
                maxDepth: LIBRARY_SCAN_MAX_DEPTH_CEILING,
                skipPattern: "",
                tagIds: [],
            },
        ]);

        expect(seenBusy).toContain(true);
        expect(store.getState().ui.libraryScanStatus).toBeNull();
        expect(store.getState().ui.blocks).toEqual([]);
    });
});

describe("startLibraryFolderWatches", () => {
    const watchOpts = () => ({
        dispatch: makeStore().dispatch,
        keepExtractedFiles: false,
        validateDirectory: async () => ({ isValid: true }),
    });

    it("does not start chokidar when watch is off", () => {
        const spy = vi.fn();
        window.chokidar.watch = spy;
        const dir = path.join("testdata", "lib");
        stubFs({ existsSync: () => true, isDir: () => true });
        const stop = startLibraryFolderWatches([{ ...newLibraryFolderSetting(dir), watch: false }], watchOpts());
        expect(spy).not.toHaveBeenCalled();
        stop();
    });

    it("starts chokidar when watch is on and the path exists", () => {
        const spy = vi.fn(() => () => undefined);
        window.chokidar.watch = spy;
        const dir = path.join("testdata", "lib");
        stubFs({ existsSync: (p) => p === dir, isDir: (p) => p === dir });
        const stop = startLibraryFolderWatches([{ ...newLibraryFolderSetting(dir), watch: true }], watchOpts());
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({
                path: dir,
                event: "all",
                options: expect.objectContaining({ ignoreInitial: true }),
            }),
        );
        stop();
    });
});
