import { dialogUtils } from "@utils/dialog";
import { formatUtils, unzip } from "@utils/file";
import { renderPDF } from "@utils/pdf";
import type { DirectoryValidatorOptions, ValidationProgressCallback, ValidationResult } from "../types";

export class DirectoryValidatorService {
    /**
     * Sometimes might need to validate the same directory multiple times,
     */
    private static cache = new Map<
        string,
        {
            result: ValidationResult;
            timestamp: number;
            // mtime invalidation might not work on directory cache
            mtime: number;
        }
    >();

    constructor(
        private readonly dependencies: {
            fs: typeof window.fs;
            path: typeof window.path;
            logger: typeof window.logger;
            electron: typeof window.electron;
            app: typeof window.app;
            onProgress: ValidationProgressCallback;
            appSettings: {
                keepExtractedFiles: boolean;
                pdfScale: number;
            };
        },
    ) {}
    private abortController: AbortController | null = null;
    public cancel(): void {
        throw new Error("Not implemented");
        // if (this.abortController) {
        //     this.abortController.abort();
        //     this.abortController = null;
        // }
    }

    // todo: is this overkill?
    private async getCachedResult(link: string): Promise<ValidationResult | null> {
        const cached = DirectoryValidatorService.cache.get(link);
        if (!cached) return null;
        try {
            await this.dependencies.fs.access(link);
            const stats = await this.dependencies.fs.stat(link);
            const currentMtime = stats.mtimeMs;
            if (currentMtime !== cached.mtime) {
                this.dependencies.logger.log(`Cache invalidated for "${link}" due to mtime change`);
                DirectoryValidatorService.cache.delete(link);
                return null;
            }
            const isExpired = Date.now() - cached.timestamp > 5 * 60 * 1000;
            if (isExpired) {
                DirectoryValidatorService.cache.delete(link);
                return null;
            }

            return cached.result;
        } catch (error) {
            this.dependencies.logger.error(`Error checking mtime for "${link}":`, error);
            DirectoryValidatorService.cache.delete(link);
            return null;
        }
    }

    private async setCachedResult(link: string, result: ValidationResult, mtime: number): Promise<void> {
        DirectoryValidatorService.cache.set(link, {
            result,
            timestamp: Date.now(),
            mtime,
        });
        if (DirectoryValidatorService.cache.size > 10) {
            const oldestKey = [...DirectoryValidatorService.cache.entries()].sort(
                (a, b) => a[1].timestamp - b[1].timestamp,
            )[0][0];
            DirectoryValidatorService.cache.delete(oldestKey);
        }
    }

    /**
     * only for debugging
     */
    private logValidationAttempt(
        link: string,
        options: DirectoryValidatorOptions,
        result: ValidationResult,
        duration: number,
    ): void {
        const { logger } = this.dependencies;

        logger.log(
            `Validation ${result.isValid ? "succeeded" : "failed"} for ${link} ` +
                `(took ${duration}ms, options: ${JSON.stringify(options)})`,
        );

        if (!result.isValid && result.error) {
            logger.error(`Validation error: ${result.error}`);
        }
    }

