import type { DirectoryValidatorOptions, ValidationResult } from "@features/reader/types";
import { isPackedMangaFileName, isPdfFileName } from "@common/library/formats";
import { firstImageInMangaFolder } from "@common/library/images";
import EPUB from "@utils/epub";
import { rendererLibraryIo } from "@utils/mangaChapters";
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

/** Shared options for scanning a manga series folder for the first page image (matches bulk-import behavior). */
export const mangaSeriesFirstImageScanOptions = (): DirectoryValidatorOptions => ({
    showLoading: false,
    sendImages: false,
    firstImageOnly: true,
    maxSubdirectoryDepth: 1,
    errorOnInvalid: false,
    useCache: true,
});

export type ValidateDirectoryFn = (link: string, options?: DirectoryValidatorOptions) => Promise<ValidationResult>;

/**
 * Resolves an image path for `covers:materialize`: cover sidecar or first folder image;
 * packed archives still use the directory validator unzip. PDFs have no source here (lazy gallery).
 */
export const fetchMangaCoverMaterializeSource = async (
    mangaDir: string,
    validateDirectory: ValidateDirectoryFn,
): Promise<string | undefined> => {
    if (!window.fs.existsSync(mangaDir)) return undefined;
    if (isPdfFileName(mangaDir)) return undefined;
    if (window.fs.isFile(mangaDir) && isPackedMangaFileName(mangaDir)) {
        const result = await validateDirectory(mangaDir, mangaSeriesFirstImageScanOptions());
        const first = result.images?.[0];
        if (first && window.fs.isFile(first)) return first;
        return undefined;
    }
    const dedicated = mangaDedicatedCoverPathForDb(mangaDir);
    if (dedicated && window.fs.isFile(dedicated)) return dedicated;
    return firstImageInMangaFolder(rendererLibraryIo(), mangaDir);
};

/**
 * Loads EPUB metadata and returns the absolute cover image path when extract succeeds and the cover file exists.
 * Skips extract/parse when `epubPath` is missing so callers (bulk regen) do not get per-item parse dialogs.
 */
export const resolveBookCoverAbsolutePath = async (epubPath: string): Promise<string | undefined> => {
    if (!window.fs.existsSync(epubPath)) return undefined;
    try {
        const ed = await EPUB.readEpubFile(epubPath, false);
        const c = ed.metadata.cover;
        if (c && window.fs.isFile(c)) return c;
        return undefined;
    } catch {
        return undefined;
    }
};
