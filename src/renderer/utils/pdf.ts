import * as pdfjsLib from "pdfjs-dist/build/pdf.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import worker from "pdfjs-dist/build/pdf.worker.js";
pdfjsLib.GlobalWorkerOptions.workerSrc = worker;

const renderPDF = (
    link: string,
    renderPath: string,
    scale: number,
    onUpdate?: (total: number, done: number) => void
) => {
    return new Promise(
        (
            res: (result: { count: number; success: number; renderPath: string; link: string }) => void,
            rej: (reason: { message: string; reason?: string }) => void
        ) => {
            const doc = window.pdfjsLib.getDocument(link);
            doc.onPassword = () => {
                window.dialog.customError({
                    message: "PDF is password protected.",
                    log: false,
                });
                rej({ message: "PDF is password protected." });
            };
            doc.promise
                .then((pdf) => {
                    let count = 0;
                    let success = 0;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        pdf.getPage(i).then((page) => {
                            const viewport = page.getViewport({
                                scale: scale || 1.5,
                            });
                            const canvas = document.createElement("canvas");
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            const context = canvas.getContext("2d");
                            if (context) {
                                // console.log("starting", i);
                                const abc = page.render({
                                    canvasContext: context,
                                    viewport: viewport,
                                    intent: "print",
                                });
                                abc.promise.then(() => {
                                    page.cleanup();
                                    const image = canvas.toDataURL("image/png");
                                    canvas.width = 0;
                                    canvas.width = 0;
                                    window.fs.writeFile(
                                        window.path.join(renderPath, "./" + i + ".png"),
                                        image.replace(/^data:image\/png;base64,/, ""),
                                        "base64",
                                        (err) => {
                                            if (err) {
                                                console.error(err);
                                            } else {
                                                // console.log("Made image", i + ".png");
                                                success++;
                                            }
                                            count++;
                                            onUpdate && onUpdate(pdf.numPages, count);
                                            if (count === pdf.numPages) {
                                                window.fs.writeFileSync(
                                                    window.path.join(renderPath, "SOURCE"),
                                                    link
                                                );
                                                res({ count, success, renderPath, link });
                                            }
                                        }
                                    );
                                });
                            }
                        });
                    }
                })
                .catch((reason) => {
                    if (window.fs.existsSync(renderPath)) window.fs.rmSync(renderPath, { recursive: true });
                    rej({ message: "PDF Reading Error", reason });
                });
        }
    );
};

export { renderPDF };
