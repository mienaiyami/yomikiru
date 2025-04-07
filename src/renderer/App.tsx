import { createContext, createRef, ReactElement, useContext, useEffect, useLayoutEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import Main from "./components/Main";
import TopBar from "./components/TopBar";
import { refreshAppSettings, setAppSettings } from "@store/appSettings";

import { addBookmark, fetchAllBookmarks, removeBookmark } from "@store/bookmarks";
import { refreshThemes, setTheme } from "@store/themes";
import { bookmarksPath, formatUtils, historyPath, promptSelectDir, settingsPath, themesPath } from "./utils/file";

import {
    deleteLibraryItem,
    fetchAllItemsWithProgress,
    updateChaptersRead,
    updateChaptersReadAll,
    updateCurrentItemProgress,
} from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { keyFormatter } from "@utils/keybindings";
import { setAnilistEditOpen, setAnilistLoginOpen, setAnilistSearchOpen, toggleSettingsOpen } from "@store/ui";
import { setAnilistCurrentManga } from "@store/anilist";
import { resetReaderState } from "@store/reader";
import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import { shallowEqual } from "react-redux";
import { getShortcutsMapped } from "@store/shortcuts";
import { fetchAllNotes } from "@store/bookNotes";

interface AppContext {
    pageNumberInputRef: React.RefObject<HTMLInputElement>;
    bookProgressRef: React.RefObject<HTMLInputElement>;
    /**
     * Check if folder have images then open those images in reader, or open in epub-reader if `.epub`
     * @param link link of folder containing images or epub file.
     */
    openInReader: ReturnType<typeof useDirectoryValidator>["openInReaderIfValid"];
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
    validateDirectory: ReturnType<typeof useDirectoryValidator>["validateDirectory"];
}

const AppContext = createContext<AppContext | null>(null);

export const useAppContext = (): AppContext => {
    const context = useContext(AppContext);
    if (!context) throw new Error("AppContext not found");
    return context;
};

const App = (): ReactElement => {
    const appSettings = useAppSelector((state) => state.appSettings);
    // const isReaderOpen = useAppSelector((state) => state.ui.isOpen.reader);
    const isReaderOpen = useAppSelector((state) => state.reader.active);
    const linkInReader = useAppSelector((state) => state.reader.link);
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const theme = useAppSelector((state) => state.theme.name);

    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const bookProgressRef: React.RefObject<HTMLInputElement> = createRef();
    const [firstRendered, setFirstRendered] = useState(false);
    const [contextMenuData, setContextMenuData] = useState<Menu.ContextMenuData | null>(null);
    const [optSelectData, setOptSelectData] = useState<Menu.OptSelectData | null>(null);
    const [colorSelectData, setColorSelectData] = useState<Menu.ColorSelectData | null>(null);

    const dispatch = useAppDispatch();

    const { openInReaderIfValid, validateDirectory } = useDirectoryValidator();

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

    const closeReader = async () => {
        await dispatch(updateCurrentItemProgress());
        dispatch(resetReaderState());
        dispatch(setAnilistCurrentManga(null));
        dispatch(setAnilistEditOpen(false));
        dispatch(setAnilistLoginOpen(false));
        dispatch(setAnilistSearchOpen(false));

        window.app.deleteDirOnClose &&
            window.fs.access(window.app.deleteDirOnClose).then(() => {
                window.fs.rm(window.app.deleteDirOnClose, { recursive: true });
            });

        document.body.classList.remove("zenMode");
        if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);
        setTimeout(() => {
            window.electron.webFrame.clearCache();
            window.electron.webFrame.clearCache();
        }, 1000);
    };

    const openInNewWindow = (link: string) => {
        // new window will be opened, if link is invalid then it will be forced closed.
        link &&
            window.fs.access(link).then(() => {
                window.electron.send("window:openLinkInNewWindow", link);
            });
    };

    useLayoutEffect(() => {
        if (window.app.deleteDirOnClose)
            window.electron.send("window:addDirToDelete", window.app.deleteDirOnClose);
    }, [window.app.deleteDirOnClose]);

    useLayoutEffect(() => {
        const elem = document.head.querySelector("#customStylesheet");
        if (appSettings.customStylesheet && !elem) {
            window.fs.access(appSettings.customStylesheet).then(() => {
                window.logger.log("Loading custom stylesheet from ", appSettings.customStylesheet);
                const stylesheet = document.createElement("link");
                stylesheet.rel = "stylesheet";
                stylesheet.href = appSettings.customStylesheet;
                stylesheet.id = "customStylesheet";
                document.head.appendChild(stylesheet);
            });
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
        dispatch(fetchAllNotes());
        listeners.push(
            window.electron.on("reader:loadLink", ({ link }) => {
                if (link)
                    openInReaderIfValid(link, {
                        maxSubdirectoryDepth: 0,
                    }).then((isValid) => {
                        if (!isValid) {
                            window.electron.send("window:destroy");
                        }
                    });
            }),
        );
        // todo: these are temp only
        listeners.push(
            window.electron.on("db:library:change", () => {
                dispatch(fetchAllItemsWithProgress());
            }),
            window.electron.on("db:bookmark:change", () => {
                dispatch(fetchAllBookmarks());
            }),
            window.electron.on("db:bookNote:change", () => {
                dispatch(fetchAllNotes());
            }),
        );

        listeners.push(
            window.electron.on("window:statusCheck", () => {
                window.electron.send("window:statusCheck:response");
            }),
        );

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
            }),
        );
        window.app.titleBarHeight = parseFloat(
            window.getComputedStyle(document.body).getPropertyValue("--titleBar-height"),
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
                        openInReaderIfValid(url);
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
                            }),
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
                            }),
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
                            }),
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
    }, [shortcutsMapped, isReaderOpen]);

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
                            openInReaderIfValid(data[0].path);
                        } else if (formatUtils.files.test(data[0].path)) {
                            closeReader();
                            openInReaderIfValid(data[0].path);
                        } else if (formatUtils.image.test(data[0].path.toLowerCase())) {
                            closeReader();
                            openInReaderIfValid(window.path.dirname(data[0].path));
                        }
                    }
                }
            },
            { signal },
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
                openInReader: openInReaderIfValid,
                closeReader,
                openInNewWindow,
                validateDirectory,
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
