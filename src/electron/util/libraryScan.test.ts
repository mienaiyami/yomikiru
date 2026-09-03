import path from "node:path";
import { Readable } from "node:stream";
import { emptyDefaultLibraryFolder } from "@common/library/folders";
import {
    LIBRARY_FOLDER_WATCH_DEBOUNCE_MS,
    LIBRARY_SCAN_INTERVAL_POLL_MS,
    type LibraryScanStatus,
} from "@common/types/libraryScan";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ipcSend, getAllWindows, watchMock, watcherOn, watcherClose, updateSettings } = vi.hoisted(() => {
    const watcherOn = vi.fn();
    const watcherClose = vi.fn();
    const watchMock = vi.fn(() => ({
        on: watcherOn,
        close: watcherClose,
    }));
    return {
        ipcSend: vi.fn(),
        getAllWindows: vi.fn(() => [] as { isDestroyed: () => boolean; webContents: Electron.WebContents }[]),
        watchMock,
        watcherOn,
        watcherClose,
        updateSettings: vi.fn(async () => undefined),
    };
});

const { addLibraryItem, materializeCoverFromSourcePath, materializeCoverFromStream, withEpubArchivePackage } =
    vi.hoisted(() => ({
        addLibraryItem: vi.fn(),
        materializeCoverFromSourcePath: vi.fn(async () => ({ ok: true as const })),
        materializeCoverFromStream: vi.fn(async () => ({ ok: true as const })),
        withEpubArchivePackage: vi.fn(),
    }));

const foldersState = {
    folders: [emptyDefaultLibraryFolder()],
};

vi.mock("electron", () => ({
    BrowserWindow: {
        getAllWindows,
    },
    app: {
        getPath: () => "/tmp",
    },
}));

vi.mock("@electron/ipc/utils", () => ({
    ipc: {
        send: ipcSend,
        handle: vi.fn(),
        on: vi.fn(),
    },
}));

vi.mock("@electron/util/logger", () => ({
    createMainLogger: () => ({
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
    }),
}));

vi.mock("chokidar", () => ({
    watch: watchMock,
}));

vi.mock("node:fs", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    const existsSync = vi.fn(() => true);
    const statSync = vi.fn(() => ({ isDirectory: () => true }));
    return {
        ...actual,
        existsSync,
        statSync,
        default: {
            ...actual,
            existsSync,
            statSync,
        },
    };
});

vi.mock("@electron/util/mainSettings", () => ({
    MainSettings: {
        get settings() {
            return { library: { folders: foldersState.folders } };
        },
        updateSettings,
        setAfterUpdate: vi.fn(),
    },
}));

vi.mock("@electron/ipc/database", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@electron/ipc/database")>();
    return {
        ...actual,
        pingDatabaseChange: vi.fn(),
    };
});

vi.mock("@electron/util/coverMaterialize", () => ({
    materializeCoverFromSourcePath,
    materializeCoverFromStream,
}));

vi.mock("@electron/util/contentSource", () => ({
    withResolvedFirstImage: vi.fn(async () => undefined),
    withEpubArchivePackage,
}));

vi.mock("@common/library/classify", async () => {
    const actual = await vi.importActual<typeof import("@common/library/classify")>("@common/library/classify");
    return {
        ...actual,
        collectLibraryScanTargets: vi.fn(async () => []),
        collectLibraryScanTargetFromEventPath: vi.fn(async () => null),
        listMangaChapterChildren: vi.fn(async () => []),
        classifyLibraryNode: vi.fn(async () => ({ kind: "skip", path: "" })),
    };
});

import { collectLibraryScanTargetFromEventPath, collectLibraryScanTargets } from "@common/library/classify";
import { withEpubArchivePackage as readEpubArchivePackage } from "@electron/util/contentSource";
import {
    cancelLibraryScan,
    getLibraryScanStatus,
    notifyLibraryScanRendererReady,
    resetLibraryScanForTests,
    setLibraryScanDatabase,
    startLibraryScan,
    startLibraryScanScheduler,
    stopLibraryScanScheduler,
    syncLibraryScanWatchers,
} from "./libraryScan";

