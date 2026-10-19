import type { LibraryItemWithProgress } from "@common/types/db";
import type { AppDispatch } from "@store/index";
import { setLibraryItemDetailsCoverSource, updateLibraryItem } from "@store/library";
import { materializeCoverAndRefreshLibrary } from "@utils/libraryCoverService";
import { resolveMangaCoverSourcePath } from "@utils/libraryCoverSources";

/**
 * Reader: after loading a manga chapter, writes WebP under userData/covers via materialize.
 * Chapter first-image sources are never stored in `library_items.cover`; only a series-root `cover.*`
 * path is persisted if materialize fails and that file exists.
 */
export const applyMangaCoverAfterChapterLoad = async (opts: {
    dispatch: AppDispatch;
    libraryItem: LibraryItemWithProgress & { type: "manga" };
    mangaDir: string;
    imgs: string[];
}): Promise<void> => {
    const { dispatch, libraryItem, mangaDir, imgs } = opts;
    const { realCover, sourceForCover } = resolveMangaCoverSourcePath(mangaDir, imgs[0]);

    /** Persists series-root `cover.*` to DB when materialize cannot and row has no cover file yet. */
    const persistDedicatedCoverFallback = async (): Promise<void> => {
        if (!realCover || !window.fs.isFile(realCover) || window.fs.isFile(libraryItem.cover || "")) {
            return;
        }
        await dispatch(updateLibraryItem({ link: mangaDir, cover: realCover }));
    };

    const canMaterialize = libraryItem.id != null && Boolean(sourceForCover) && window.fs.isFile(sourceForCover);
    if (canMaterialize) {
        try {
            const ok = await materializeCoverAndRefreshLibrary(dispatch, libraryItem.id, sourceForCover);
            if (!ok) {
                await persistDedicatedCoverFallback();
            }
        } catch {
            await persistDedicatedCoverFallback();
        }
    } else {
        await persistDedicatedCoverFallback();
    }
};

/**
 * Reader context menu: set gallery thumbnail from the selected page image path.
 * Always writes the page path into `library_items.cover` so {@link libraryCoverSrc} prefers it over an
 * older DB cover or series-root sidecar, and forces details cover source to library so tracker art
 * does not hide the pick. Materialize still refreshes `userData/covers/<id>.webp` when a library id exists.
 */
export const applyMakeCoverFromPageImage = async (opts: {
    dispatch: AppDispatch;
    libraryId: number | undefined;
    mangaRoot: string;
    fsPath: string;
}): Promise<void> => {
    const { dispatch, libraryId, mangaRoot, fsPath } = opts;

    /** Persists the picked page and prefers library cover over tracker for details/tiles. */
    const persistPickedCover = async (): Promise<void> => {
        await dispatch(updateLibraryItem({ link: mangaRoot, cover: fsPath }));
        await dispatch(setLibraryItemDetailsCoverSource({ link: mangaRoot, source: "library" }));
    };

    if (!libraryId || !window.fs.isFile(fsPath)) {
        await persistPickedCover();
        return;
    }
    try {
        await materializeCoverAndRefreshLibrary(dispatch, libraryId, fsPath);
    } catch {
        // still persist the path so gallery can show the pick without WebP
    }
    await persistPickedCover();
};
