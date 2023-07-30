import "./MainImports";
import { createContext, createRef, ReactElement, useEffect, useLayoutEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";
import { setAppSettings } from "./store/appSettings";
import { setUnzipping } from "./store/unzipping";
import { setLoadingManga } from "./store/isLoadingManga";
import loadingMangaPercent, { setLoadingMangaPercent } from "./store/loadingMangaPercent";
import { setLinkInReader } from "./store/linkInReader";
import {
    refreshHistory,
    updateCurrentHistoryPage,
    updateCurrentBookHistory,
    removeHistory,
} from "./store/history";
import { setReaderOpen } from "./store/isReaderOpen";
import { setMangaInReader } from "./store/mangaInReader";
import { addBookmark, refreshBookmark, removeBookmark } from "./store/bookmarks";
import { setTheme } from "./store/themes";
import { bookmarksPath, historyPath, promptSelectDir, renderPDF, unzip } from "./MainImports";
import { setBookInReader } from "./store/bookInReader";
import { setAniEditOpen } from "./store/isAniEditOpen";
import { setAniLoginOpen } from "./store/isAniLoginOpen";
import { setAniSearchOpen } from "./store/isAniSearchOpen";
import { setAnilistCurrentManga } from "./store/anilistCurrentManga";

// window.logger.log("New window opening...");

// todo: why was i exporting this?
// export { themesMain };

interface IAppContext {
    pageNumberInputRef: React.RefObject<HTMLInputElement>;
    bookProgressRef: React.RefObject<HTMLInputElement>;
    openInReader: (link: string, page_or_chapterName?: number | string, elementQueryString?: string) => void;
    // addNewBookmark: (newBk: ChapterItem) => Promise<Electron.MessageBoxReturnValue> | undefined;
    closeReader: () => void;
    // updateLastHistoryPageNumber: () => void;
    openInNewWindow: (link: string) => void;
    contextMenuData: IContextMenuData | null;
    setContextMenuData: React.Dispatch<React.SetStateAction<IContextMenuData | null>>;
    checkValidFolder: (
        link: string,
        callback: (isValid?: boolean, imgs?: string[]) => void,
        sendImgs?: boolean
    ) => void;
}

export const AppContext = createContext<IAppContext>(null!);
const App = (): ReactElement => {
    const appSettings = useAppSelector((state) => state.appSettings);
    const isReaderOpen = useAppSelector((state) => state.isReaderOpen);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);
    const bookInReader = useAppSelector((store) => store.bookInReader);
    const theme = useAppSelector((state) => state.theme.name);

    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const bookProgressRef: React.RefObject<HTMLInputElement> = createRef();
    const [firstRendered, setFirstRendered] = useState(false);
    const [contextMenuData, setContextMenuData] = useState<IContextMenuData | null>(null);

    const dispatch = useAppDispatch();

    useEffect(() => {
        if (firstRendered) {
            if (appSettings.baseDir === "") {
                window.dialog.customError({ message: "No settings found, Select manga folder" });
                promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path as string })));
            }
        } else {
            dispatch(setTheme(theme));
        }
    }, [firstRendered]);
    /**
     * Check if `{link}` has images or is in archive format(zip,cbz).
     * If link is a archive then extract it in temp dir and check for images.
     * @param link link of folder containing images or zip/cbz.
     * @param callback `{imgs}` array of full link of images.
     * @param sendImgs send full images links after done.
     */
    const checkValidFolder = (
        link: string,
        /**
         * `{imgs}` array of full link of images.
         */
        callback: (isValid?: boolean, imgs?: string[]) => void,
        sendImgs?: boolean
    ): void => {
        // ! changing imgs from name to link of image
        // let linkMain = link;
        const tempFn = (link: string, goInAndRetry = 0) =>
            window.fs.readdir(link, (err, files) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                    dispatch(setUnzipping(false));
                    callback(false);
                    return;
                }
                if (files.length <= 0) {
                    window.dialog.customError({
                        title: "No images found",
                        message: "Folder is empty.",
                        detail: link,
                    });
                    dispatch(setUnzipping(false));
                    callback(false);
                    return;
                }
                dispatch(setUnzipping(false));
                if (sendImgs) {
                    dispatch(setLoadingManga(true));
                    dispatch(setLoadingMangaPercent(0));
                }
                const imgs = files.filter((e) => {
                    return window.supportedFormats.includes(window.path.extname(e).toLowerCase());
                });
                if (imgs.length <= 0) {
                    const dirOnly = files.filter(
                        (e) =>
                            window.fs.lstatSync(window.path.join(link, e)).isDirectory() &&
                            window.fs.readdirSync(window.path.join(link, e)).length > 0
                    );
                    if (goInAndRetry > 0 && dirOnly.length > 0) {
                        tempFn(
                            // linkSplitted[linkSplitted.length - 1].replace(/(\.zip|\.cbz)/gi, "")
                            window.path.join(link, dirOnly[0]),
                            goInAndRetry - 1
                        );
                        return;
                    }
                    window.dialog.customError({
                        title: "No images found",
                        message: "Folder doesn't contain any supported image format.",
                        log: false,
                    });
                    dispatch(setLoadingManga(false));
                    callback(false);
                    return;
                }
                if (sendImgs) {
                    callback(
                        true,
                        imgs.sort(window.app.betterSortOrder).map((e) => window.path.join(link, e))
                    );
                    return;
                }
                callback(true);
            });
        const linkSplitted = link.split(window.path.sep);

        if (window.fs.existsSync(window.app.deleteDirOnClose))
            window.fs.rm(
                window.app.deleteDirOnClose,
                {
                    recursive: true,
                },
                (err) => {
                    if (err) window.logger.error(err);
                }
            );

        if ([".zip", ".cbz", ".7z"].includes(window.path.extname(link).toLowerCase())) {
            // const tempExtractPath = window.path.join(
            //     window.electron.app.getPath("temp"),
            //     `yomikiru-temp-Images-${linkSplitted[linkSplitted.length - 1]}-${window.app.randomString(10)}`
            // );
            const tempExtractPath = window.path.join(
                window.electron.app.getPath("temp"),
                `yomikiru-temp-images-${linkSplitted.at(-1)}`
            );
            // if (window.fs.existsSync(tempExtractPath)) {
            //     tempExtractPath += "-1";
            // }
            // window.fs.mkdirSync(tempExtractPath);

            try {
                if (
                    appSettings.keepExtractedFiles &&
                    window.fs.existsSync(window.path.join(tempExtractPath, "SOURCE")) &&
                    window.fs.readFileSync(window.path.join(tempExtractPath, "SOURCE"), "utf-8") === link
                ) {
                    console.log("Found old archive extract.");
                    tempFn(tempExtractPath, 1);
                } else {
                    // moved to ipcHandle:unzip
                    // if (window.fs.existsSync(tempExtractPath))
                    //     window.fs.rmSync(tempExtractPath, { recursive: true });
                    console.log(`Extracting "${link}" to "${tempExtractPath}"`);
                    // window.app.deleteDirOnClose = tempExtractPath;
                    if (!appSettings.keepExtractedFiles) window.app.deleteDirOnClose = tempExtractPath;
                    dispatch(setUnzipping(true));

                    unzip(link, tempExtractPath)
                        .then((res) => {
                            if (res) {
                                tempFn(tempExtractPath, 1);
                            }
                        })
                        .catch((err) => {
                            dispatch(setUnzipping(false));
                            if (err.message.includes("spawn unzip ENOENT"))
                                return window.dialog.customError({
                                    message: "Error while extracting.",
                                    detail: '"unzip" not found. Please install by using\n"sudo apt install unzip"',
                                });
                            return window.dialog.customError({
                                message: "Error while extracting.",
                                detail: err.message,
                                log: false,
                            });
                        });
                    // window.crossZip.unzip(link, tempExtractPath, (err) => {
                    //     if (err) {
                    //         dispatch(setUnzipping(false));
                    //         if (err.message.includes("spawn unzip ENOENT"))
                    //             return window.dialog.customError({
                    //                 message: "Error while extracting.",
                    //                 detail: '"unzip" not found. Please install by using\n"sudo apt install unzip"',
                    //             });
                    //         return window.dialog.customError({
                    //             message: "Error while extracting.",
                    //             detail: err.message,
                    //             log: false,
                    //         });
                    //     }
                    //     tempFn(tempExtractPath, 1);
                    // });
                }
            } catch (err) {
                window.logger.error("An Error occurred while checking/extracting archive:", err);
            }
        } else if (window.path.extname(link).toLowerCase() === ".pdf") {
            // let tempExtractPath = window.path.join(
            //     window.electron.app.getPath("temp"),
            //     `yomikiru-temp-Images-${linkSplitted[linkSplitted.length - 1]}-${window.app.randomString(10)}`
            // );
            const tempExtractPath = window.path.join(
                window.electron.app.getPath("temp"),
                `yomikiru-temp-images-scale_${appSettings.readerSettings.pdfScale}-${linkSplitted.at(-1)}`
            );
            // if (window.fs.existsSync(tempExtractPath)) {
            //     tempExtractPath += "-1";
            // }

            // link =
            //     "http://localhost:48641/stuff/mangas/ln/Eminence%20in%20Shadow/The%20Eminence%20in%20Shadow,%20Vol.%201.pdf";

            try {
                // console.log(
                //     window.fs.existsSync(window.path.join(tempExtractPath, "SOURCE")),
                //     window.fs.readFileSync(window.path.join(tempExtractPath, "SOURCE"), "utf-8"),
                //     link
                // );
                if (
                    appSettings.keepExtractedFiles &&
                    window.fs.existsSync(window.path.join(tempExtractPath, "SOURCE")) &&
                    window.fs.readFileSync(window.path.join(tempExtractPath, "SOURCE"), "utf-8") === link
                ) {
                    console.log("Found old rendered pdf.");
                    tempFn(tempExtractPath, 1);
                } else {
                    if (window.fs.existsSync(tempExtractPath))
                        window.fs.rmSync(tempExtractPath, { recursive: true });
                    window.fs.mkdirSync(tempExtractPath);
                    console.log(`Rendering "${link}" at "${tempExtractPath}"`);
                    if (!appSettings.keepExtractedFiles) window.app.deleteDirOnClose = tempExtractPath;
                    dispatch(setUnzipping(true));

                    // pdf to img starts here

                    // renderPDF(link, tempExtractPath, appSettings.readerSettings.pdfScale)
                    //     .catch((reason) => {
                    //         dispatch(setUnzipping(false));
                    //         console.error("PDF Reading Error:", reason);
                    //     })
                    //     .then((e) => {
                    //         if (e) tempFn(tempExtractPath, 1);
                    //     });
                    if (!window.electron.app.isPackaged)
                        link =
                            "http://localhost:42136/stuff/mangas/ln/Eminence%20in%20Shadow/The%20Eminence%20in%20Shadow,%20Vol.%201.pdf";
                    renderPDF(link, tempExtractPath, appSettings.readerSettings.pdfScale)
                        .then(() => {
                            tempFn(tempExtractPath, 1);
                        })
                        .catch(({ message, reason }) => {
                            dispatch(setUnzipping(false));
                            console.error(message, reason);
                        });
                    // const doc = window.pdfjsLib.getDocument(link);
                    // doc.onPassword = () => {
                    //     window.dialog.customError({
                    //         message: "PDF is password protected.",
                    //     });
                    // };
                    // doc.promise
                    //     .then((pdf) => {
                    //         let count = 0;
                    //         for (let i = 1; i <= pdf.numPages; i++) {
                    //             pdf.getPage(i).then((page) => {
                    //                 const viewport = page.getViewport({
                    //                     scale: appSettings.readerSettings.pdfScale || 1.5,
                    //                 });
                    //                 const canvas = document.createElement("canvas");
                    //                 canvas.width = viewport.width;
                    //                 canvas.height = viewport.height;
                    //                 const context = canvas.getContext("2d");
                    //                 if (context) {
                    //                     // console.log("starting", i);
                    //                     // (async function fun() {
                    //                     //     await page.render({ canvasContext: context, viewport: viewport }).promise;
                    //                     //     const image = canvas.toDataURL("image/png");
                    //                     //     window.fs.writeFile(
                    //                     //         window.path.join(tempExtractPath, "./" + i + ".png"),
                    //                     //         image.replace(/^data:image\/png;base64,/, ""),
                    //                     //         "base64",
                    //                     //         (err) => {
                    //                     //             count++;
                    //                     //             console.log("Made image", i + ".png");
                    //                     //             page.cleanup();
                    //                     //             if (count === pdf.numPages) tempFn(tempExtractPath, 1);
                    //                     //         }
                    //                     //     );
                    //                     // })();
                    //                     const abc = page.render({
                    //                         canvasContext: context,
                    //                         viewport: viewport,
                    //                         intent: "print",
                    //                     });
                    //                     abc.promise.then(() => {
                    //                         const image = canvas.toDataURL("image/png");
                    //                         window.fs.writeFile(
                    //                             window.path.join(tempExtractPath, "./" + i + ".png"),
                    //                             image.replace(/^data:image\/png;base64,/, ""),
                    //                             "base64",
                    //                             (err) => {
                    //                                 if (err) {
                    //                                     console.error(err);
                    //                                 } else console.log("Made image", i + ".png");
                    //                                 count++;
                    //                                 page.cleanup();
                    //                                 if (count === pdf.numPages) {
                    //                                     window.fs.writeFileSync(
                    //                                         window.path.join(tempExtractPath, "SOURCE"),
                    //                                         link
                    //                                     );
                    //                                     tempFn(tempExtractPath, 1);
                    //                                 }
                    //                             }
                    //                         );
                    //                     });
                    //                     // page.render({ canvasContext: context, viewport: viewport }).promise.then(() => {
                    //                     //     const image = canvas.toDataURL("image/png");
                    //                     //     window.fs.writeFileSync(
                    //                     //         window.path.join(tempExtractPath, "./" + i + ".png"),
                    //                     //         image.replace(/^data:image\/png;base64,/, ""),
                    //                     //         "base64"
                    //                     //     );
                    //                     //     count++;
                    //                     //     console.log("Made image", i + ".png");
                    //                     //     page.cleanup();
                    //                     //     if (count === pdf.numPages) tempFn(tempExtractPath, 1);
                    //                     // });
                    //                 }
                    //             });
                    //         }
                    //     })
                    //     .catch((reason) => {
                    //         dispatch(setUnzipping(false));
                    //         if (window.fs.existsSync(tempExtractPath))
                    //             window.fs.rmSync(tempExtractPath, { recursive: true });
                    //         console.error("PDF Reading Error:", reason);
                    //     });
                }
            } catch (err) {
                window.logger.error("An Error occurred while checking/rendering pdf:", err);
            }
        } else tempFn(link);
    };
    /**
     * Check if folder have images then open those images in reader.
     * @param link link of folder containing images to be opened in reader.
     * @param page_or_chapterName pagenumber in case of manga and chapter name in case of epub
     */
    const openInReader = (link: string, page_or_chapterName?: number | string, elementQueryString?: string) => {
        link = window.path.normalize(link);
        window.electron.webFrame.clearCache();
        if (link === linkInReader.link) return;
        if (link.toLowerCase().includes(".epub")) {
            dispatch(setUnzipping(true));

            // dispatch(setLoadingManga(true));
            // dispatch(setLoadingMangaPercent(0));

            dispatch(
                setLinkInReader({
                    type: "book",
                    link: link,
                    page: 0,
                    chapter: page_or_chapterName as string,
                    queryStr: elementQueryString,
                })
            );
        } else
            checkValidFolder(
                link,
                (isValid, imgs) => {
                    if (isValid && imgs) {
                        window.cachedImageList = {
                            link,
                            images: imgs,
                        };
                        dispatch(
                            setLinkInReader({
                                type: "image",
                                link,
                                page: (page_or_chapterName as number) || 1,
                                chapter: "",
                            })
                        );
                    }
                },
                true
            );
    };
    // const updateLastHistoryPageNumber = () => {
    //     if (history.length > 0)
    //         setHistory((init) => {
    //             if (
    //                 (init.length > 0 && init[0] && init[0].link && init[0].link === linkInReader.link) ||
    //                 linkInReader.link === ""
    //             ) {
    //                 init[0].page = window.app.currentPageNumber;
    //                 return [...init];
    //             }
    //             return init;
    //         });
    // };

    const closeReader = () => {
        // console.log(linkInReader, window.app.linkInReader);
        // console.log(window.app.linkInReader);
        if (mangaInReader) dispatch(updateCurrentHistoryPage());
        if (window.app.linkInReader && window.app.linkInReader.type === "book")
            dispatch(updateCurrentBookHistory());
        dispatch(setReaderOpen(false));
        dispatch(setLinkInReader({ type: "", link: "", page: 1, chapter: "" }));
        dispatch(setLoadingManga(false));
        dispatch(setAnilistCurrentManga(null));
        dispatch(setAniEditOpen(false));
        dispatch(setAniLoginOpen(false));
        dispatch(setAniSearchOpen(false));
        dispatch(setLoadingMangaPercent(0));
        dispatch(setMangaInReader(null));
        dispatch(setBookInReader(null));

        if (window.fs.existsSync(window.app.deleteDirOnClose))
            window.fs.rm(
                window.app.deleteDirOnClose,
                {
                    recursive: true,
                },
                (err) => {
                    if (err) window.logger.error(err);
                }
            );

        document.body.classList.remove("zenMode");
        if (window.electron.getCurrentWindow().isFullScreen())
            window.electron.getCurrentWindow().setFullScreen(false);
        setTimeout(() => {
            window.electron.webFrame.clearCache();
            window.electron.webFrame.clearCache();
        }, 1000);
    };

    const openInNewWindow = (link: string) => {
        checkValidFolder(
            link,
            (isValid) => {
                if (isValid) window.electron.ipcRenderer.send("openLinkInNewWindow", link);
            },
            false
        );
    };

    useLayoutEffect(() => {
        window.electron.ipcRenderer.send("addDirToDlt", window.app.deleteDirOnClose);
        return () => {
            window.electron.ipcRenderer.removeAllListeners("addDirToDlt");
        };
    }, [window.app.deleteDirOnClose]);

    useLayoutEffect(() => {
        // loading custom stylesheet
        const elem = document.head.querySelector("#customStylesheet");
        if (appSettings.customStylesheet && !elem) {
            if (window.fs.existsSync(appSettings.customStylesheet)) {
                {
                    window.logger.log("Loading custom stylesheet from ", appSettings.customStylesheet);
                    const stylesheet = document.createElement("link");
                    stylesheet.rel = "stylesheet";
                    stylesheet.href = appSettings.customStylesheet;
                    stylesheet.id = "customStylesheet";
                    document.head.appendChild(stylesheet);
                }
            }
        } else if (elem) {
            window.logger.log("Removing custom stylesheet.");
            document.head.removeChild(elem);
        }
    }, [appSettings.customStylesheet]);

    useEffect(() => {
        setFirstRendered(true);
        window.electron.ipcRenderer.on("loadMangaFromLink", (e, data) => {
            if (data && typeof data.link === "string" && data.link !== "") openInReader(data.link);
        });
        window.electron.ipcRenderer.send("askBeforeClose", appSettings.askBeforeClosing);
        window.electron.ipcRenderer.on("checkForUpdate:query", () => {
            window.electron.ipcRenderer.send(
                "checkForUpdate:response",
                appSettings.updateCheckerEnabled,
                window.electron.getCurrentWindow().id,
                appSettings.skipMinorUpdate
            );
        });
        window.electron.ipcRenderer.on("askBeforeClose:query", () => {
            window.electron.ipcRenderer.send("askBeforeClose:response", appSettings.askBeforeClosing);
        });
        window.electron.ipcRenderer.on("recordPageNumber", () => {
            // window.logger.log("received recordPageNumber");
            if (isReaderOpen) closeReader();
            else if (window.app.linkInReader.link !== "") {
                if (window.app.linkInReader.type === "image") dispatch(updateCurrentHistoryPage());
                else dispatch(updateCurrentBookHistory());
            }
            window.electron.ipcRenderer.send("destroyWindow");
        });
        window.app.titleBarHeight = parseFloat(
            window.getComputedStyle(document.body).getPropertyValue("--titleBar-height")
        );
        // here bcoz reload doesnt make window exit fullscreen
        if (window.electron.getCurrentWindow().isFullScreen())
            window.electron.getCurrentWindow().setFullScreen(false);
        const eventsOnStart = (e: KeyboardEvent) => {
            if (e.key === "h") {
                if (window.electron.getCurrentWindow().isFullScreen())
                    window.electron.getCurrentWindow().setFullScreen(false);

                if (window.app.isReaderOpen) return closeReader();
                window.location.reload();
            }
            // if (process.platform === "win32")
            if (e.ctrlKey && (e.key === "=" || e.key === "-" || e.key === "0")) {
                setTimeout(() => {
                    window.electron.getCurrentWindow().setTitleBarOverlay({
                        height: Math.floor(40 * window.electron.webFrame.getZoomFactor()),
                    });
                    // page nav/ window btn cont width
                    (document.querySelector(".windowBtnCont") as HTMLDivElement).style.right = `${
                        140 * (1 / window.electron.webFrame.getZoomFactor())
                    }px`;
                }, 1000);
            }
        };

        // watching for file changes;
        const watcher = window.chokidar.watch([historyPath, bookmarksPath]);
        watcher.on("change", (path) => {
            // todo: make it to ignore first call if another called within 2sec
            setTimeout(() => {
                if (path === historyPath) dispatch(refreshHistory());
                if (path === bookmarksPath) dispatch(refreshBookmark());
            }, 1500);
        });

        window.addEventListener("keydown", eventsOnStart);

        const dropFile = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                const data = e.dataTransfer.files;
                if (data.length > 0) {
                    if (!window.fs.existsSync(data[0].path)) return;
                    if (window.app.linkInReader && window.app.linkInReader.link === data[0].path) return;
                    if (data.length > 1)
                        window.dialog.customError({
                            message: "More than one file/folder dropped. Only first in list will be loaded.",
                        });
                    if (window.fs.lstatSync(data[0].path).isDirectory()) {
                        closeReader();
                        openInReader(data[0].path);
                    } else if (
                        [".zip", ".7z", ".cbz", ".epub", ".pdf"].includes(
                            window.path.extname(data[0].path.toLowerCase())
                        )
                    ) {
                        closeReader();
                        openInReader(data[0].path);
                    } else if (window.supportedFormats.includes(window.path.extname(data[0].path.toLowerCase()))) {
                        closeReader();
                        openInReader(window.path.dirname(data[0].path));
                    }
                }
            }
        };
        const ee = (e: DragEvent) => e.preventDefault();
        document.addEventListener("dragover", ee);
        document.addEventListener("drop", dropFile);

        // setInterval(() => {
        //     // window.electron.ipcRenderer.send("abc");
        //     console.log("dddddddddd");
        // }, 1000);
        window.contextMenuTemplate = {
            open(url) {
                return {
                    label: "Open",
                    disabled: url ? false : true,
                    action() {
                        openInReader(url);
                    },
                };
            },
            openInNewWindow(url) {
                return {
                    label: "Open in new Window",
                    disabled: url ? false : true,
                    action() {
                        openInNewWindow(url);
                    },
                };
            },
            showInExplorer(url) {
                return {
                    label: "Show in File Explorer",
                    disabled: url ? false : true,
                    action() {
                        if (process.platform === "win32") window.electron.shell.showItemInFolder(url || "");
                        else if (process.platform === "linux")
                            window.electron.ipcRenderer.send("showInExplorer", url);
                    },
                };
            },
            copyPath(url) {
                return {
                    label: "Copy Path",
                    disabled: url ? false : true,
                    action() {
                        window.electron.clipboard.writeText(url);
                    },
                };
            },
            copyImage(url) {
                return {
                    label: "Copy",
                    disabled: url ? false : true,
                    action() {
                        window.electron.clipboard.writeImage(window.electron.nativeImage.createFromPath(url));
                    },
                };
            },
            removeHistory(index) {
                return {
                    label: "Remove",
                    disabled: index >= 0 ? false : true,
                    action() {
                        dispatch(removeHistory(index));
                    },
                };
            },
            removeBookmark(url) {
                return {
                    label: "Remove Bookmark",
                    disabled: url ? false : true,
                    action() {
                        dispatch(removeBookmark(url));
                    },
                };
            },
            addToBookmark(data) {
                return {
                    label: "Add to Bookmarks",
                    disabled: data ? false : true,
                    action() {
                        if (data.type === "image") {
                            const newItem: Manga_BookItem = {
                                type: "image",
                                data: {
                                    mangaName: data.data.mangaName,
                                    chapterName: data.data.chapterName,
                                    pages: data.data.pages,
                                    page: data.data.page,
                                    link: data.data.link,
                                    date: new Date().toLocaleString("en-UK", { hour12: true }),
                                },
                            };
                            dispatch(addBookmark(newItem));
                        }
                        if (data.type === "book") {
                            const newItem: Manga_BookItem = {
                                type: "book",
                                data: {
                                    author: data.data.author,
                                    link: data.data.link,
                                    title: data.data.title,
                                    chapter: data.data.chapter || "",
                                    elementQueryString: data.data.elementQueryString || "",
                                    date: new Date().toLocaleString("en-UK", { hour12: true }),
                                },
                            };
                            dispatch(addBookmark(newItem));
                        }
                    },
                };
            },
        };

        return () => {
            window.removeEventListener("keydown", eventsOnStart);
            watcher.removeAllListeners();
            window.electron.ipcRenderer.removeAllListeners("loadMangaFromLink");
            window.electron.ipcRenderer.removeAllListeners("setWindowIndex");
            window.electron.ipcRenderer.removeAllListeners("checkForUpdate:query");
            window.electron.ipcRenderer.removeAllListeners("askBeforeClose:query");
            window.electron.ipcRenderer.removeAllListeners("recordPageNumber");
            document.removeEventListener("drop", dropFile);
            document.removeEventListener("dragover", ee);
        };
    }, []);

    // useLayoutEffect(() => {
    //     if (appSettings.reducedMotion) document.body.classList.add("reducedMotion");
    //     else document.body.classList.remove("reducedMotion");
    // }, [appSettings.reducedMotion]);

    return (
        <AppContext.Provider
            value={{
                pageNumberInputRef,
                bookProgressRef,
                openInReader,
                closeReader,
                openInNewWindow,
                checkValidFolder,
                contextMenuData,
                setContextMenuData,
            }}
        >
            <TopBar />
            <Main />
        </AppContext.Provider>
    );
};
export default App;
