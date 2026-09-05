import i18n from "@renderer/i18n";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import store from "@store/index";
import { selectLibraryItem } from "@store/library";
import { setPresetSession, setReaderLoading, setReaderState } from "@store/reader";
import { ensureReaderPresetSession } from "@store/readerPresets";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { mangaPageForMissingKind, resolveMissingOpenPath } from "@utils/libraryMissingPath";
import { createRendererLogger } from "@utils/logger";
import { useCallback } from "react";
import { DirectoryValidatorService } from "../services/directoryValidator";
import type { DirectoryValidatorOptions, ValidationResult } from "../types";

const log = createRendererLogger("DirectoryValidator");

export const useDirectoryValidator = () => {
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((state) => state.appSettings);
    const linkInReader = useAppSelector((state) => state.reader.link);

    const createValidator = useCallback(() => {
        //todo : fix, its getting called on each open in reader
        return new DirectoryValidatorService({
            fs: window.fs,
            path: window.path,
            logger: log,
            electron: window.electron,
            app: window.app,
            appSettings: {
                keepExtractedFiles: appSettings.keepExtractedFiles,
                pdfScale: appSettings.readerSettings.pdfScale,
            },
            onProgress: (progress) => {
                if (progress === null) {
                    dispatch(setReaderLoading(null));
                    return;
                }
                dispatch(
                    setReaderLoading({
                        percent: progress.percent,
                        message: progress.message,
                    }),
                );
            },
        });
    }, [appSettings]);

    const validateDirectory = useCallback(
        async (link: string, options: DirectoryValidatorOptions = {}): Promise<ValidationResult> => {
            const validator = createValidator();

            try {
                const result = await validator.validateDirectory(link, options);
                // dispatch(setReaderLoading(null));
                return result;
            } catch (error) {
                dispatch(setReaderLoading(null));

                return {
                    isValid: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                };
            }
        },
        [createValidator],
    );

    /**
     * Opens content in reader if valid
     */
    const openInReaderIfValid = useCallback(
        async (
            link: string,
            options?: {
                mangaPageNumber?: number;
                epubChapterId?: string;
                epubElementQueryString?: string;
                /**
                 * 0 means no subdirectories will be checked for images
                 * 1 means only the first level of subdirectories will be checked for images
                 * should not be used with direct images (non packed), it will mess up library item
                 * @default 0
                 * 1 for packed manga
                 */
                maxSubdirectoryDepth?: number;
                /**
                 * @default true
                 */
                errorOnInvalid?: boolean;
            },
        ): Promise<boolean> => {
            // Set default values for options
            const {
                mangaPageNumber = 1,
                epubChapterId = "",
                epubElementQueryString = "",
                maxSubdirectoryDepth: maxSubdirectoryDepthOpt,
                errorOnInvalid = true,
            } = options || {};

            let normalizedLink = window.path.normalize(link);
            if (linkInReader === normalizedLink) {
                dispatch(setReaderLoading(null));
                return true;
            }

            let pageNumber = mangaPageNumber;
            let chapterId = epubChapterId;
            let elementQuery = epubElementQueryString;

            if (!window.fs.existsSync(normalizedLink)) {
                /* looks up library row from current store (not a closed-over snapshot) */
                const resolved = await resolveMissingOpenPath(dispatch, normalizedLink);
                if (!resolved) {
                    dispatch(setReaderLoading(null));
                    return false;
                }
                normalizedLink = window.path.normalize(resolved.openPath);
                const page = mangaPageForMissingKind(resolved.kind);
                if (page !== undefined) {
                    pageNumber = page;
                    chapterId = "";
                    elementQuery = "";
                }
            }

            /* resolve after missing-path remap so packed chapter fallbacks get depth 1 */
            const maxSubdirectoryDepth =
                maxSubdirectoryDepthOpt ?? (formatUtils.packedManga.test(normalizedLink) ? 1 : 0);

            window.electron.webFrame.clearCache();

            if (formatUtils.book.test(normalizedLink)) {
                dispatch(setReaderLoading({ message: i18n.t("loading.processingEpub", { ns: "reader" }) }));
                dispatch(
                    setReaderState({
                        type: "book",
                        content: null,
                        link: normalizedLink,
                        mangaPageNumber: 0,
                        epubChapterId: chapterId,
                        epubElementQueryString: elementQuery,
                    }),
                );
                const bookItem = selectLibraryItem(store.getState(), normalizedLink);
                if (bookItem?.type === "book") {
                    /* skip when this title is already bound; chapter/open re-entry is a no-op */
                    if (store.getState().reader.presetSession?.itemLink !== bookItem.link) {
                        await dispatch(ensureReaderPresetSession({ itemLink: bookItem.link, itemType: "book" }));
                    }
                } else {
                    dispatch(setPresetSession(null));
                }
                return true;
            }
            const result = await validateDirectory(normalizedLink, {
                sendImages: true,
                maxSubdirectoryDepth,
                useCache: true,
                showLoading: true,
                errorOnInvalid: false,
            });

            if (result.isValid && result.images) {
                window.cachedImageList = {
                    link: normalizedLink,
                    images: result.images,
                };

                dispatch(
                    setReaderState({
                        type: "manga",
                        content: null,
                        link: normalizedLink,
                        mangaPageNumber: pageNumber,
                    }),
                );
                const mangaItem = selectLibraryItem(store.getState(), normalizedLink);
                if (mangaItem?.type === "manga") {
                    /* skip when this series is already bound; chapter change must not rebuild the session */
                    if (store.getState().reader.presetSession?.itemLink !== mangaItem.link) {
                        await dispatch(ensureReaderPresetSession({ itemLink: mangaItem.link, itemType: "manga" }));
                    }
                } else {
                    dispatch(setPresetSession(null));
                }
                return true;
            }
            dispatch(setReaderLoading(null));
            if (errorOnInvalid) {
                await dialogUtils.customError({
                    title: i18n.t("errors.invalidFolderTitle", { ns: "reader" }),
                    message: i18n.t("errors.invalidFolderMessage", { ns: "reader" }),
                    detail: result.error instanceof Error ? result.error.message : String(result.error),
                });
            }
            return false;
        },
        [dispatch, validateDirectory, linkInReader],
    );

    return {
        validateDirectory,
        openInReaderIfValid,
    };
};
