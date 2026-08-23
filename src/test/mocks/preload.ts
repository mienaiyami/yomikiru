import os from "node:os";
import path from "node:path";
import type { ScopedLogSink } from "@common/logger";
import type { IPCChannels } from "@common/types/ipc";
import { vi } from "vitest";

type InvokeHandler<T extends keyof IPCChannels> = (
    request: IPCChannels[T]["request"],
) => IPCChannels[T]["response"] | Promise<IPCChannels[T]["response"]>;

/** Untyped registry entry; {@link onInvoke} keeps the public API channel-typed. */
type RegisteredInvokeHandler = (request: unknown) => unknown;

const invokeHandlers = new Map<string, RegisteredInvokeHandler>();
let clipboardText = "";

/**
 * Returns a no-op {@link ScopedLogSink} so {@link createRendererLogger} works in jsdom.
 */
const noopSink = (): ScopedLogSink => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
});

/**
 * Builds a stub that throws until a test overrides that API method.
 *
 * @throws {Error} Always, when called
 */
const throwStub =
    (api: string, method: string) =>
    (..._args: unknown[]): never => {
        throw new Error(`window.${api}.${method} is not stubbed in this test`);
    };

/**
 * Registers a typed handler for {@link window.electron.invoke}.
 * Unstubbed channels throw (except `fs:saveFile`, which is a silent no-op for store init).
 */
export const onInvoke = <T extends keyof IPCChannels>(channel: T, handler: InvokeHandler<T>): void => {
    invokeHandlers.set(channel, handler as RegisteredInvokeHandler);
};

/** Clears invoke handlers and the in-memory clipboard between tests. */
export const resetPreloadMocks = (): void => {
    invokeHandlers.clear();
    clipboardText = "";
};

/**
 * Common `window.fs` overrides for unit tests. Node fs overloads are intentionally narrowed
 * so callers can pass simple `(path) => ...` stubs without fighting `PathLike` signatures.
 */
export type TestFsOverrides = {
    readdir?: (dir: string) => Promise<string[]>;
    stat?: (dir: string) => Promise<{ mtimeMs: number }>;
    isDir?: (filePath: string) => boolean;
    isFile?: (filePath: string) => boolean;
    existsSync?: (filePath: string) => boolean;
    readFileSync?: (filePath: string, encoding?: BufferEncoding) => string;
    readFile?: (filePath: string, encoding?: BufferEncoding) => Promise<string>;
    rm?: (filePath: string, opts?: { recursive?: boolean }) => Promise<void>;
    mkdir?: (filePath: string) => Promise<void>;
    access?: (filePath: string) => Promise<void>;
    writeFile?: (filePath: string, data: string) => Promise<void>;
};

/**
 * Minimal `window.fs` surface: `existsSync` defaults to false so Redux/settings modules
 * initialize from defaults without touching disk.
 */
const createFsStub = (): Window["fs"] =>
    ({
        constants: {} as Window["fs"]["constants"],
        readFile: throwStub("fs", "readFile"),
        readFileSync: throwStub("fs", "readFileSync"),
        writeFile: throwStub("fs", "writeFile"),
        readdir: throwStub("fs", "readdir"),
        stat: throwStub("fs", "stat"),
        access: throwStub("fs", "access"),
        accessSync: throwStub("fs", "accessSync"),
        existsSync: () => false,
        rm: throwStub("fs", "rm"),
        mkdir: throwStub("fs", "mkdir"),
        isDir: () => false,
        isFile: () => false,
    }) as Window["fs"];

/**
 * Builds a fresh `window.fs`-shaped stub with optional overrides.
 * Use when injecting `fs` into a service; prefer {@link stubFs} for the global.
 */
export const createTestFs = (overrides: TestFsOverrides = {}): Window["fs"] =>
    ({ ...createFsStub(), ...overrides }) as Window["fs"];

/**
 * Merges overrides onto the current `window.fs` stub.
 * Cleared automatically when setup reinstalls preload in `afterEach`.
 */
export const stubFs = (overrides: TestFsOverrides): void => {
    window.fs = { ...window.fs, ...overrides } as Window["fs"];
};

