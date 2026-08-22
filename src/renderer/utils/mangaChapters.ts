import {
    type LibraryIo,
    listMangaChapterChildren as listMangaChapterChildrenWith,
    type MangaChapterChild,
    pathIsInsideRoot as pathIsInsideRootWith,
} from "@common/library/classify";

export type { MangaChapterChild };

/**
 * Preload fs/path for classify. Main uses `mainLibraryIo` instead.
 * Process-wide helpers (`formatUtils`, folder normalize) use `setLibraryIo` in `file.ts`.
 */
export const rendererLibraryIo = (): LibraryIo => ({
    fs: window.fs,
    path: window.path,
});

/**
 * True when `absPath` is `root` or a descendant of `root` after normalize.
 */
export const pathIsInsideRoot = (absPath: string, root: string): boolean =>
    pathIsInsideRootWith(rendererLibraryIo(), absPath, root);

/**
 * Direct children of `seriesDir` that gallery details lists as chapters.
 */
export const listMangaChapterChildren = (seriesDir: string): Promise<MangaChapterChild[]> =>
    listMangaChapterChildrenWith(rendererLibraryIo(), seriesDir);
