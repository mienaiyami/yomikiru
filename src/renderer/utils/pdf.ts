import * as pdfjsLib from "pdfjs-dist/build/pdf.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import worker from "pdfjs-dist/build/pdf.worker.js";
import { dialogUtils } from "./dialog";
pdfjsLib.GlobalWorkerOptions.workerSrc = worker;

// todo improve and make
const renderPDF = async (
    link: string,
    renderPath: string,
    scale: number,
    onUpdate?: (total: number, done: number) => void
): Promise<{ count: number; success: number; renderPath: string; link: string }> => {
    try {
        const loadingTask = pdfjsLib.getDocument(link);

        loadingTask.onPassword = () => {
            dialogUtils.customError({
                message: "PDF is password protected.",
                log: false,
            });
            throw new Error("PDF is password protected.");
        };

        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        let count = 0;
        let success = 0;

        const renderPromises = [];

        for (let i = 1; i <= totalPages; i++) {
            renderPromises.push(
                (async (pageNum) => {
                    try {
                        const page = await pdf.getPage(pageNum);

                        const viewport = page.getViewport({
                            scale: scale || 1.5,
                        });

                        const canvas = document.createElement("canvas");
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;

                        const context = canvas.getContext("2d");
                        if (!context) {
                            throw new Error(`Unable to get canvas context for page ${pageNum}`);
                        }

                        await page.render({
                            canvasContext: context,
                            viewport: viewport,
                            intent: "print",
                        }).promise;

                        page.cleanup();

                        const image = canvas.toDataURL("image/png");

                        canvas.width = 0;
                        canvas.height = 0;

                        const imagePath = window.path.join(renderPath, `./${pageNum}.png`);
                        const imageData = image.replace(/^data:image\/png;base64,/, "");

                        await window.fs.writeFile(imagePath, imageData, "base64");
                        success++;

                        return true;
                    } catch (err) {
                        window.logger.error(`Error rendering PDF page ${pageNum}:`, err);
                        return false;
                    } finally {
                        count++;
                        onUpdate?.(totalPages, count);
                    }
                })(i)
            );
        }

        // Process all pages concurrently
        await Promise.all(renderPromises);

        // Write the source file
        await window.fs.writeFile(window.path.join(renderPath, "SOURCE"), link);

        return { count, success, renderPath, link };
    } catch (err) {
        // Clean up on error
        if (window.fs.existsSync(renderPath)) {
            await window.fs.rm(renderPath, { recursive: true });
        }

        throw {
            message: "PDF Reading Error",
            reason: err instanceof Error ? err.message : String(err),
        };
    }
};

export { renderPDF };