    /**
     * Validates a directory or file to check if it contains readable content
     *
     * DO NOT USE THIS DIRECTLY, USE useDirectoryValidator HOOK INSTEAD
     */
    async validateDirectory(link: string, options: DirectoryValidatorOptions = {}): Promise<ValidationResult> {
        // this.cancel();
        // this.abortController = new AbortController();
        // const { signal } = this.abortController;
        const { useCache = true } = options;

        const startTime = performance.now();
        const stats = await this.dependencies.fs.stat(link);
        const mtime = stats.mtimeMs;
        // console.log(
        //         [...DirectoryValidatorService.cache.entries()].map(([key, value]) => ({ key, value })),
        // );
        const result = await this.validate(link, options);

        if (useCache) {
            this.setCachedResult(link, result, mtime);
        }

        const duration = performance.now() - startTime;
        // dev only
        if (!this.dependencies.electron.app.isPackaged) this.logValidationAttempt(link, options, result, duration);

        return result;
    }
    /**
     * using this instead of directly including validateDirectory to use cache and log properly
     */
    private async validate(link: string, options: DirectoryValidatorOptions = {}): Promise<ValidationResult> {
        options = {
            maxSubdirectoryDepth: options.maxSubdirectoryDepth ?? 1,
            useCache: options.useCache ?? true,
            showLoading: options.showLoading ?? false,
            sendImages: options.sendImages ?? false,
            errorOnInvalid: options.errorOnInvalid ?? true,
        };
        const { maxSubdirectoryDepth, useCache, showLoading } = options;

        const { path, logger, onProgress, appSettings } = this.dependencies;

        if (useCache && appSettings.keepExtractedFiles) {
            const cached = await this.getCachedResult(link);
            if (cached) {
                return cached;
            }
        }

        // only showing loading when it takes some time
        // let loadingTimeout: NodeJS.Timeout | null = null;
        // const loadingTimeoutWait = 200;
        try {
            const normalizedLink = path.normalize(link);
            const linkSplitted = normalizedLink.split(path.sep);

            this.cleanupPreviousTempDir();

            if (showLoading) {
                // loadingTimeout = setTimeout(() => {
                onProgress({
                    // message: "VALIDATING CONTENT",
                    message: "",
                    percent: 1,
                });
                // }, loadingTimeoutWait);
            }

            if (formatUtils.packedManga.test(normalizedLink)) {
                return await this.handlePackedManga(normalizedLink, linkSplitted, options);
            } else if (path.extname(normalizedLink).toLowerCase() === ".pdf") {
                return await this.handlePDF(normalizedLink, linkSplitted, options);
            } else {
                return await this.processDirectory(normalizedLink, maxSubdirectoryDepth, options);
            }
        } catch (error) {
            logger.error("Directory validation failed:", error);
            return {
                isValid: false,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        } finally {
            // if (loadingTimeout) {
            //     clearTimeout(loadingTimeout);
            // }
        }
    }
    /**
     * Cleans up previous temporary directory
     */
    private async cleanupPreviousTempDir(): Promise<void> {
        const { fs, logger, app } = this.dependencies;
        const deleteDirOnClose = app.deleteDirOnClose;
        if (deleteDirOnClose && fs.existsSync(deleteDirOnClose)) {
            try {
                await fs.rm(deleteDirOnClose, { recursive: true });
            } catch (err) {
                logger.error("Failed to remove previous temp directory:", err);
            }
        }
    }

    /**
     * Handles packed manga files (zip, cbz, etc.)
     */
    private async handlePackedManga(
        link: string,
        linkSplitted: string[],
        options: DirectoryValidatorOptions,
    ): Promise<ValidationResult> {
        const { fs, path, logger, electron, app, onProgress, appSettings } = this.dependencies;

        const tempExtractPath = path.join(
            electron.app.getPath("temp"),
            `yomikiru-temp-images-${linkSplitted.at(-1)}`,
        );

        try {
            const sourcePath = path.join(tempExtractPath, "SOURCE");
            const hasExtracted =
                appSettings.keepExtractedFiles &&
                fs.existsSync(sourcePath) &&
                fs.readFileSync(sourcePath, "utf-8") === link;

            if (hasExtracted) {
                logger.log("Found old archive extract.");
                return await this.processDirectory(tempExtractPath, 1, options);
            } else {
                logger.log(`Extracting "${link}" to "${tempExtractPath}"`);

                if (!appSettings.keepExtractedFiles) {
                    app.deleteDirOnClose = tempExtractPath;
                }

                onProgress({
                    message: `EXTRACTING "${linkSplitted.at(-1)?.substring(0, 10)}・・・${formatUtils.files.getExt(
                        link,
                    )}"`,
                });

                try {
                    const result = await unzip(link, tempExtractPath);
                    if (!result.ok) {
                        logger.error(`directoryValidator.ts: Unzip failed: ${result.message}`);
                        throw new Error(result.message);
                    }
                    return await this.processDirectory(tempExtractPath, 1, options);
                } catch (err) {
                    if (options.errorOnInvalid) {
                        if (err instanceof Error && err.message?.includes("spawn unzip ENOENT")) {
                            dialogUtils.customError({
                                message: "Error while extracting.",
                                detail: '"unzip" not found. Please install by using\n"sudo apt install unzip"',
                            });
                        } else {
                            dialogUtils.customError({
                                message: "Error while extracting.",
                                detail: err instanceof Error ? err.message : String(err),
                                log: false,
                            });
                        }
                    }
                    return { isValid: false, error: err instanceof Error ? err : new Error(String(err)) };
                }
            }
        } catch (err) {
            logger.error("An Error occurred while checking/extracting archive:", err);
            return { isValid: false, error: err instanceof Error ? err : new Error(String(err)) };
        }
    }

    private async handlePDF(
        link: string,
        linkSplitted: string[],
        options: DirectoryValidatorOptions,
    ): Promise<ValidationResult> {
        const { fs, path, logger, electron, app, onProgress, appSettings } = this.dependencies;

        const tempExtractPath = path.join(
            electron.app.getPath("temp"),
            `yomikiru-temp-images-scale_${appSettings.pdfScale}-${linkSplitted.at(-1)}`,
        );

        try {
            const sourcePath = path.join(tempExtractPath, "SOURCE");
            const hasRendered =
                appSettings.keepExtractedFiles &&
                fs.existsSync(sourcePath) &&
                fs.readFileSync(sourcePath, "utf-8") === link;

            if (hasRendered) {
                logger.log("Found old rendered pdf.");
                return await this.processDirectory(tempExtractPath, 1, options);
            } else {
                try {
                    if (fs.existsSync(tempExtractPath)) {
                        await fs.rm(tempExtractPath, { recursive: true });
                    }
                    await fs.mkdir(tempExtractPath);
                } catch (err) {
                    logger.error("Failed to prepare PDF extraction directory:", err);
                    return { isValid: false, error: err instanceof Error ? err : new Error(String(err)) };
                }

                logger.log(`Rendering "${link}" at "${tempExtractPath}"`);
                if (!appSettings.keepExtractedFiles) {
                    app.deleteDirOnClose = tempExtractPath;
                }

                onProgress({
                    message: `Rendering "${linkSplitted.at(-1)?.substring(0, 20)}..."`,
                });

                try {
                    await renderPDF(link, tempExtractPath, appSettings.pdfScale, (total, done) => {
                        onProgress({
                            percent: Math.round((done / total) * 100),
                            message: `[${done}/${total}] Rendering "${linkSplitted.at(-1)?.substring(0, 20)}..."`,
                        });
                    });
                    return await this.processDirectory(tempExtractPath, 1, options);
                } catch (err) {
                    logger.error("PDF rendering error:", err);
                    return { isValid: false, error: err instanceof Error ? err : new Error(String(err)) };
                }
            }
        } catch (err) {
            logger.error("An Error occurred while checking/rendering pdf:", err);
            return { isValid: false, error: err instanceof Error ? err : new Error(String(err)) };
        }
    }

    /**
     * Processes a directory to find images.
     * It should get called by other functions after extracting or rendering.
     */
    private async processDirectory(
        link: string,
        maxDepth = 0,
        options: DirectoryValidatorOptions,
    ): Promise<ValidationResult> {
        const { fs, path, logger, onProgress } = this.dependencies;
        const { sendImages = false } = options;

        // let loadingTimeout: NodeJS.Timeout | null = null;
        // const loadingTimeoutWait = 100;
        try {
            const files = await fs.readdir(link);

            if (files.length <= 0) {
                if (options.errorOnInvalid)
                    dialogUtils.customError({
                        title: "No images found",
                        message: "Directory is empty.",
                        detail: link,
                    });
                return { isValid: false, error: "Directory is empty" };
            }

            if (sendImages) {
                //     loadingTimeout = setTimeout(() => {
                onProgress({
                    // message: `PROCESSING IMAGES`,
                    percent: 5,
                });
                //     }, loadingTimeoutWait);
            }

            const imgs = files.filter((e) => formatUtils.image.test(e));
            let processed = 0;
            if (imgs.length <= 0) {
                if (maxDepth > 0) {
                    const dirOnlyPromises = files.map(async (e) => {
                        const fullPath = path.join(link, e);
                        try {
                            const isDirectory = fs.isDir(fullPath);
                            if (isDirectory) {
                                const subDirFiles = await fs.readdir(fullPath);
                                return { path: fullPath, isEmpty: subDirFiles.length === 0 };
                            }
                            return { path: fullPath, isEmpty: true };
                        } catch (err) {
                            logger.error(`Error checking directory ${fullPath}:`, err);
                            return { path: fullPath, isEmpty: true };
                        } finally {
                            processed++;
                            onProgress({
                                percent: Math.round((processed / imgs.length) * 100) / 20,
                            });
                        }
                    });

                    const dirResults = await Promise.all(dirOnlyPromises);
                    const nonEmptyDirs = dirResults.filter((dir) => !dir.isEmpty).map((dir) => dir.path);

                    if (nonEmptyDirs.length > 0) {
                        return await this.processDirectory(nonEmptyDirs[0], maxDepth - 1, options);
                    }
                }

                if (options.errorOnInvalid)
                    dialogUtils.customError({
                        title: "No images found",
                        message: "Directory doesn't contain any supported image format.",
                    });
                return { isValid: false, error: "No supported images found" };
            }

            if (sendImages) {
                const sortedImages = imgs.sort(window.app.betterSortOrder).map((e) => path.join(link, e));

                onProgress({
                    percent: 10,
                });

                return {
                    isValid: true,
                    images: sortedImages,
                };
            }
            return { isValid: true };
        } catch (err) {
            logger.error("Error processing directory:", err);
            return { isValid: false, error: err instanceof Error ? err : new Error(String(err)) };
        } finally {
            // if (loadingTimeout) {
            //     clearTimeout(loadingTimeout);
            // }
        }
    }
}
