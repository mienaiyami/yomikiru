import { findCover } from "@utils/utils";

/**
 * Path for `library_items.cover` when persisting a path: only a `cover.*` in the series root.
 * First-page / chapter images are never written here; they are materialized to userData/covers only.
 */
export const mangaDedicatedCoverPathForDb = (mangaDir: string): string | null => {
    const c = findCover(mangaDir);
    return c ? c : null;
};

/**
 * Manga folder: `cover.*` if present, otherwise first page image from the open chapter when provided.
 * The first-page path is for materialize input only, not for DB `cover` (see {@link mangaDedicatedCoverPathForDb}).
 */
export const resolveMangaCoverSourcePath = (
    mangaDir: string,
    firstPageImage?: string | null,
): { realCover: string; sourceForCover: string } => {
    const realCover = findCover(mangaDir);
    const sourceForCover =
        realCover ||
        (firstPageImage && typeof firstPageImage === "string" && window.fs.isFile(firstPageImage)
            ? firstPageImage
            : "");
    return { realCover, sourceForCover };
};
