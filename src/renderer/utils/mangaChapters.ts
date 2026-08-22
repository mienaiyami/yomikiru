import {
    listMangaChapterChildren as listMangaChapterChildrenWith,
    type MangaChapterChild,
    pathIsInsideRoot as pathIsInsideRootWith,
    resolveMangaStartPath as resolveMangaStartPathWith,
} from "@common/library/classify";
import { rendererLibraryIo } from "./file";

export type { MangaChapterChild };
export { rendererLibraryIo };

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

/**
 * Reader target for an unread manga item: itself for a packed file/one-shot,
 * otherwise the first naturally name-sorted chapter below a series root.
 */
export const resolveMangaStartPath = (libraryPath: string): Promise<string | null> =>
    resolveMangaStartPathWith(rendererLibraryIo(), libraryPath);
