import type { LibraryItem } from "@common/types/db";
import i18n from "@renderer/i18n";
import type { AppDispatch } from "@store/index";
import { fetchAllItemsWithProgress, updateLibraryItem } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { canonicalCoverAbsolutePath } from "@utils/libraryCover";
import { renderPDF } from "@utils/pdf";
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
    validateDirectory: ValidateDirectoryFn,
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
            await materializeMangaLibraryThumbnail(dispatch, item.id, item.link, validateDirectory);
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

/** Max concurrent PDF first-page cover renders across gallery tiles. */
const PDF_COVER_GENERATE_CONCURRENCY = 2;

const pdfCoverAttempted = new Set<number>();
let pdfCoverActive = 0;
const pdfCoverWait: Array<() => void> = [];

const acquirePdfCoverSlot = (): Promise<void> =>
    new Promise((resolve) => {
        if (pdfCoverActive < PDF_COVER_GENERATE_CONCURRENCY) {
            pdfCoverActive += 1;
            resolve();
            return;
        }
        pdfCoverWait.push(() => {
            pdfCoverActive += 1;
            resolve();
        });
    });

const releasePdfCoverSlot = (): void => {
    pdfCoverActive = Math.max(0, pdfCoverActive - 1);
    const next = pdfCoverWait.shift();
    if (next) next();
};

/**
 * Renders page 1 of a PDF manga item and materializes the library WebP.
 * No-ops when a cover already exists, the path is not a PDF, or this id already tried.
 * ponytail: two concurrent renders; failed ids are not retried this session.
 */
export const ensurePdfLibraryCover = async (
    dispatch: AppDispatch,
    item: Pick<LibraryItem, "id" | "type" | "link">,
): Promise<void> => {
    if (item.type !== "manga" || item.id == null) return;
    if (!formatUtils.pdf.test(item.link)) return;
    if (pdfCoverAttempted.has(item.id)) return;
    if (window.fs.isFile(canonicalCoverAbsolutePath(item.id))) return;
    pdfCoverAttempted.add(item.id);
    await acquirePdfCoverSlot();
    const dest = window.path.join(window.electron.app.getPath("temp"), `yomikiru-pdf-cover-${item.id}`);
    try {
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
        releasePdfCoverSlot();
    }
};
