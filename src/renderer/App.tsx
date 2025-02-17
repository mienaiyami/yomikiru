// import "./MainImports";
import { promptSelectDir, unzip } from "./utils/main";
import { createContext, createRef, ReactElement, useEffect, useLayoutEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";
import { refreshAppSettings, setAppSettings } from "./store/appSettings";
import { setUnzipping } from "./store/unzipping";
import { setLoadingManga } from "./store/isLoadingManga";
import loadingMangaPercent, { setLoadingMangaPercent } from "./store/loadingMangaPercent";
import { setLinkInReader } from "./store/linkInReader";
import {
    refreshHistory,
    updateCurrentHistoryPage,
    updateCurrentBookHistory,
    removeHistory,
    unreadChapter,
    readChapter,
    unreadAllChapter,
} from "./store/history";
import { setReaderOpen } from "./store/isReaderOpen";
import { setMangaInReader } from "./store/mangaInReader";
import { addBookmark, refreshBookmark, removeBookmark } from "./store/bookmarks";
import { refreshThemes, setTheme } from "./store/themes";
import { bookmarksPath, historyPath, settingsPath, themesPath } from "./utils/file";
import { setBookInReader } from "./store/bookInReader";
import { setAniEditOpen } from "./store/isAniEditOpen";
import { setAniLoginOpen } from "./store/isAniLoginOpen";
import { setAniSearchOpen } from "./store/isAniSearchOpen";
import { setAnilistCurrentManga } from "./store/anilistCurrentManga";
import { toggleOpenSetting } from "./store/isSettingOpen";
import { renderPDF } from "./utils/pdf";

interface IAppContext {
    pageNumberInputRef: React.RefObject<HTMLInputElement>;
    bookProgressRef: React.RefObject<HTMLInputElement>;
    /**
     * Check if folder have images then open those images in reader, or open in epub-reader if `.epub`
     * @param link link of folder containing images or epub file.
     */
    openInReader: (
        link: string,
        extra?: {
            mangaPageNumber?: number;
            epubChapterId?: string;
            epubElementQueryString?: string;
        }
    ) => void;
    // addNewBookmark: (newBk: ChapterItem) => Promise<Electron.MessageBoxReturnValue> | undefined;
    closeReader: () => void;
    // updateLastHistoryPageNumber: () => void;
    openInNewWindow: (link: string) => void;
    contextMenuData: IContextMenuData | null;
    setContextMenuData: React.Dispatch<React.SetStateAction<IContextMenuData | null>>;
    optSelectData: IOptSelectData | null;
    setOptSelectData: React.Dispatch<React.SetStateAction<IOptSelectData | null>>;
    colorSelectData: IColorSelectData | null;
    setColorSelectData: React.Dispatch<React.SetStateAction<IColorSelectData | null>>;
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
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const theme = useAppSelector((state) => state.theme.name);

    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const bookProgressRef: React.RefObject<HTMLInputElement> = createRef();
    const [firstRendered, setFirstRendered] = useState(false);
    const [contextMenuData, setContextMenuData] = useState<IContextMenuData | null>(null);
    const [optSelectData, setOptSelectData] = useState<IOptSelectData | null>(null);
    const [colorSelectData, setColorSelectData] = useState<IColorSelectData | null>(null);

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
                    return window.app.formats.image.test(e);
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

        if (window.app.formats.packedManga.test(link)) {
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
                }
            } catch (err) {
                window.logger.error("An Error occurred while checking/extracting archive:", err);
            }
        } else if (window.path.extname(link).toLowerCase() === ".pdf") {
            const tempExtractPath = window.path.join(
                window.electron.app.getPath("temp"),
                `yomikiru-temp-images-scale_${appSettings.readerSettings.pdfScale}-${linkSplitted.at(-1)}`
            );
            try {
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
                    dispatch(
                        setUnzipping({
                            state: true,
                            text: `Rendering "${linkSplitted.at(-1)?.substring(0, 20)}..."`,
                        })
                    );

                    renderPDF(link, tempExtractPath, appSettings.readerSettings.pdfScale, (total, done) =>
                        dispatch(
                            setUnzipping({
                                state: true,
                                text: `[${done}/${total}] Rendering "${linkSplitted.at(-1)?.substring(0, 20)}..."`,
                            })
                        )
                    )
                        .then(() => {
                            tempFn(tempExtractPath, 1);
                        })
                        .catch(({ message, reason }) => {
                            dispatch(setUnzipping(false));
                            console.error(message, reason);
                        });
                }
            } catch (err) {
                window.logger.error("An Error occurred while checking/rendering pdf:", err);
            }
        } else tempFn(link);
    };
    const openInReader = (
        link: string,
        extra?: {
            mangaPageNumber?: number;
            epubChapterId?: string;
            epubElementQueryString?: string;
        }
    ) => {
        link = window.path.normalize(link);
        window.electron.webFrame.clearCache();
        if (link === linkInReader.link) return;
        if (window.app.formats.book.test(link)) {
            dispatch(setUnzipping({ state: true, text: "PROCESSING EPUB" }));

            // dispatch(setLoadingManga(true));
            // dispatch(setLoadingMangaPercent(0));

            dispatch(
                setLinkInReader({
                    type: "book",
                    link: link,
                    page: 0,
                    chapter: "",
                    chapterId: extra?.epubChapterId || "",
                    queryStr: extra?.epubElementQueryString || "",
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
                                page: extra?.mangaPageNumber || 1,
                                chapter: "",
                            })
                        );
                    }
                },
                true
            );
    };

    const closeReader = () => {
        if (window.app.linkInReader && window.app.linkInReader.type === "image")
            dispatch(updateCurrentHistoryPage());
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
        if (link.toLowerCase().includes(".epub") && window.fs.existsSync(link))
            window.electron.ipcRenderer.send("openLinkInNewWindow", link);
        else
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
                appSettings.skipMinorUpdate,
                appSettings.autoDownloadUpdate
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

        const shortcutsMapped = Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<
            ShortcutCommands,
            string[]
        >;
        const eventsOnStart = (e: KeyboardEvent) => {
            const keyStr = window.keyFormatter(e);
            if (keyStr === "") return;
            const i = (keys: string[]) => {
                return keys.includes(keyStr);
            };
            const afterUIScale = () => {
                process.platform === "win32" &&
                    window.electron.getCurrentWindow().setTitleBarOverlay({
                        height: Math.floor(40 * window.electron.webFrame.getZoomFactor()),
                    });
                // page nav/ window btn cont width
                (document.querySelector(".windowBtnCont") as HTMLDivElement).style.right = `${
                    140 * (1 / window.electron.webFrame.getZoomFactor())
                }px`;
            };
            switch (true) {
                case i(shortcutsMapped["navToHome"]):
                    if (window.electron.getCurrentWindow().isFullScreen())
                        window.electron.getCurrentWindow().setFullScreen(false);
                    if (window.app.isReaderOpen) return closeReader();
                    window.location.reload();
                    break;
                case i(shortcutsMapped["openSettings"]):
                    dispatch(toggleOpenSetting());
                    break;
                case i(shortcutsMapped["uiSizeReset"]):
                    window.electron.webFrame.setZoomFactor(1);
                    afterUIScale();
                    break;
                case i(shortcutsMapped["uiSizeDown"]):
                    window.electron.webFrame.setZoomFactor(window.electron.webFrame.getZoomFactor() - 0.1);
                    afterUIScale();
                    break;
                case i(shortcutsMapped["uiSizeUp"]):
                    window.electron.webFrame.setZoomFactor(window.electron.webFrame.getZoomFactor() + 0.1);
                    afterUIScale();
                    break;
                default:
                    break;
            }
        };
        window.addEventListener("keydown", eventsOnStart);

        const filesToWatch = [historyPath, bookmarksPath];
        if (appSettings.syncSettings) filesToWatch.push(settingsPath);
        if (appSettings.syncThemes) filesToWatch.push(themesPath);
        const watcher = window.chokidar.watch(filesToWatch);
        watcher.on("change", (path) => {
            if (path === historyPath) dispatch(refreshHistory());
            if (path === bookmarksPath) dispatch(refreshBookmark());
            if (path === settingsPath) dispatch(refreshAppSettings());
            if (path === themesPath) dispatch(refreshThemes());
        });

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
                    } else if (window.app.formats.files.test(data[0].path)) {
                        closeReader();
                        openInReader(data[0].path);
                    } else if (window.app.formats.image.test(data[0].path.toLowerCase())) {
                        closeReader();
                        openInReader(window.path.dirname(data[0].path));
                    }
                }
            }
        };
        const ee = (e: DragEvent) => e.preventDefault();
        document.addEventListener("dragover", ee);
        document.addEventListener("drop", dropFile);

        window.contextMenu.template = {
            divider() {
                return {
                    label: "",
                    action() {
                        //
                    },
                    divider: true,
                };
            },
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
                    label: "Copy Image",
                    disabled: url ? false : true,
                    action() {
                        window.electron.clipboard.writeImage(
                            window.electron.nativeImage.createFromPath(url.replace("file://", ""))
                        );
                    },
                };
            },
            removeHistory(url) {
                return {
                    label: "Remove",
                    disabled: url ? false : true,
                    action() {
                        dispatch(removeHistory(url));
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
                                    ...data.data,
                                    chapterData: { ...data.data.chapterData },
                                    date: new Date().toLocaleString("en-UK", { hour12: true }),
                                },
                            };
                            dispatch(addBookmark(newItem));
                        }
                    },
                };
            },
            unreadChapter(mangaIndex, chapterIndex) {
                return {
                    label: "Mark as Unread",
                    disabled: mangaIndex >= 0 && chapterIndex >= 0 ? false : true,
                    action() {
                        if (mangaIndex >= 0 && chapterIndex >= 0)
                            dispatch(unreadChapter([mangaIndex, chapterIndex]));
                    },
                };
            },
            readChapter(mangaIndex, chapter) {
                return {
                    label: "Mark as Read",
                    disabled: mangaIndex >= 0 && chapter ? false : true,
                    action() {
                        if (mangaIndex >= 0 && chapter) dispatch(readChapter({ mangaIndex, chapters: [chapter] }));
                    },
                };
            },
            readAllChapter(mangaIndex, chapters) {
                return {
                    label: "Mark All as Read",
                    disabled: mangaIndex >= 0 && chapters.length > 0 ? false : true,
                    action() {
                        if (mangaIndex >= 0 && chapters.length > 0)
                            dispatch(readChapter({ mangaIndex, chapters }));
                    },
                };
            },
            unreadAllChapter(mangaIndex) {
                return {
                    label: "Mark All as Unread",
                    disabled: mangaIndex >= 0 ? false : true,
                    action() {
                        if (mangaIndex >= 0)
                            window.dialog
                                .confirm({
                                    message: "Mark All Chapters as Unread?",
                                    noOption: false,
                                })
                                .then((res) => res.response === 0 && dispatch(unreadAllChapter(mangaIndex)));
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

    useLayoutEffect(() => {
        closeReader();
    }, [appSettings.readerSettings.dynamicLoading]);

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
                optSelectData,
                setOptSelectData,
                colorSelectData,
                setColorSelectData,
            }}
        >
            <TopBar />
            <Main />
        </AppContext.Provider>
    );
};
export default App;