/**
 * Installs typed preload fakes on `window` for jsdom unit tests.
 * Call once from the Vitest setup file; use {@link onInvoke} / {@link resetPreloadMocks} per test.
 */
export const installPreloadMocks = (): void => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    window.path = {
        join: path.join,
        normalize: path.normalize,
        extname: path.extname,
        basename: path.basename,
        dirname: path.dirname,
        resolve: path.resolve,
        relative: path.relative,
        isAbsolute: path.isAbsolute,
        sep: path.sep,
    };

    window.app = {
        betterSortOrder: (a, b) => collator.compare(a, b),
        deleteDirOnClose: "",
        titleBarHeight: 0,
        clickDelay: 0,
        lastClick: 0,
        scrollToPage: vi.fn(),
        keyRepeated: false,
        keydown: false,
    };

    /*
     * In jsdom, `window.process` is often the same object as Node's `process`.
     * Do not replace it (that drops `env` and breaks CJS react/RTK). Augment instead.
     */
    Object.assign(process, {
        osRelease: "test",
        isPortable: false,
        buildCommit: "test",
        buildDate: "test",
        buildType: "development",
    });
    (window as unknown as { process: NodeJS.Process }).process = process;

    window.logger = noopSink();
    window.createRendererLogSink = () => noopSink();

    window.fs = createFsStub();
    window.chokidar = {
        watch: throwStub("chokidar", "watch"),
    } as Window["chokidar"];
    window.getFonts = throwStub("getFonts", "call") as Window["getFonts"];

    window.electron = {
        app: {
            getPath: (name: string) => path.join(os.tmpdir(), "yomikiru-test", name),
            getVersion: () => "0.0.0-test",
            getName: () => "Yomikiru",
            isPackaged: false,
        },
        readText: () => clipboardText,
        writeText: (text: string) => {
            clipboardText = text;
        },
        copyImage: throwStub("electron", "copyImage"),
        openExternal: vi.fn(async () => undefined),
        showItemInFolder: vi.fn(),
        webFrame: {
            getZoomFactor: () => 1,
            setZoomFactor: vi.fn(),
            clearCache: vi.fn(),
        },
        clearAppCache: vi.fn(),
        currentWindow: {
            isFullScreen: () => false,
            setFullScreen: vi.fn(),
            isMaximized: () => false,
            isFocused: () => true,
            maximize: vi.fn(),
            minimize: vi.fn(),
            restore: vi.fn(),
            close: vi.fn(),
            setTitleBarOverlay: vi.fn(() => vi.fn()),
            clearEvents: vi.fn(),
            on: vi.fn(() => () => undefined),
            id: () => 1,
        },
        on: vi.fn(() => () => undefined),
        send: vi.fn(),
        invoke: vi.fn(async (channel: keyof IPCChannels, ...data: unknown[]) => {
            const handler = invokeHandlers.get(channel);
            if (handler) {
                return handler(data[0]);
            }
            /* Store/settings modules persist JSON during import when files are missing. */
            if (channel === "fs:saveFile") return undefined;
            throw new Error(`window.electron.invoke("${String(channel)}") is not stubbed in this test`);
        }),
    } as Window["electron"];

    /* process-wide scan lives in main; unit tests are a single window */
    onInvoke("libraryScan:start", () => ({
        started: false,
        cancelled: false,
        added: 0,
        skipped: 0,
        failed: 0,
    }));
    onInvoke("libraryScan:cancel", () => undefined);
    onInvoke("libraryScan:getStatus", () => null);
    onInvoke("libraryScan:rendererReady", () => undefined);
    onInvoke("anilist:claimLegacyTrackingImport", () => true);
    onInvoke("mainSettings:update", () => undefined);
    onInvoke("covers:materialize", () => ({ ok: true }));
    onInvoke("covers:acquirePdfRender", () => true);
    onInvoke("covers:releasePdfRender", () => undefined);
    onInvoke("covers:materializeFromLibraryPath", () => ({ ok: true }));
    onInvoke("db:library:getAllAndProgress", () => []);
};
