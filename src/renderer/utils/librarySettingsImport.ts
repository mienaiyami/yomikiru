import type { AppDispatch } from "@store/index";
import { addLibraryItem } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import EPUB from "@utils/epub";
import { materializeBookCoverFromExtractedPath, materializeMangaRootAfterAdd } from "@utils/libraryCoverService";
import {
    mangaDedicatedCoverPathForDb,
    mangaSeriesFirstImageScanOptions,
    type ValidateDirectoryFn,
} from "@utils/libraryCoverSources";
import { createRendererLogger } from "@utils/logger";

const log = createRendererLogger("utils/librarySettingsImport");

/**
 * Returns trimmed default-location path when it exists on disk; otherwise `null`.
 */
export const getExistingBaseDir = (raw: string | undefined): string | null => {
    const baseDir = raw?.trim();
    if (!baseDir || !window.fs.existsSync(baseDir)) return null;
    return baseDir;
};

export type AddEpubAtNormalizedPathOpts = {
    dispatch: AppDispatch;
    keepExtractedFiles: boolean;
};

/**
 * Reads an EPUB at `norm`, inserts a book library row, and materializes its cover thumbnail.
 */
export const addEpubAtNormalizedPath = async (
    norm: string,
    opts: AddEpubAtNormalizedPathOpts,
): Promise<"added" | "failed"> => {
    const { dispatch, keepExtractedFiles } = opts;
    try {
        const ed = await EPUB.readEpubFile(norm, keepExtractedFiles);
        const spine0 = ed.spine[0];
        if (!spine0) {
            log.warn("EPUB has no spine entry", norm);
            return "failed";
        }
        const progress = {
            chapterId: spine0.id,
            chapterName: ed.manifest.get(spine0.id)?.title || "~",
            position: "",
        };
        const bookOpened = {
            type: "book" as const,
            link: norm,
            title: ed.metadata.title,
            author: ed.metadata.author,
            cover: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const added = await dispatch(
            addLibraryItem({
                type: "book",
                data: bookOpened,
                progress,
            }),
        ).unwrap();
        if (added?.id != null) {
            await materializeBookCoverFromExtractedPath({
                dispatch,
                libraryId: added.id,
                coverAbsolutePath: ed.metadata.cover,
            });
        }
        return "added";
    } catch (e) {
        log.error("addEpubAtNormalizedPath failed", norm, e);
        return "failed";
    }
};

export type AddMangaFolderAtNormalizedPathOpts = {
    dispatch: AppDispatch;
    validateDirectory: ValidateDirectoryFn;
};

/**
 * Validates `norm` as a packed manga series folder and adds it to the library with an initial
 * chapter progress row (first image's chapter). Materializes the series thumbnail on success.
 *
 * @returns `"added"` on insert, `"skipped"` if the folder is not a valid manga layout.
 */
export const addMangaFolderAtNormalizedPath = async (
    norm: string,
    opts: AddMangaFolderAtNormalizedPathOpts,
): Promise<"added" | "skipped" | "failed"> => {
    const { dispatch, validateDirectory } = opts;
    try {
        const result = await validateDirectory(norm, mangaSeriesFirstImageScanOptions());
        if (!result.isValid || !result.images?.length) return "skipped";

        const firstImg = result.images[0];
        const totalPages = result.imageCount ?? result.images.length;
        const chapterDir = window.path.dirname(firstImg);
        const chapterName = window.path.basename(chapterDir);
        const mangaOpened = {
            type: "manga" as const,
            link: norm,
            title: window.path.basename(norm),
            author: null,
            cover: mangaDedicatedCoverPathForDb(norm),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const added = await dispatch(
            addLibraryItem({
                type: "manga",
                data: mangaOpened,
                progress: {
                    chapterName,
                    currentPage: 1,
                    totalPages,
                },
            }),
        ).unwrap();
        await materializeMangaRootAfterAdd({
            dispatch,
            libraryId: added?.id,
            mangaDir: norm,
            firstPageImage: firstImg,
        });
        return "added";
    } catch (e) {
        log.error("addMangaFolderAtNormalizedPath failed", norm, e);
        return "failed";
    }
};

/**
 * Post-import confirmation with copy tuned for immediate-folder vs recursive EPUB scans.
 */
export const showImportFinishedSummary = async (
    added: number,
    skipped: number,
    failed: number,
    variant: "folderChildren" | "recursiveEpubs",
): Promise<void> => {
    const message =
        variant === "folderChildren"
            ? `Added ${added}. Skipped ${skipped}. Failed ${failed}.`
            : `Added ${added} books. Skipped ${skipped} (already in library). Failed ${failed}.`;
    await dialogUtils.confirm({
        title: "Import finished",
        message,
        noOption: true,
        type: "info",
    });
};
