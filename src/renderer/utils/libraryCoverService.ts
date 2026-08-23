import type { LibraryItem } from "@common/types/db";
import i18n from "@renderer/i18n";
import type { AppDispatch } from "@store/index";
import { fetchAllItemsWithProgress, updateLibraryItem } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { canonicalCoverAbsolutePath } from "@utils/libraryCover";
import { mangaDedicatedCoverPathForDb, resolveMangaCoverSourcePath } from "@utils/libraryCoverSources";
import { createRendererLogger } from "@utils/logger";
import { renderPDF } from "@utils/pdf";

const log = createRendererLogger("utils/libraryCoverService");

/** Library ids whose lazy PDF cover generation already ran in this renderer session. */
const pdfCoverAttempted = new Set<number>();

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

/** Resolves a library path in main, materializes its cover, then refreshes renderer library rows. */
const materializeLibraryPathAndRefresh = async (
    dispatch: AppDispatch,
    libraryId: number,
    itemType: "manga" | "book",
    link: string,
): Promise<boolean> => {
    const result = await window.electron.invoke("covers:materializeFromLibraryPath", {
        libraryId,
        itemType,
        link,
    });
    if (!result.ok) return false;
    await dispatch(fetchAllItemsWithProgress());
    return true;
};

/**
 * Builds or refreshes a manga row thumbnail through the main-process content-source resolver.
 *
 * @returns whether materialize reported success
 */
export const materializeMangaLibraryThumbnail = async (
    dispatch: AppDispatch,
    libraryId: number,
    mangaDir: string,
): Promise<boolean> => {
    return materializeLibraryPathAndRefresh(dispatch, libraryId, "manga", mangaDir);
};

/**
 * Builds or refreshes an EPUB row thumbnail through the main-process package parser.
 */
export const materializeBookLibraryThumbnail = async (
    dispatch: AppDispatch,
    libraryId: number,
    epubPath: string,
): Promise<boolean> => {
    return materializeLibraryPathAndRefresh(dispatch, libraryId, "book", epubPath);
};

/** Library row fields needed to rebuild a thumbnail. */
export type RegenLibraryThumbnailItem = Pick<LibraryItem, "id" | "type" | "link">;

/** Outcome of {@link regenerateLibraryThumbnails}. */
export type RegenLibraryThumbnailsResult = {
    /** Items whose `link` was missing on disk and were not parsed or materialized. */
    skippedMissing: number;
};

/**
 * Rebuilds WebP thumbnails for library rows whose file or folder still exists.
 * Missing paths are skipped (not extracted/parsed) so bulk regen does not show a parse error per item.
 *
 * @param onProgress - called with 1-based index and list length before each item (including skips)
 */
export const regenerateLibraryThumbnails = async (
    dispatch: AppDispatch,
    items: readonly RegenLibraryThumbnailItem[],
    onProgress: (done: number, total: number) => void,
): Promise<RegenLibraryThumbnailsResult> => {
    const skippedMissingItems: RegenLibraryThumbnailItem[] = [];
    let i = 0;
    for (const item of items) {
        i += 1;
        onProgress(i, items.length);
        if (item.id == null) continue;
        if (!window.fs.existsSync(item.link)) {
            skippedMissingItems.push(item);
            continue;
        }
        if (item.type === "manga") {
            await materializeMangaLibraryThumbnail(dispatch, item.id, item.link);
        } else {
            await materializeBookLibraryThumbnail(dispatch, item.id, item.link);
        }
    }
    const skippedMissing = skippedMissingItems.length;
    if (skippedMissing > 0) {
        log.warn("regenerate thumbnails: skipped missing paths", {
            count: skippedMissing,
            items: skippedMissingItems.map(({ id, type, link }) => ({ id, type, link })),
        });
    }
    log.info("regenerate thumbnails finished", { total: items.length, skippedMissing });
    return { skippedMissing };
};

/**
 * End-of-regen warning when bulk thumbnail rebuild skipped missing library paths.
 *
 * @param skippedMissing missing-path count from {@link regenerateLibraryThumbnails}; no-op when 0
 */
export const showRegenSkippedWarning = async (skippedMissing: number): Promise<void> => {
    if (skippedMissing <= 0) return;
    await dialogUtils.warn({
        title: i18n.t("library.regenSkippedTitle", { ns: "settings" }),
        message: i18n.t("library.regenSkippedMessage", { ns: "settings", count: skippedMissing }),
        noOption: true,
    });
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

/** Library row fields required to rebuild the default cover. */
export type ResetLibraryCoverItem = Pick<LibraryItem, "id" | "type" | "link" | "extra">;

/**
 * Clears user-picked cover overrides and rebuilds the thumbnail from the on-disk library path
 * (series-root cover file, first page, EPUB OPF cover, etc.).
 * Sets the details cover preference to the library image so tracker art does not override.
 */
export const resetLibraryCoverToDefault = async (
    dispatch: AppDispatch,
    item: ResetLibraryCoverItem,
): Promise<void> => {
    if (item.id == null) return;
    try {
        await window.electron.invoke("covers:deleteForLibraryId", { libraryId: item.id });
        const defaultCoverDb = item.type === "manga" ? mangaDedicatedCoverPathForDb(item.link) : null;
        await dispatch(
            updateLibraryItem({
                link: item.link,
                cover: defaultCoverDb,
                extra: { ...item.extra, detailsCoverSource: "library" },
            }),
        );
        if (item.type === "manga") {
            await materializeMangaLibraryThumbnail(dispatch, item.id, item.link);
            return;
        }
        await materializeBookLibraryThumbnail(dispatch, item.id, item.link);
    } catch (err) {
        log.error("reset cover to default failed", { id: item.id, link: item.link, type: item.type }, err);
    }
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

/**
 * Renders page 1 of a PDF manga item and materializes the library WebP.
 * No-ops when a cover already exists, the path is not a PDF, or this id already tried.
 * Main grants the renderer a process-wide canvas slot so another window cannot race the same cover.
 */
export const ensurePdfLibraryCover = async (
    dispatch: AppDispatch,
    item: Pick<LibraryItem, "id" | "type" | "link">,
): Promise<void> => {
    if (item.type !== "manga" || item.id == null) return;
    if (!formatUtils.pdf.test(item.link)) return;
    if (pdfCoverAttempted.has(item.id)) return;
    if (window.fs.isFile(canonicalCoverAbsolutePath(item.id))) return;
    const dest = window.path.join(window.electron.app.getPath("temp"), `yomikiru-pdf-cover-${item.id}`);
    let ownsRender = false;
    try {
        ownsRender = await window.electron.invoke("covers:acquirePdfRender", { libraryId: item.id });
        if (!ownsRender) return;
        pdfCoverAttempted.add(item.id);
        if (!window.fs.existsSync(item.link)) return;
        await window.fs.mkdir(dest, { recursive: true });
        await renderPDF(item.link, dest, 1, undefined, 1);
        const first = window.path.join(dest, "1.png");
        if (window.fs.isFile(first)) {
            await materializeCoverAndRefreshLibrary(dispatch, item.id, first);
        }
    } catch (err) {
        log.warn("pdf library cover generate failed", { id: item.id, link: item.link }, err);
    } finally {
        if (window.fs.existsSync(dest)) {
            await window.fs.rm(dest, { recursive: true }).catch((err) => {
                log.warn("pdf library cover temp cleanup failed", { dest }, err);
            });
        }
        if (ownsRender) {
            await window.electron.invoke("covers:releasePdfRender", { libraryId: item.id }).catch((err) => {
                log.warn("pdf library cover release failed", { id: item.id }, err);
            });
        }
    }
};
