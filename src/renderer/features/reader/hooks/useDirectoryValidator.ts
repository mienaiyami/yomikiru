import { useCallback } from "react";
import { DirectoryValidatorService } from "../services/directoryValidator";
import { setReaderLoading, setReaderState } from "@store/reader";
import { ValidationResult, DirectoryValidatorOptions } from "../types";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { formatUtils } from "@utils/file";
import { dialogUtils } from "@utils/dialog";

export const useDirectoryValidator = () => {
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((state) => state.appSettings);

    const createValidator = useCallback(() => {
        //todo : fix, its getting called on each open in reader
        return new DirectoryValidatorService({
            fs: window.fs,
            path: window.path,
            logger: window.logger,
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
                // todo: add option to disable loading?
                // dispatch(
                //     setReaderLoading({
                //         percent: 0,
                //         message: "Validating content...",
                //     })
                // );
                const result = await validator.validateDirectory(link, options);

                // dispatch(setReaderLoading(null));

                return result;
            } catch (error) {
                // dispatch(setReaderLoading(null));

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
                 * @default 1
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
                maxSubdirectoryDepth = 1,
                errorOnInvalid = true,
            } = options || {};

            const normalizedLink = window.path.normalize(link);
            window.electron.webFrame.clearCache();

            if (formatUtils.book.test(normalizedLink)) {
                dispatch(setReaderLoading({ percent: 0, message: "Processing EPUB" }));
                dispatch(
                    setReaderState({
                        type: "book",
                        content: null,
                        link: normalizedLink,
                        mangaPageNumber: 0,
                        epubChapterId,
                        epubElementQueryString,
                    }),
                );
                return true;
            }

            const result = await validateDirectory(normalizedLink, {
                sendImages: true,
                maxSubdirectoryDepth,
                useCache: true,
                showLoading: false,
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
                        mangaPageNumber,
                    }),
                );
                return true;
            }
            if (errorOnInvalid) {
                await dialogUtils.customError({
                    title: "Invalid Folder",
                    message: "The folder is not valid. Please check the folder and try again.",
                    detail: result.error instanceof Error ? result.error.message : String(result.error),
                });
            }
            return false;
        },
        [dispatch, validateDirectory],
    );

    return {
        validateDirectory,
        openInReaderIfValid,
    };
};
