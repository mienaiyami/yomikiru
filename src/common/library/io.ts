/**
 * Preload-shaped fs/path used by {@link classifyLibraryNode} and scan walks.
 * Main must not pass raw `node:fs` `lstat` wrappers — `isDir` / `isFile` follow
 * the bridge contract (re-stat symbolic links). See `src/electron/preload.ts`.
 *
 * Common never imports Node or `window`. Each process installs an adapter via
 * {@link setLibraryIo}: main uses the Node adapter in `libraryFs.ts`, renderer
 * uses preload `window.fs` / `window.path`. Main and each renderer have their
 * own module copy, so they do not overwrite each other.
 */
export type LibraryFs = {
    existsSync: (path: string) => boolean;
    /**
     * Directory check. Default follows a symlink to a directory (preload `isDir`).
     */
    isDir: (path: string, acceptSymbolicLink?: boolean) => boolean;
    /**
     * Regular-file check. Default follows a symlink to a file (preload `isFile`, D8).
     */
    isFile: (path: string, acceptSymbolicLink?: boolean) => boolean;
    readdir: (path: string) => Promise<string[]>;
    /**
     * UTF-8 file read. Optional so classify test fakes omit it; EPUB parse requires it.
     */
    readFile?: (path: string, encoding?: string) => Promise<string>;
    access: (path: string, mode?: number) => Promise<void>;
    stat: (path: string) => Promise<{ mtimeMs: number }>;
    constants: { R_OK: number };
};

/** Path helpers matching the preload `path` bridge / `node:path`. */
export type LibraryPath = {
    join: (...paths: string[]) => string;
    normalize: (path: string) => string;
    basename: (path: string, ext?: string) => string;
    dirname: (path: string) => string;
    relative: (from: string, to: string) => string;
    extname: (path: string) => string;
    isAbsolute: (path: string) => boolean;
    sep: string;
};

/** Injected disk + path for classify / scan (renderer preload or main adapter). */
export type LibraryIo = {
    fs: LibraryFs;
    path: LibraryPath;
};

/**
 * Snapshot or factory. A factory is required when `fs` / `path` objects can be
 * replaced (unit tests that reinstall preload mocks).
 */
export type LibraryIoProvider = LibraryIo | (() => LibraryIo);

let ioProvider: LibraryIoProvider | null = null;

/**
 * Installs process-wide fs/path for common helpers that do not take {@link LibraryIo}
 * per call (`formatUtils`, folder path normalize). Classify still takes `io` so
 * tests can inject an in-memory tree.
 *
 * @param next Adapter or factory. Pass a factory in the renderer so `window.fs` /
 *   `window.path` replacements are visible.
 */
export const setLibraryIo = (next: LibraryIoProvider): void => {
    ioProvider = next;
};

/**
 * Process-wide {@link LibraryIo} from {@link setLibraryIo}.
 *
 * @throws {Error} When called before main or renderer bootstrap installs an adapter
 */
export const libraryIo = (): LibraryIo => {
    if (!ioProvider) {
        throw new Error(
            "Library Io is not installed. Main must load libraryFs; renderer must call setLibraryIo at bootstrap.",
        );
    }
    return typeof ioProvider === "function" ? ioProvider() : ioProvider;
};
