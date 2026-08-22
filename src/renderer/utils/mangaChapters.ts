import {
    listMangaChapterChildren as listMangaChapterChildrenWith,
    type MangaChapterChild,
    pathIsInsideRoot as pathIsInsideRootWith,
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