const walkingStatus: LibraryScanStatus = {
    phase: "walking",
    rootIndex: 1,
    rootCount: 1,
    rootPath: "/lib",
    currentPath: "/lib/a",
    added: 0,
    skipped: 0,
    failed: 0,
    addIndex: 0,
    addTotal: 0,
};

const mockWebContents = (id: number) =>
    ({
        id,
        isDestroyed: () => false,
    }) as Electron.WebContents;

const mockWindow = (id: number) => ({
    isDestroyed: () => false,
    webContents: mockWebContents(id),
});

const existingRoot = path.join("testdata", "libroot");

describe("libraryScan engine", () => {
    beforeEach(() => {
        resetLibraryScanForTests();
        ipcSend.mockClear();
        getAllWindows.mockReturnValue([]);
        watchMock.mockClear();
        watcherOn.mockClear();
        watcherClose.mockClear();
        updateSettings.mockClear();
        addLibraryItem.mockReset();
        materializeCoverFromSourcePath.mockClear();
        materializeCoverFromStream.mockClear();
        withEpubArchivePackage.mockReset();
        withEpubArchivePackage.mockResolvedValue(undefined);
        vi.mocked(collectLibraryScanTargets).mockReset();
        vi.mocked(collectLibraryScanTargets).mockResolvedValue([]);
        vi.mocked(collectLibraryScanTargetFromEventPath).mockReset();
        vi.mocked(collectLibraryScanTargetFromEventPath).mockResolvedValue(null);
        foldersState.folders = [
            {
                ...emptyDefaultLibraryFolder(),
                path: existingRoot,
                watch: false,
            },
        ];
        setLibraryScanDatabase({
            db: {
                select: () => ({
                    from: () => Promise.resolve([]),
                }),
            },
            addLibraryItem,
            collapsePathIdentity: vi.fn(async () => false),
        } as never);
    });

    afterEach(() => {
        resetLibraryScanForTests();
        vi.useRealTimers();
    });

    it("rejects a second start until the first scan finishes", async () => {
        const { collectLibraryScanTargets } = await import("@common/library/classify");
        let release!: () => void;
        vi.mocked(collectLibraryScanTargets).mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = () => resolve([]);
                }),
        );
        const first = startLibraryScan({ reason: "manual" });
        await Promise.resolve();
        const second = await startLibraryScan({ reason: "manual" });
        expect(second.started).toBe(false);
        release();
        const done = await first;
        expect(done.started).toBe(true);
        expect(done.cancelled).toBe(false);
    });

    it("cancel stops an in-flight walk and does not stamp lastScanAtMs", async () => {
        const { collectLibraryScanTargets } = await import("@common/library/classify");
        vi.mocked(collectLibraryScanTargets).mockImplementation(async (_io, _root, opts) => {
            opts.onWalkProgress?.("/lib");
            cancelLibraryScan();
            return [{ type: "manga", path: path.join(existingRoot, "series") }];
        });
        const result = await startLibraryScan({ reason: "manual" });
        expect(result.started).toBe(true);
        expect(result.cancelled).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
        expect(getLibraryScanStatus()).toBeNull();
    });

    it("adds EPUB metadata and materializes its package cover", async () => {
        const epub = path.join(existingRoot, "novel.epub");
        const cover = Readable.from(["cover"]);
        vi.mocked(collectLibraryScanTargets).mockResolvedValue([{ type: "book", path: epub }]);
        addLibraryItem.mockResolvedValue({ id: 7, link: epub });
        vi.mocked(readEpubArchivePackage).mockImplementation(async (_epubPath, consumePackage) =>
            consumePackage({
                metadata: {
                    title: "Package title",
                    author: "Package author",
                    coverPath: "OPS/cover.jpg",
                },
                openCover: async () => cover,
            }),
        );

        const result = await startLibraryScan({ reason: "manual" });

        expect(result).toMatchObject({ started: true, added: 1, failed: 0 });
        expect(addLibraryItem).toHaveBeenCalledWith({
            type: "book",
            data: {
                type: "book",
                link: epub,
                title: "Package title",
                author: "Package author",
                cover: null,
            },
        });
        expect(materializeCoverFromStream).toHaveBeenCalledWith(7, cover);
    });

    it("broadcasts status to every living window while walking", async () => {
        const { collectLibraryScanTargets } = await import("@common/library/classify");
        const a = mockWindow(1);
        const b = mockWindow(2);
        getAllWindows.mockReturnValue([a, b]);
        vi.mocked(collectLibraryScanTargets).mockImplementation(async (_io, _root, opts) => {
            opts.onWalkProgress?.(walkingStatus.currentPath);
            return [];
        });
        await startLibraryScan({ reason: "manual" });
        expect(ipcSend).toHaveBeenCalledWith(
            a.webContents,
            "libraryScan:status",
            expect.objectContaining({ phase: "walking" }),
        );
        expect(ipcSend).toHaveBeenCalledWith(
            b.webContents,
            "libraryScan:status",
            expect.objectContaining({ phase: "walking" }),
        );
        expect(ipcSend).toHaveBeenCalledWith(a.webContents, "libraryScan:status", null);
    });

    it("runs startup scan only once", async () => {
        const { collectLibraryScanTargets } = await import("@common/library/classify");
        foldersState.folders = [{ ...emptyDefaultLibraryFolder(), path: existingRoot, scanOnStart: true }];
        vi.mocked(collectLibraryScanTargets).mockResolvedValue([]);
        notifyLibraryScanRendererReady();
        notifyLibraryScanRendererReady();
        await vi.waitFor(() => {
            expect(collectLibraryScanTargets).toHaveBeenCalledTimes(1);
        });
    });

    it("restarts a watcher only when its configured depth changes", () => {
        foldersState.folders = [{ ...emptyDefaultLibraryFolder(), path: existingRoot, watch: true, maxDepth: 2 }];
        syncLibraryScanWatchers();
        syncLibraryScanWatchers();
        expect(watchMock).toHaveBeenCalledTimes(1);
        foldersState.folders = [{ ...emptyDefaultLibraryFolder(), path: existingRoot, watch: true, maxDepth: 3 }];
        syncLibraryScanWatchers();
        expect(watchMock).toHaveBeenCalledTimes(2);
        expect(watcherClose).toHaveBeenCalledTimes(1);
        foldersState.folders = [{ ...emptyDefaultLibraryFolder(), path: existingRoot, watch: false, maxDepth: 2 }];
        syncLibraryScanWatchers();
        expect(watcherClose).toHaveBeenCalledTimes(2);
    });

    it("debounces watch events then classifies in main (no host flush)", async () => {
        vi.useFakeTimers();
        const { collectLibraryScanTargetFromEventPath } = await import("@common/library/classify");
        foldersState.folders = [{ ...emptyDefaultLibraryFolder(), path: existingRoot, watch: true, maxDepth: 2 }];
        syncLibraryScanWatchers();
        const onAll = watcherOn.mock.calls.find((c) => c[0] === "all")?.[1] as
            | ((event: string, eventPath: string) => void)
            | undefined;
        expect(onAll).toBeTypeOf("function");
        const a = path.join(existingRoot, "series", "Ch01");
        vi.mocked(collectLibraryScanTargetFromEventPath).mockImplementation(async () => {
            expect(getLibraryScanStatus()).toMatchObject({ phase: "walking", rootPath: existingRoot });
            return null;
        });
        onAll!("add", a);
        expect(collectLibraryScanTargetFromEventPath).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(LIBRARY_FOLDER_WATCH_DEBOUNCE_MS);
        expect(collectLibraryScanTargetFromEventPath).toHaveBeenCalled();
        expect(ipcSend).not.toHaveBeenCalledWith(expect.anything(), "libraryScan:watchFlush", expect.anything());
    });

    it("ticks interval scans without a host window", async () => {
        vi.useFakeTimers();
        const { collectLibraryScanTargets } = await import("@common/library/classify");
        foldersState.folders = [
            {
                ...emptyDefaultLibraryFolder(),
                path: existingRoot,
                scanIntervalMinutes: 1,
                lastScanAtMs: 0,
            },
        ];
        vi.mocked(collectLibraryScanTargets).mockResolvedValue([]);
        startLibraryScanScheduler();
        await vi.advanceTimersByTimeAsync(LIBRARY_SCAN_INTERVAL_POLL_MS);
        expect(collectLibraryScanTargets).toHaveBeenCalled();
        stopLibraryScanScheduler();
    });
});
