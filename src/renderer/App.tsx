import { createContext, createRef, ReactElement, useEffect, useLayoutEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import Main from "./components/Main";
import TopBar from "./components/TopBar";
import { refreshAppSettings, setAppSettings } from "@store/appSettings";
import { setUnzipping } from "@store/unzipping";
import { setLoadingManga } from "@store/isLoadingManga";
import { setLoadingMangaPercent } from "@store/loadingMangaPercent";
import { setLinkInReader } from "@store/linkInReader";
import { setReaderOpen } from "@store/isReaderOpen";
import { setMangaInReader } from "@store/mangaInReader";
import { addBookmark, fetchAllBookmarks, removeBookmark } from "@store/bookmarks";
import { refreshThemes, setTheme } from "@store/themes";
import {
    bookmarksPath,
    formatUtils,
    historyPath,
    promptSelectDir,
    settingsPath,
    themesPath,
    unzip,
} from "./utils/file";
import { setBookInReader } from "@store/bookInReader";
import { setAniEditOpen } from "@store/isAniEditOpen";
import { setAniLoginOpen } from "@store/isAniLoginOpen";
import { setAniSearchOpen } from "@store/isAniSearchOpen";
import { setAnilistCurrentManga } from "@store/anilistCurrentManga";
import { toggleOpenSetting } from "@store/isSettingOpen";
import { renderPDF } from "@utils/pdf";
import {
    fetchAllItemsWithProgress,
    updateBookProgress,
    updateChaptersRead,
    updateChaptersReadAll,
    updateCurrentBookProgress,
    updateMangaProgress,
} from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { keyFormatter } from "@utils/keybindings";

interface AppContext {
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
    contextMenuData: Menu.ContextMenuData | null;
    setContextMenuData: React.Dispatch<React.SetStateAction<Menu.ContextMenuData | null>>;
    optSelectData: Menu.OptSelectData | null;
    setOptSelectData: React.Dispatch<React.SetStateAction<Menu.OptSelectData | null>>;
    colorSelectData: Menu.ColorSelectData | null;
    setColorSelectData: React.Dispatch<React.SetStateAction<Menu.ColorSelectData | null>>;
    checkValidFolder: (
        link: string,
        callback: (isValid?: boolean, imgs?: string[]) => void,
        sendImgs?: boolean
    ) => void;
}

export const AppContext = createContext<AppContext>(null!);
const App = (): ReactElement => {
    const appSettings = useAppSelector((state) => state.appSettings);
    const isReaderOpen = useAppSelector((state) => state.isReaderOpen);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const theme = useAppSelector((state) => state.theme.name);

    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const bookProgressRef: React.RefObject<HTMLInputElement> = createRef();
    const [firstRendered, setFirstRendered] = useState(false);
    const [contextMenuData, setContextMenuData] = useState<Menu.ContextMenuData | null>(null);
    const [optSelectData, setOptSelectData] = useState<Menu.OptSelectData | null>(null);
    const [colorSelectData, setColorSelectData] = useState<Menu.ColorSelectData | null>(null);

    const dispatch = useAppDispatch();

    useEffect(() => {
        if (firstRendered) {
            if (appSettings.baseDir === "") {
                dialogUtils.customError({ message: "No settings found, Select manga folder" });
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
    const checkValidFolder = async (
        link: string,
        /**
         * `{imgs}` array of full link of images.
         */
        callback: (isValid?: boolean, imgs?: string[]) => void,
        sendImgs?: boolean
    ): Promise<void> => {
        // Convert callback-style function to async/await pattern
        const processDirectory = async (link: string, goInAndRetry = 0): Promise<void> => {
            try {
                const files = await window.fs.readdir(link);

                if (files.length <= 0) {
                    dialogUtils.customError({
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

                const imgs = files.filter((e) => formatUtils.image.test(e));

                if (imgs.length <= 0) {
                    // Check for subdirectories with content
                    const dirOnlyPromises = files.map(async (e) => {
                        const fullPath = window.path.join(link, e);
                        try {
                            const isDirectory = await window.fs.isDir(fullPath);
                            if (isDirectory) {
                                const subDirFiles = await window.fs.readdir(fullPath);
                                return { path: fullPath, isEmpty: subDirFiles.length === 0 };
                            }
                            return { path: fullPath, isEmpty: true };
                        } catch (err) {
                            window.logger.error(`Error checking directory ${fullPath}:`, err);
                            return { path: fullPath, isEmpty: true };
                        }
                    });

                    const dirResults = await Promise.all(dirOnlyPromises);
                    const nonEmptyDirs = dirResults.filter((dir) => !dir.isEmpty).map((dir) => dir.path);

                    if (goInAndRetry > 0 && nonEmptyDirs.length > 0) {
                        return processDirectory(nonEmptyDirs[0], goInAndRetry - 1);
                    }

                    dialogUtils.customError({
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
            } catch (err) {
                window.logger.error("Error processing directory:", err);
                dispatch(setUnzipping(false));
                callback(false);
            }
        };

        try {
            const linkSplitted = link.split(window.path.sep);

            // Clean up previous temp directory if exists
            if (window.fs.existsSync(window.app.deleteDirOnClose)) {
                try {
                    await window.fs.rm(window.app.deleteDirOnClose, { recursive: true });
                } catch (err) {
                    window.logger.error("Failed to remove previous temp directory:", err);
                }
            }

            if (formatUtils.packedManga.test(link)) {
                const tempExtractPath = window.path.join(
                    window.electron.app.getPath("temp"),
                    `yomikiru-temp-images-${linkSplitted.at(-1)}`
                );

                try {
                    // Check if we already have extracted this archive
                    const sourcePath = window.path.join(tempExtractPath, "SOURCE");
                    const hasExtracted =
                        appSettings.keepExtractedFiles &&
                        window.fs.existsSync(sourcePath) &&
                        window.fs.readFileSync(sourcePath, "utf-8") === link;

                    if (hasExtracted) {
                        console.log("Found old archive extract.");
                        await processDirectory(tempExtractPath, 1);
                    } else {
                        console.log(`Extracting "${link}" to "${tempExtractPath}"`);
                        if (!appSettings.keepExtractedFiles) {
                            window.app.deleteDirOnClose = tempExtractPath;
                        }
                        dispatch(setUnzipping(true));

                        try {
                            const result = await unzip(link, tempExtractPath);
                            if (result) {
                                await processDirectory(tempExtractPath, 1);
                            }
                        } catch (err) {
                            dispatch(setUnzipping(false));
                            if (err instanceof Error)
                                if (err.message?.includes("spawn unzip ENOENT")) {
                                    dialogUtils.customError({
                                        message: "Error while extracting.",
                                        detail: '"unzip" not found. Please install by using\n"sudo apt install unzip"',
                                    });
                                } else {
                                    dialogUtils.customError({
                                        message: "Error while extracting.",
                                        detail: err.message || String(err),
                                        log: false,
                                    });
                                }
                            callback(false);
                        }
                    }
                } catch (err) {
                    window.logger.error("An Error occurred while checking/extracting archive:", err);
                    callback(false);
                }
            } else if (window.path.extname(link).toLowerCase() === ".pdf") {
                const tempExtractPath = window.path.join(
                    window.electron.app.getPath("temp"),
                    `yomikiru-temp-images-scale_${appSettings.readerSettings.pdfScale}-${linkSplitted.at(-1)}`
                );

                try {
                    // Check if we already have rendered this PDF
                    const sourcePath = window.path.join(tempExtractPath, "SOURCE");
                    const hasRendered =
                        appSettings.keepExtractedFiles &&
                        window.fs.existsSync(sourcePath) &&
                        window.fs.readFileSync(sourcePath, "utf-8") === link;

                    if (hasRendered) {
                        console.log("Found old rendered pdf.");
                        await processDirectory(tempExtractPath, 1);
                    } else {
                        try {
                            if (window.fs.existsSync(tempExtractPath)) {
                                await window.fs.rm(tempExtractPath, { recursive: true });
                            }
                            await window.fs.mkdir(tempExtractPath);
                        } catch (err) {
                            window.logger.error("Failed to prepare PDF extraction directory:", err);
                            callback(false);
                            return;
                        }

                        console.log(`Rendering "${link}" at "${tempExtractPath}"`);
                        if (!appSettings.keepExtractedFiles) {
                            window.app.deleteDirOnClose = tempExtractPath;
                        }

                        dispatch(
                            setUnzipping({
                                state: true,
                                text: `Rendering "${linkSplitted.at(-1)?.substring(0, 20)}..."`,
                            })
                        );

                        try {
                            await renderPDF(
                                link,
                                tempExtractPath,
                                appSettings.readerSettings.pdfScale,
                                (total, done) =>
                                    dispatch(
                                        setUnzipping({
                                            state: true,
                                            text: `[${done}/${total}] Rendering "${linkSplitted
                                                .at(-1)
                                                ?.substring(0, 20)}..."`,
                                        })
                                    )
                            );
                            await processDirectory(tempExtractPath, 1);
                        } catch (err) {
                            dispatch(setUnzipping(false));
                            window.logger.error("PDF rendering error:", err);
                            callback(false);
                        }
                    }
                } catch (err) {
                    window.logger.error("An Error occurred while checking/rendering pdf:", err);
                    callback(false);
                }
            } else {
                await processDirectory(link);
            }
        } catch (err) {
            window.logger.error("checkValidFolder failed:", err);
            dispatch(setUnzipping(false));
            callback(false);
        }
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
        if (formatUtils.book.test(link)) {
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
        // todo:  use ipc to update db and take data from react state
        if (window.app.linkInReader && window.app.linkInReader.type === "image")
            dispatch(
                updateMangaProgress({
                    itemLink: window.path.dirname(window.app.linkInReader.link),
                    data: {
                        currentPage: window.app.currentPageNumber,
                        chapterLink: window.app.linkInReader.link,
                        chapterName: window.app.linkInReader.chapter,
                        lastReadAt: new Date(),
                    },
                })
            );
        if (window.app.linkInReader && window.app.linkInReader.type === "book")
            dispatch(
                updateBookProgress({
                    itemLink: window.app.linkInReader.link,
                    data: {
                        chapterId: window.app.linkInReader.chapterId,
                        chapterName: window.app.linkInReader.chapter,
                        position: window.app.linkInReader.queryStr,
                        lastReadAt: new Date(),
                    },
                })
            );
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
            window.fs.rm(window.app.deleteDirOnClose, {
                recursive: true,
            });

        document.body.classList.remove("zenMode");
        if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);
        setTimeout(() => {
            window.electron.webFrame.clearCache();
            window.electron.webFrame.clearCache();
        }, 1000);
    };

    const openInNewWindow = (link: string) => {
        if (link.toLowerCase().includes(".epub") && window.fs.existsSync(link))
            window.electron.send("window:openLinkInNewWindow", link);
        else
            checkValidFolder(
                link,
                (isValid) => {
                    if (isValid) window.electron.send("window:openLinkInNewWindow", link);
                },
                false
            );
    };

    useLayoutEffect(() => {
        if (window.app.deleteDirOnClose)
            window.electron.send("window:addDirToDelete", window.app.deleteDirOnClose);
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
        const abortController = new AbortController();
        const signal = abortController.signal;
        const listeners: (() => void)[] = [];
        setFirstRendered(true);
        dispatch(fetchAllItemsWithProgress());
        dispatch(fetchAllBookmarks());
        listeners.push(
            window.electron.on("reader:loadLink", ({ link }) => {
                if (link) openInReader(link);
            })
        );
        window.electron.send("window:askBeforeClose:response", appSettings.askBeforeClosing);
        listeners.push(
            window.electron.on("update:check:query", () => {
                window.electron.send("update:check:response", {
                    autoDownload: appSettings.autoDownloadUpdate,
                    enabled: appSettings.updateCheckerEnabled,
                    skipMinor: appSettings.skipMinorUpdate,
                });
            })
        );
        listeners.push(
            window.electron.on("window:askBeforeClose:query", () => {
                window.electron.send("window:askBeforeClose:response", appSettings.askBeforeClosing);
            })
        );
        //todo update
        listeners.push(
            window.electron.on("reader:recordPage", () => {
                // window.logger.log("received recordPageNumber");
                if (isReaderOpen) closeReader();
                else if (window.app.linkInReader.link !== "") {
                    //todo
                    if (window.app.linkInReader.type === "image") dispatch();
                    else dispatch(updateCurrentBookProgress());
                }
                window.electron.send("window:destroy");
            })
        );
        window.app.titleBarHeight = parseFloat(
            window.getComputedStyle(document.body).getPropertyValue("--titleBar-height")
        );
        // here bcoz reload doesnt make window exit fullscreen
        if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);

        const shortcutsMapped = Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<
            ShortcutCommands,
            string[]
        >;
        const eventsOnStart = (e: KeyboardEvent) => {
            const keyStr = keyFormatter(e);
            if (keyStr === "") return;
            const i = (keys: string[]) => {
                return keys.includes(keyStr);
            };
            const afterUIScale = () => {
                process.platform === "win32" &&
                    window.electron.currentWindow.setTitleBarOverlay()({
                        height: Math.floor(40 * window.electron.webFrame.getZoomFactor()),
                    });
                // page nav/ window btn cont width
                (document.querySelector(".windowBtnCont") as HTMLDivElement).style.right = `${
                    140 * (1 / window.electron.webFrame.getZoomFactor())
                }px`;
            };
            switch (true) {
                case i(shortcutsMapped["navToHome"]):
                    if (window.electron.currentWindow.isFullScreen())
                        window.electron.currentWindow.setFullScreen(false);
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
        window.addEventListener("keydown", eventsOnStart, {
            signal,
        });

        const filesToWatch = [historyPath, bookmarksPath];
        if (appSettings.syncSettings) filesToWatch.push(settingsPath);
        if (appSettings.syncThemes) filesToWatch.push(themesPath);
        const closeWatcher = window.chokidar.watch({
            path: filesToWatch,
            event: "change",
            callback: (path) => {
                if (path === settingsPath) dispatch(refreshAppSettings());
                if (path === themesPath) dispatch(refreshThemes());
            },
        });

        const dropFile = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                const data = e.dataTransfer.files;
                if (data.length > 0) {
                    if (!window.fs.existsSync(data[0].path)) return;
                    if (window.app.linkInReader && window.app.linkInReader.link === data[0].path) return;
                    if (data.length > 1)
                        dialogUtils.customError({
                            message: "More than one file/folder dropped. Only first in list will be loaded.",
                        });
                    if (window.fs.isDir(data[0].path)) {
                        closeReader();
                        openInReader(data[0].path);
                    } else if (formatUtils.files.test(data[0].path)) {
                        closeReader();
                        openInReader(data[0].path);
                    } else if (formatUtils.image.test(data[0].path.toLowerCase())) {
                        closeReader();
                        openInReader(window.path.dirname(data[0].path));
                    }
                }
            }
        };
        document.addEventListener("dragover", (e) => e.preventDefault(), { signal });
        document.addEventListener("drop", dropFile, { signal });

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
                        if (process.platform === "win32") window.electron.showItemInFolder(url || "");
                        //todo
                        // else if (process.platform === "linux")
                        //     window.electron.send("showInExplorer", url);
                    },
                };
            },
            copyPath(url) {
                return {
                    label: "Copy Path",
                    disabled: url ? false : true,
                    action() {
                        window.electron.writeText(url);
                    },
                };
            },
            copyImage(url) {
                return {
                    label: "Copy Image",
                    disabled: url ? false : true,
                    action() {
                        window.electron.copyImage(url.replace("file://", ""));
                    },
                };
            },
            // removeHistory(url) {
            //     return {
            //         label: "Remove",
            //         disabled: url ? false : true,
            //         action() {
            //             dispatch(removeHistory(url));
            //         },
            //     };
            // },
            removeBookmark(itemLink, bookmarkId, type) {
                return {
                    label: "Remove Bookmark",
                    // disabled:  ? false : true,
                    action() {
                        dispatch(
                            removeBookmark({
                                itemLink,
                                ids: [bookmarkId],
                                type,
                            })
                        );
                    },
                };
            },
            addToBookmark(args) {
                return {
                    label: "Add to Bookmarks",
                    // disabled: args ? false : true,
                    action() {
                        dispatch(addBookmark(args));
                    },
                };
            },
            unreadChapter(itemLink: string, chapterName: string) {
                return {
                    label: "Mark as Unread",
                    // todo check why i added these
                    // disabled: mangaIndex >= 0 && chapterIndex >= 0 ? false : true,
                    action() {
                        dispatch(
                            updateChaptersRead({
                                chapterName,
                                itemLink,
                                read: false,
                            })
                        );
                    },
                };
            },
            readChapter(itemLink: string, chapterName: string) {
                return {
                    label: "Mark as Read",
                    // disabled: mangaIndex >= 0 && chapter ? false : true,
                    action() {
                        dispatch(updateChaptersRead({ itemLink, chapterName, read: true }));
                    },
                };
            },
            readAllChapter(mangaIndex, chapters) {
                return {
                    label: "Mark All as Read",
                    // disabled: mangaIndex >= 0 && chapters.length > 0 ? false : true,
                    action() {
                        dispatch(updateChaptersReadAll({ itemLink: mangaIndex, chapters, read: true }));
                    },
                };
            },
            unreadAllChapter(mangaIndex) {
                return {
                    label: "Mark All as Unread",
                    // disabled: mangaIndex >= 0 ? false : true,
                    action() {
                        dispatch(updateChaptersReadAll({ itemLink: mangaIndex, chapters: [], read: false }));
                    },
                };
            },
        };

        return () => {
            closeWatcher();
            listeners.forEach((e) => e());
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
