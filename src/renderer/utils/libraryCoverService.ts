import type { AppDispatch } from "@store/index";
import { fetchAllItemsWithProgress, updateLibraryItem } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import {
    fetchMangaCoverMaterializeSource,
    resolveBookCoverAbsolutePath,
    resolveMangaCoverSourcePath,
    type ValidateDirectoryFn,
} from "@utils/libraryCoverSources";
import { createRendererLogger } from "@utils/logger";

const log = createRendererLogger("utils/libraryCoverService");

/**
 * Invokes main-process WebP materialize; on success refreshes library rows from the DB.
 *
 * Never throws: IPC failures are returned as `{ ok: false, message }` by main and surface as `false` here.
 *
 * @returns whether materialize succeeded
 */
export const materializeCoverAndRefreshLibrary = async (
    dispatch: AppDispatch,
    libraryId: number,
    sourceAbsolutePath: string,
): Promise<boolean> => {
    const mat = await window.electron.invoke("covers:materialize", {
        libraryId,
        sourceAbsolutePath,
    });
    if (mat.ok) {
        await dispatch(fetchAllItemsWithProgress());
        return true;
    }
    return false;
};

/**
 * Builds/refreshes the library WebP thumbnail for a manga row using {@link fetchMangaCoverMaterializeSource}.
 *
 * @returns whether materialize reported success
 */
export const materializeMangaLibraryThumbnail = async (
    dispatch: AppDispatch,
    libraryId: number,
    mangaDir: string,
    validateDirectory: ValidateDirectoryFn,
): Promise<boolean> => {
    const src = await fetchMangaCoverMaterializeSource(mangaDir, validateDirectory);
    if (!src || !window.fs.isFile(src)) return false;
    return materializeCoverAndRefreshLibrary(dispatch, libraryId, src);
};

/**
 * EPUB cover for `covers:materialize` (extract + metadata); same path as bulk regen / new-book flows.
 */
export const materializeBookLibraryThumbnail = async (
    dispatch: AppDispatch,
    libraryId: number,
    epubPath: string,
): Promise<boolean> => {
    const src = await resolveBookCoverAbsolutePath(epubPath);
    if (!src || !window.fs.isFile(src)) return false;
    return materializeCoverAndRefreshLibrary(dispatch, libraryId, src);
};

export type MaterializeBookCoverFromExtractedPathOpts = {
    dispatch: AppDispatch;
    /** When null, no-op. */
    libraryId: number | null;
    coverAbsolutePath: string | undefined;
};

/**
 * Materializes a book row thumbnail from an EPUB-extracted absolute image path (temp or cache).
 * Does not set `library_items.cover` except via refresh; EPUB extract paths stay out of DB for user picks.
 */
export const materializeBookCoverFromExtractedPath = async (
    opts: MaterializeBookCoverFromExtractedPathOpts,
): Promise<void> => {
    const { dispatch, libraryId, coverAbsolutePath } = opts;
    if (libraryId == null || !coverAbsolutePath || !window.fs.isFile(coverAbsolutePath)) return;
    await materializeCoverAndRefreshLibrary(dispatch, libraryId, coverAbsolutePath);
};

export type MaterializeMangaRootAfterAddOpts = {
    dispatch: AppDispatch;
    /** When null/undefined, no-op. */
    libraryId: number | null | undefined;
    mangaDir: string;
    firstPageImage?: string | null;
};

/**
 * Tail used after inserting a manga library row: resolves the best cover source (series-root
 * `cover.*` or fallback to the given first-page image) and materializes it if available.
 *
 * @returns whether materialize ran and succeeded
 */
export const materializeMangaRootAfterAdd = async (opts: MaterializeMangaRootAfterAddOpts): Promise<boolean> => {
    const { dispatch, libraryId, mangaDir, firstPageImage } = opts;
    if (libraryId == null) return false;
    const { sourceForCover } = resolveMangaCoverSourcePath(mangaDir, firstPageImage);
    if (!sourceForCover || !window.fs.isFile(sourceForCover)) return false;
    return materializeCoverAndRefreshLibrary(dispatch, libraryId, sourceForCover);
};

export type PickAndApplyCustomCoverOpts = {
    dispatch: AppDispatch;
    libraryId: number | null | undefined;
    /** Library row primary key (`library_items.link`). */
    link: string;
    /** Initial directory for the native open-file dialog. */
    defaultPath: string;
    /** Logger label for error context. */
    errorLogLabel: string;
};

/**
 * Details-panel custom cover picker: opens native file picker, materializes the selected image,
 * and persists the absolute path to `library_items.cover` on success.
 */
export const pickAndApplyCustomCover = async (opts: PickAndApplyCustomCoverOpts): Promise<void> => {
    const { dispatch, libraryId, link, defaultPath, errorLogLabel } = opts;
    try {
        const result = await dialogUtils.showOpenDialog({
            title: "Select Cover",
            filters: [{ name: "Images", extensions: formatUtils.image.list.map((ext) => ext.slice(1)) }],
            defaultPath,
        });
        const picked = result?.filePaths[0];
        if (!picked || libraryId == null) return;
        try {
            const ok = await materializeCoverAndRefreshLibrary(dispatch, libraryId, picked);
            if (ok) {
                await dispatch(updateLibraryItem({ link, cover: picked }));
            }
        } catch (err) {
            log.error(`${errorLogLabel}: materialize failed`, err);
        }
    } catch (err) {
        log.error(`${errorLogLabel}: open dialog failed`, err);
    }
};
