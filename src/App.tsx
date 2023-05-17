import "./MainImports";
import { createContext, createRef, ReactElement, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";
import { setAppSettings } from "./store/appSettings";
import { setUnzipping } from "./store/unzipping";
import { setLoadingManga } from "./store/isLoadingManga";
import { setLoadingMangaPercent } from "./store/loadingMangaPercent";
import { setLinkInReader } from "./store/linkInReader";
import { refreshHistory, updateCurrentHistoryPage, updateCurrentBookHistory } from "./store/history";
import { setReaderOpen } from "./store/isReaderOpen";
import { setMangaInReader } from "./store/mangaInReader";
import { refreshBookmark } from "./store/bookmarks";
import { setTheme } from "./store/themes";
import { bookmarksPath, historyPath, promptSelectDir } from "./MainImports";
import { setBookInReader } from "./store/bookInReader";

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
    // const bookInReader = useAppSelector((store) => store.bookInReader);
    const theme = useAppSelector((state) => state.theme.name);

    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const bookProgressRef: React.RefObject<HTMLInputElement> = createRef();
    const [firstRendered, setFirstRendered] = useState(false);

    const dispatch = useAppDispatch();

    useEffect(() => {
        if (firstRendered) {
            if (appSettings.baseDir === "") {
                window.dialog.customError({ message: "No settings found, Select manga folder" });
                promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path })));
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
                    if (
                        goInAndRetry > 0 &&
                        files.length <= 1 &&
                        window.fs.lstatSync(window.path.join(link, files[0])).isDirectory()
                    ) {
                        tempFn(
                            // linkSplitted[linkSplitted.length - 1].replace(/(\.zip|\.cbz)/gi, "")
                            window.path.join(link, files[0]),
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
            window.fs.rmSync(window.app.deleteDirOnClose, {
                recursive: true,
            });

        if ([".zip", ".cbz"].includes(window.path.extname(link).toLowerCase())) {
            let tempExtractPath = window.path.join(
                window.electron.app.getPath("temp"),
                `yomikiru-temp-Images-${linkSplitted[linkSplitted.length - 1]}-${window.app.randomString(10)}`
            );
            if (window.fs.existsSync(tempExtractPath)) {
                tempExtractPath += "-1";
            }
            // window.fs.mkdirSync(tempExtractPath);
            console.log(`Extracting "${link}" to "${tempExtractPath}"`);
            window.app.deleteDirOnClose = tempExtractPath;
            dispatch(setUnzipping(true));
            window.crossZip.unzip(link, tempExtractPath, (err) => {
                if (err) {
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
                }
                tempFn(tempExtractPath, 1);
            });
        } else tempFn(link);
    };
    /**
     * Check if folder have images then open those images in reader.
     * @param link link of folder containing images to be opened in reader.
     * @param page_or_chapterName pagenumber in case of manga and chapter name in case of epub
     */
    const openInReader = (link: string, page_or_chapterName?: number | string, elementQueryString?: string) => {
        link = window.path.normalize(link);
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
        if (mangaInReader) dispatch(updateCurrentHistoryPage());
        // if (bookInReader) dispatch(updateCurrentBookHistory());
        dispatch(setReaderOpen(false));
        dispatch(setLinkInReader({ type: "", link: "", page: 1, chapter: "" }));
        dispatch(setLoadingManga(false));
        dispatch(setLoadingMangaPercent(0));
        dispatch(setMangaInReader(null));
        dispatch(setBookInReader(null));

        if (window.fs.existsSync(window.app.deleteDirOnClose))
            window.fs.rmSync(window.app.deleteDirOnClose, {
                recursive: true,
            });

        document.body.classList.remove("zenMode");
        if (document.fullscreenElement) document.exitFullscreen();
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
    useEffect(() => {
        setFirstRendered(true);
        window.electron.ipcRenderer.on("loadMangaFromLink", (e, data) => {
            if (data && typeof data.link === "string" && data.link !== "") openInReader(data.link);
        });
        window.electron.ipcRenderer.on("setWindowIndex", (e, data) => {
            window.electron.ipcRenderer.send(
                "askBeforeClose",
                window.electron.getCurrentWindow().id,
                appSettings.askBeforeClosing,
                data
            );
        });
        window.electron.ipcRenderer.on("canCheckForUpdate", () => {
            window.electron.ipcRenderer.send(
                "canCheckForUpdate_response",
                appSettings.updateCheckerEnabled,
                window.electron.getCurrentWindow().id,
                appSettings.skipMinorUpdate
            );
        });
        window.electron.ipcRenderer.on("recordPageNumber", () => {
            if (isReaderOpen) closeReader();
            else if (window.app.linkInReader.link !== "") dispatch(updateCurrentHistoryPage());
        });
        window.app.titleBarHeight = parseFloat(
            window.getComputedStyle(document.body).getPropertyValue("--titleBar-height")
        );
        const eventsOnStart = (e: KeyboardEvent) => {
            if (e.key === "h") {
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

        // loading custom stylesheet
        if (appSettings.customStylesheet) {
            if (
                window.fs.existsSync(appSettings.customStylesheet) &&
                window.path.extname(appSettings.customStylesheet).toLowerCase() === ".css"
            ) {
                if (!document.head.querySelector("#customStylesheet")) {
                    window.logger.log("Loading custom stylesheet from ", appSettings.customStylesheet);
                    const stylesheet = document.createElement("link");
                    stylesheet.rel = "stylesheet";
                    stylesheet.href = appSettings.customStylesheet;
                    stylesheet.id = "customStylesheet";
                    document.head.appendChild(stylesheet);
                }
            }
        }

        return () => {
            removeEventListener("keydown", eventsOnStart);
            watcher.removeAllListeners();
            window.electron.ipcRenderer.removeAllListeners("loadMangaFromLink");
            window.electron.ipcRenderer.removeAllListeners("setWindowIndex");
            window.electron.ipcRenderer.removeAllListeners("canCheckForUpdate");
            window.electron.ipcRenderer.removeAllListeners("recordPageNumber");
        };
    }, []);

    return (
        <AppContext.Provider
            value={{
                pageNumberInputRef,
                bookProgressRef,
                openInReader,
                closeReader,
                openInNewWindow,
                checkValidFolder,
            }}
        >
            <TopBar />
            <Main />
        </AppContext.Provider>
    );
};
export default App;
