import { createContext, createRef, ReactElement, useContext, useEffect, useLayoutEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import Main from "./components/Main";
import TopBar from "./components/TopBar";
import { refreshAppSettings, setAppSettings } from "@store/appSettings";

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

import { renderPDF } from "@utils/pdf";
import {
    deleteLibraryItem,
    fetchAllItemsWithProgress,
    setLibrary,
    updateBookProgress,
    updateChaptersRead,
    updateChaptersReadAll,
    updateCurrentItemProgress,
    updateMangaProgress,
} from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { keyFormatter } from "@utils/keybindings";
import { DatabaseChannels } from "@common/types/ipc";
import { BookBookmark, MangaBookmark } from "@common/types/db";
import {
    setAnilistEditOpen,
    setAnilistLoginOpen,
    setAnilistSearchOpen,
    // setReaderOpen,
    toggleSettingsOpen,
} from "@store/ui";
import { setAnilistCurrentManga } from "@store/anilist";
import { resetReaderState, setReaderLoading, setReaderState } from "@store/reader";

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

const AppContext = createContext<AppContext | null>(null);

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("AppContext not found");
    return context;
};

const App = (): ReactElement => {
    const appSettings = useAppSelector((state) => state.appSettings);
    // const isReaderOpen = useAppSelector((state) => state.ui.isOpen.reader);
    const isReaderOpen = useAppSelector((state) => state.reader.active);
    const linkInReader = useAppSelector((state) => state.reader.link);
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

    //todo refactor
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
        // convert callback-style function to async/await pattern
        const processDirectory = async (link: string, goInAndRetry = 0): Promise<void> => {
            try {
                const files = await window.fs.readdir(link);

                if (files.length <= 0) {
                    dialogUtils.customError({
                        title: "No images found",
                        message: "Folder is empty.",
                        detail: link,
                    });
                    // dispatch(setUnzipping(false));
                    callback(false);
                    return;
                }

                // dispatch(setUnzipping(false));
                if (sendImgs) {
                    dispatch(
                        setReaderLoading({
                            percent: 0,
                            message: `Processing images`,
                        })
                    );
                }

                const imgs = files.filter((e) => formatUtils.image.test(e));

                if (imgs.length <= 0) {
                    // Check for subdirectories with content
                    const dirOnlyPromises = files.map(async (e) => {
                        const fullPath = window.path.join(link, e);
                        try {
                            const isDirectory = window.fs.isDir(fullPath);
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
                    callback(false);
                    return;
                }
                dispatch(setReaderLoading(null));

                if (sendImgs) {
                    callback(
                        true,
                        imgs.sort(window.app.betterSortOrder).map((e) => window.path.join(link, e))
                    );
                    return;
                }
                console.log("callback(true)111");
                callback(true);
                console.log("callback(true)222");
                return;
            } catch (err) {
                window.logger.error("Error processing directory:", err);
                // dispatch(setUnzipping(false));
                callback(false);
            }
        };

        try {
            const linkSplitted = link.split(window.path.sep);

            if (window.fs.existsSync(window.app.deleteDirOnClose)) {
                try {
                    await window.fs.rm(window.app.deleteDirOnClose, { recursive: true });
                } catch (err) {
                    window.logger.error("Failed to remove previous temp directory:", err);
                }
            }

            // if loading screen show is here, it might just flash for a second and load.

            if (formatUtils.packedManga.test(link)) {
                const tempExtractPath = window.path.join(
                    window.electron.app.getPath("temp"),
                    `yomikiru-temp-images-${linkSplitted.at(-1)}`
                );

                try {
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
                        dispatch(
                            setReaderLoading({
                                percent: 0,
                                message: `Extracting "${linkSplitted.at(-1)?.substring(0, 20)}..."`,
                            })
                        );

                        try {
                            const result = await unzip(link, tempExtractPath);
                            if (result) {
                                await processDirectory(tempExtractPath, 1);
                            }
                        } catch (err) {
                            dispatch(setReaderLoading(null));
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
                            setReaderLoading({
                                percent: 0,
                                message: `Rendering "${linkSplitted.at(-1)?.substring(0, 20)}..."`,
                            })
                        );

                        try {
                            await renderPDF(
                                link,
                                tempExtractPath,
                                appSettings.readerSettings.pdfScale,
                                (total, done) =>
                                    dispatch(
                                        setReaderLoading({
                                            percent: 0,
                                            message: `[${done}/${total}] Rendering "${linkSplitted
                                                .at(-1)
                                                ?.substring(0, 20)}..."`,
                                        })
                                    )
                            );
                            await processDirectory(tempExtractPath, 1);
                        } catch (err) {
                            dispatch(setReaderLoading(null));
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
            dispatch(setReaderLoading(null));
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
        if (linkInReader === link) return;
        if (formatUtils.book.test(link)) {
            // dispatch(setUnzipping({ state: true, text: "PROCESSING EPUB" }));

            // dispatch(setLoadingManga(true));
            // dispatch(setLoadingMangaPercent(0));
            dispatch(setReaderLoading({ percent: 0, message: "Processing EPUB" }));
            dispatch(
                setReaderState({
                    type: "book",
                    content: null,
                    link,
                    mangaPageNumber: 0,
                    epubChapterId: extra?.epubChapterId || "",
                    epubElementQueryString: extra?.epubElementQueryString || "",
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
                        // dispatch(
                        //     setReaderLoading({
                        //         percent: 0,
                        //         message: "Processing Images123123",
                        //     })
                        // );
                        dispatch(
                            setReaderState({
                                type: "manga",
                                content: null,
                                link,
                                mangaPageNumber: extra?.mangaPageNumber || 1,
                            })
                        );
                    }
                },
                true
            );
    };

    const closeReader = async () => {
        console.log("closeReader");
        await dispatch(updateCurrentItemProgress());
        dispatch(resetReaderState());
        dispatch(setAnilistCurrentManga(null));
        dispatch(setAnilistEditOpen(false));
        dispatch(setAnilistLoginOpen(false));
        dispatch(setAnilistSearchOpen(false));

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
                (isValid, imgs) => {
                    console.log("openInNewWindow", isValid, imgs);
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
        const listeners: (() => void)[] = [];
        setFirstRendered(true);
        dispatch(fetchAllItemsWithProgress());
        dispatch(fetchAllBookmarks());
        listeners.push(
            window.electron.on("reader:loadLink", ({ link }) => {
                if (link) openInReader(link);
            })
        );
        listeners.push(
            window.electron.on("db:library:change", (data) => {
                console.log("updating library", data);
                const items = data.reduce((acc, item) => {
                    acc[item.link] = item;
                    return acc;
                }, {} as Record<string, DatabaseChannels["db:library:getAllAndProgress"]["response"][0]>);
                dispatch(setLibrary(items));
            })
        );
        listeners.push(
            // todo: temp only
            window.electron.on("db:bookmark:change", (data) => {
                console.log("updating bookmark", data);
                const manga = {} as Record<string, MangaBookmark[]>;
                for (const mangaBookmark of data.mangaBookmarks) {
                    if (!manga[mangaBookmark.itemLink]) {
                        manga[mangaBookmark.itemLink] = [];
                    }
                    manga[mangaBookmark.itemLink].push(mangaBookmark);
                }
                const book = {} as Record<string, BookBookmark[]>;
                for (const bookBookmark of data.bookBookmarks) {
                    if (!book[bookBookmark.itemLink]) {
                        book[bookBookmark.itemLink] = [];
                    }
                    book[bookBookmark.itemLink].push(bookBookmark);
                }
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
            window.electron.on("reader:recordPage", async () => {
                // window.logger.log("received recordPageNumber");
                if (isReaderOpen) closeReader();
                // else if (window.app.linkInReader.link !== "") {
                //     //todo
                //     if (window.app.linkInReader.type === "image") dispatch();
                //     else dispatch(updateCurrentItemProgress());
                // }
                window.electron.send("window:destroy");
            })
        );
        window.app.titleBarHeight = parseFloat(
            window.getComputedStyle(document.body).getPropertyValue("--titleBar-height")
        );
        // here bcoz reload doesnt make window exit fullscreen
        if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);

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

        // todo: use radix ui
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
            removeHistory(url) {
                return {
                    label: "Remove",
                    disabled: url ? false : true,
                    action() {
                        dispatch(
                            deleteLibraryItem({
                                link: url,
                            })
                        );
                    },
                };
            },
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

    useEffect(() => {
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
                    if (isReaderOpen) return closeReader();
                    window.location.reload();
                    break;
                case i(shortcutsMapped["openSettings"]):
                    dispatch(toggleSettingsOpen());
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
        return () => {
            window.removeEventListener("keydown", eventsOnStart);
        };
    }, [shortcuts, isReaderOpen]);

    useEffect(() => {
        const abortController = new AbortController();
        const signal = abortController.signal;
        document.addEventListener("dragover", (e) => e.preventDefault(), { signal });
        document.addEventListener(
            "drop",
            (e) => {
                e.preventDefault();
                if (e.dataTransfer) {
                    const data = e.dataTransfer.files;
                    if (data.length > 0) {
                        if (!window.fs.existsSync(data[0].path)) return;
                        if (linkInReader === data[0].path) return;
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
            },
            { signal }
        );
        return () => abortController.abort();
    }, [linkInReader]);

    // useLayoutEffect(() => {
    //     closeReader();
    // }, [appSettings.readerSettings.dynamicLoading]);

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
