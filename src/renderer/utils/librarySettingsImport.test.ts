import path from "node:path";
import type { AddToLibraryData } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import { rootReducer } from "@store/index";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import {
    addMangaFolderAtNormalizedPath,
    getExistingBaseDir,
    isDuplicateLibraryFolderPath,
    isLibraryScanDue,
    type LibraryScanSettingsSlice,
    listDueIntervalLibraryScanRoots,
    listManualLibraryScanRoots,
    listStartupLibraryScanRoots,
    runScheduledLibraryScan,
    scanRootAndAddLibraryItems,
    showImportFinishedSummary,
    withLibraryScanTimestamps,
} from "./librarySettingsImport";
import { LIBRARY_SCAN_MAX_DEPTH_CEILING } from "./mangaChapters";

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
});

/** Settings slice for scan-root list tests. */
const scanSettings = (
    over: Partial<LibraryScanSettingsSlice> & Pick<LibraryScanSettingsSlice, "baseDir">,
): LibraryScanSettingsSlice => ({
    scanDefaultLocation: false,
    scanDefaultLocationIntervalHours: 0,
    scanDefaultLocationLastAtMs: 0,
    libraryFolders: [],
    ...over,
});

describe("isLibraryScanDue", () => {
    it("is never due when interval hours is 0", () => {
        expect(isLibraryScanDue(0, 0, 1_000)).toBe(false);
        expect(isLibraryScanDue(1, 0, 1_000)).toBe(false);
    });

    it("is due when never scanned and interval is on", () => {
        expect(isLibraryScanDue(0, 1, 1_000)).toBe(true);
    });

    it("is due only after the interval has elapsed", () => {
        const hour = 3_600_000;
        expect(isLibraryScanDue(1_000, 1, 1_000 + hour - 1)).toBe(false);
        expect(isLibraryScanDue(1_000, 1, 1_000 + hour)).toBe(true);
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
                    {
                        path: extra,
                        content: "manga",
                        maxDepth: 4,
                        scanOnStart: false,
                        scanIntervalHours: 0,
                        watch: false,
                        lastScanAtMs: 0,
                    },
                    {
                        path: base,
                        content: "book",
                        maxDepth: 1,
                        scanOnStart: false,
                        scanIntervalHours: 0,
                        watch: false,
                        lastScanAtMs: 0,
                    },
                    {
                        path: missing,
                        content: "both",
                        maxDepth: 2,
                        scanOnStart: false,
                        scanIntervalHours: 0,
                        watch: false,
                        lastScanAtMs: 0,
                    },
                ],
            }),
        );
        expect(roots).toEqual([
            { path: base, content: "both", maxDepth: LIBRARY_SCAN_MAX_DEPTH_CEILING },
            { path: extra, content: "manga", maxDepth: 4 },
        ]);
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
                libraryFolders: [
                    {
                        path: extra,
                        content: "book",
                        maxDepth: 3,
                        scanOnStart: true,
                        scanIntervalHours: 0,
                        watch: false,
                        lastScanAtMs: 0,
                    },
                ],
            }),
        );
        expect(roots.map((r) => r.path)).toEqual([base, extra]);
    });
});

describe("listDueIntervalLibraryScanRoots", () => {
    it("includes a folder only when its interval is due", () => {
        const extra = path.join("testdata", "drive");
        stubFs({ existsSync: (p) => p === extra });
        const folder = {
            path: extra,
            content: "both" as const,
            maxDepth: 2,
            scanOnStart: false,
            scanIntervalHours: 1,
            watch: false,
            lastScanAtMs: 1_000,
        };
        expect(
            listDueIntervalLibraryScanRoots(
                scanSettings({ baseDir: path.join("testdata", "home"), libraryFolders: [folder] }),
                1_000,
            ),
        ).toEqual([]);
        expect(
            listDueIntervalLibraryScanRoots(
                scanSettings({ baseDir: path.join("testdata", "home"), libraryFolders: [folder] }),
                1_000 + 3_600_000,
            ),
        ).toEqual([{ path: extra, content: "both", maxDepth: 2 }]);
    });
});

describe("withLibraryScanTimestamps", () => {
    it("stamps Default Location and matching folders", () => {
        const base = path.join("testdata", "home");
        const extra = path.join("testdata", "drive");
        stubFs({ existsSync: (p) => p === base || p === extra });
        const folder = {
            path: extra,
            content: "both" as const,
            maxDepth: 2,
            scanOnStart: false,
            scanIntervalHours: 0,
            watch: false,
            lastScanAtMs: 0,
        };
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

describe("isDuplicateLibraryFolderPath", () => {
    it("matches normalized paths", () => {
        const dir = path.join("testdata", "lib");
        expect(isDuplicateLibraryFolderPath([{ path: dir }], `  ${dir}  `)).toBe(true);
        expect(isDuplicateLibraryFolderPath([{ path: dir }], path.join("testdata", "other"))).toBe(false);
    });
});

describe("runScheduledLibraryScan", () => {
    it("does not set the title-bar flag when there are no roots", async () => {
        const store = makeStore();
        await runScheduledLibraryScan(store.dispatch, async () => ({ isValid: true }), []);
        expect(store.getState().ui.libraryScanBusy).toBe(false);
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
            seenBusy.push(store.getState().ui.libraryScanBusy);
            return result;
        }) as typeof store.dispatch;

        await runScheduledLibraryScan(dispatch, async () => ({ isValid: true }), [
            { path: series, content: "manga", maxDepth: LIBRARY_SCAN_MAX_DEPTH_CEILING },
        ]);

        expect(seenBusy).toContain(true);
        expect(store.getState().ui.libraryScanBusy).toBe(false);
        expect(store.getState().ui.blocks).toEqual([]);
    });
});
