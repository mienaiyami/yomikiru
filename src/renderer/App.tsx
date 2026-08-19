import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import { dispatchFocusPageSearchShortcut } from "@hooks/usePageSearchFocus";
import {
    importAnilistTrackingFromStorage,
    setAnilistCurrentListEntry,
    setGalleryTrackContext,
} from "@store/anilist";
import { refreshAppSettings, setAppSettings } from "@store/appSettings";
import { addBookmark, fetchAllBookmarks, removeBookmark } from "@store/bookmarks";
import { fetchAllNotes } from "@store/bookNotes";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    deleteLibraryItem,
    fetchAllItemsWithProgress,
    fetchAllMetadata,
    updateChaptersRead,
    updateChaptersReadAll,
    updateCurrentItemProgress,
} from "@store/library";
import { getMainSettings, setMainSettings } from "@store/mainSettings";
import { resetReaderState } from "@store/reader";
import { refreshReaderPresetsWithReconcile } from "@store/readerPresets";
import { getShortcutsMapped, refreshShortcuts } from "@store/shortcuts";
import { fetchAllTags } from "@store/tags";
import { refreshThemes, setTheme } from "@store/themes";
import { fetchAllTrackers } from "@store/trackers";
import { setAnilistEditOpen, setAnilistLoginOpen, setAnilistSearchOpen, toggleSettingsOpen } from "@store/ui";
import { initAnilist } from "@utils/anilist";
import { dialogUtils } from "@utils/dialog";
import { keyFormatter, mouseEventFormatter } from "@utils/keybindings";
import { resolveMissingOpenPath } from "@utils/libraryMissingPath";
import {
    createContext,
    createRef,
    type ReactElement,
    useContext,
    useEffect,
    useLayoutEffect,
    useState,
} from "react";
import { shallowEqual } from "react-redux";
import UiBlockOverlay from "./components/UiBlockOverlay";
import i18n from "./i18n";
import Main from "./Main";
import TopBar from "./TopBar";
import {
    formatUtils,
    promptSelectDir,
    readerPresetsPath,
    settingsPath,
    shortcutsPath,
    themesPath,
} from "./utils/file";
import { createRendererLogger } from "./utils/logger";

const log = createRendererLogger("App");

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
    const isSettingsOpen = useAppSelector((state) => state.ui.isOpen.settings);
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
                dialogUtils.customError({ message: i18n.t("app.noSettingsSelectFolder", { ns: "common" }) });
                promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path as string })));
            }
        } else {
            dispatch(setTheme(theme));
        }
    }, [firstRendered]);

    const closeReader = async () => {
        // may leave Redux book position behind the viewport until % changes; flush before DB write
        window.app.flushEpubScrollPos?.();
        await dispatch(updateCurrentItemProgress());
        dispatch(resetReaderState());
        dispatch(setAnilistCurrentListEntry(null));
        dispatch(setAnilistEditOpen(false));
        dispatch(setAnilistLoginOpen(false));
        dispatch(setAnilistSearchOpen(false));
        dispatch(setGalleryTrackContext(null));

        // this is needed coz it is async and by the time it executes, deleteDirOnClose changes to current dir
        const deleteDir = window.app.deleteDirOnClose;
        deleteDir &&
            window.fs
                .access(deleteDir)
                .then(() => {
                    window.fs.rm(deleteDir, { recursive: true }).catch((err) => {
                        log.error(`closeReader: could not delete temp dir "${deleteDir}"`, err);
                    });
                })
                .catch((err) => {
                    log.error(`closeReader: temp dir not accessible for delete "${deleteDir}"`, err);
                });

        document.body.classList.remove("zenMode");
        if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);
        setTimeout(() => {
            window.electron.webFrame.clearCache();
            window.electron.webFrame.clearCache();
        }, 1000);
    };

    const openInNewWindow = (link: string) => {
        if (!link) return;
        void (async () => {
            let target = link;
            if (!window.fs.existsSync(target)) {
                const resolved = await resolveMissingOpenPath(dispatch, target);
                if (!resolved) return;
                target = resolved.openPath;
            }
            // new window will be opened; main forces close if the link is still invalid
            window.fs.access(target).then(() => {
                window.electron.send("window:openLinkInNewWindow", target);
            });
        })();
    };

    useLayoutEffect(() => {
        if (window.app.deleteDirOnClose)
            window.electron.send("window:addDirToDelete", window.app.deleteDirOnClose);
    }, [window.app.deleteDirOnClose]);

    useLayoutEffect(() => {
        const elem = document.head.querySelector("#customStylesheet");
        if (appSettings.customStylesheet && !elem) {
            window.fs.access(appSettings.customStylesheet).then(() => {
                log.log(`Applying user customStylesheet: ${appSettings.customStylesheet}`);
                const stylesheet = document.createElement("link");
                stylesheet.rel = "stylesheet";
                stylesheet.href = appSettings.customStylesheet;
                stylesheet.id = "customStylesheet";
                document.head.appendChild(stylesheet);
            });
        } else if (elem) {
            log.log("Removing user customStylesheet link from document head");
            document.head.removeChild(elem);
        }
    }, [appSettings.customStylesheet]);

    useEffect(() => {
        const listeners: (() => void)[] = [];
        setFirstRendered(true);
        initAnilist();
        void dispatch(fetchAllItemsWithProgress()).then(() => {
            void dispatch(importAnilistTrackingFromStorage()).then(() => {
                // generic item_trackers rows; AniList session stays in the anilist slice
                void dispatch(fetchAllTrackers());
            });
        });
        dispatch(fetchAllMetadata());
        dispatch(fetchAllTags());
        dispatch(fetchAllBookmarks());
        dispatch(fetchAllNotes());
        dispatch(getMainSettings());
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
                dispatch(fetchAllMetadata());
            }),
            window.electron.on("db:bookmark:change", () => {
                dispatch(fetchAllBookmarks());
            }),
            window.electron.on("db:bookNote:change", () => {
                dispatch(fetchAllNotes());
            }),
            window.electron.on("db:tracker:change", () => {
                dispatch(fetchAllTrackers());
            }),
            window.electron.on("db:tag:change", () => {
                dispatch(fetchAllTags());
            }),
            window.electron.on("mainSettings:sync", (settings) => {
                dispatch(setMainSettings(settings));
            }),
            window.electron.on("fs:fileChanged", ({ filePath, sourceWindowId }) => {
                // saving window already has in-memory state (main also skips self-notify)
                if (sourceWindowId !== undefined && sourceWindowId === window.electron.currentWindow.id()) return;
                if (filePath === settingsPath && appSettings.syncSettings) dispatch(refreshAppSettings());
                if (filePath === shortcutsPath && appSettings.syncSettings) dispatch(refreshShortcuts());
                if (filePath === themesPath && appSettings.syncThemes) dispatch(refreshThemes());
                if (filePath === readerPresetsPath) dispatch(refreshReaderPresetsWithReconcile());
            }),
        );

        listeners.push(
            window.electron.on("window:statusCheck", () => {
                window.electron.send("window:statusCheck:response");
            }),
        );

        window.app.titleBarHeight = parseFloat(
            window.getComputedStyle(document.body).getPropertyValue("--titleBar-height"),
        );
        // here bcoz reload doesnt make window exit fullscreen
        if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);

        //! moving to fs:fileChanged listener
        // const filesToWatch = [readerPresetsPath, shortcutsPath];
        // if (appSettings.syncSettings) filesToWatch.push(settingsPath);
        // if (appSettings.syncThemes) filesToWatch.push(themesPath);
        // const debouncedRefreshFromWatcher = debounce((path: string) => {
        //     if (path === settingsPath) dispatch(refreshAppSettings());
        //     if (path === themesPath) dispatch(refreshThemes());
        //     if (path === readerPresetsPath) dispatch(refreshReaderPresetsWithReconcile());
        //     if (path === shortcutsPath) dispatch(refreshShortcuts());
        // }, 150);
        // const closeWatcher = window.chokidar.watch({
        //     path: filesToWatch,
        //     event: "change",
        //     callback: (_event, path) => {
        //         debouncedRefreshFromWatcher(path);
        //     },
        // });

        return () => {
            // closeWatcher();
            listeners.forEach((e) => void e());
        };
    }, []);
    useEffect(() => {
        const listener = window.electron.on("reader:recordPage", async () => {
            if (isReaderOpen) await closeReader();
            window.electron.send("window:destroy");
        });
        return () => {
            listener();
        };
        // todo
    }, [isReaderOpen, closeReader]);

    useEffect(() => {
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
                    label: i18n.t("contextMenu.open", { ns: "common" }),
                    disabled: !url,
                    action() {
                        openInReaderIfValid(url);
                    },
                };
            },
            openInNewWindow(url) {
                return {
                    label: i18n.t("contextMenu.openInNewWindow", { ns: "common" }),
                    disabled: !url,
                    action() {
                        openInNewWindow(url);
                    },
                };
            },
            showInExplorer(url) {
                return {
                    label: i18n.t("contextMenu.showInExplorer", { ns: "common" }),
                    disabled: !url,
                    action() {
                        window.electron.showItemInFolder(url || "");
                    },
                };
            },
            copyPath(url) {
                return {
                    label: i18n.t("contextMenu.copyPath", { ns: "common" }),
                    disabled: !url,
                    action() {
                        window.electron.writeText(url);
                    },
                };
            },
            copyImage(url) {
                return {
                    label: i18n.t("contextMenu.copyImage", { ns: "common" }),
                    disabled: !url,
                    action() {
                        window.electron.copyImage(url.replace("file://", ""));
                    },
                };
            },
            removeHistory(url, isInSideList = false, onRemoved?) {
                return {
                    label: i18n.t("contextMenu.removeFromLibrary", { ns: "common" }),
                    disabled: !url,
                    action() {
                        const runRemove = () => {
                            dispatch(
                                deleteLibraryItem({
                                    link: url,
                                }),
                            );
                            onRemoved?.();
                        };
                        if (isInSideList && !appSettings.confirmDeleteItem) {
                            runRemove();
                        } else {
                            dialogUtils
                                .warn({
                                    title: i18n.t("contextMenu.removeFromLibrary", { ns: "common" }),
                                    message: i18n.t("contextMenu.removeFromLibraryMessage", { ns: "common" }),
                                    noOption: false,
                                    buttons: [
                                        i18n.t("actions.cancel", { ns: "common" }),
                                        i18n.t("actions.yes", { ns: "common" }),
                                    ],
                                    defaultId: 0,
                                })
                                .then(({ response }) => {
                                    if (!response) return;
                                    runRemove();
                                });
                        }
                    },
                };
            },
            removeBookmark(itemLink, bookmarkId, type, isInSideList = false) {
                return {
                    label: i18n.t("contextMenu.removeBookmark", { ns: "common" }),
                    action() {
                        if (isInSideList && !appSettings.confirmDeleteItem) {
                            dispatch(
                                removeBookmark({
                                    itemLink,
                                    ids: [bookmarkId],
                                    type,
                                }),
                            );
                        } else {
                            dialogUtils
                                .warn({
                                    title: i18n.t("contextMenu.removeBookmark", { ns: "common" }),
                                    message: i18n.t("contextMenu.removeBookmarkMessage", { ns: "common" }),
                                    noOption: false,
                                    buttons: [
                                        i18n.t("actions.cancel", { ns: "common" }),
                                        i18n.t("actions.yes", { ns: "common" }),
                                    ],
                                    defaultId: 0,
                                })
                                .then(({ response }) => {
                                    if (!response) return;
                                    dispatch(
                                        removeBookmark({
                                            itemLink,
                                            ids: [bookmarkId],
                                            type,
                                        }),
                                    );
                                });
                        }
                    },
                };
            },
            addToBookmark(args) {
                return {
                    label: i18n.t("contextMenu.addToBookmarks", { ns: "common" }),
                    // disabled: args ? false : true,
                    action() {
                        dispatch(addBookmark(args));
                    },
                };
            },
            unreadChapter(itemLink: string, chapterName: string) {
                return {
                    label: i18n.t("contextMenu.markAsUnread", { ns: "common" }),
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
                    label: i18n.t("contextMenu.markAsRead", { ns: "common" }),
                    // disabled: mangaIndex >= 0 && chapter ? false : true,
                    action() {
                        dispatch(updateChaptersRead({ itemLink, chapterName, read: true }));
                    },
                };
            },
            readAllChapter(mangaIndex, chapters) {
                return {
                    label: i18n.t("contextMenu.markAllAsRead", { ns: "common" }),
                    // disabled: mangaIndex >= 0 && chapters.length > 0 ? false : true,
                    action() {
                        dialogUtils
                            .warn({
                                title: i18n.t("contextMenu.markAllAsRead", { ns: "common" }),
                                message: i18n.t("contextMenu.markAllAsReadMessage", { ns: "common" }),
                                noOption: false,
                                buttons: [
                                    i18n.t("actions.cancel", { ns: "common" }),
                                    i18n.t("actions.yes", { ns: "common" }),
                                ],
                                defaultId: 0,
                            })
                            .then(({ response }) => {
                                if (!response) return;
                                dispatch(updateChaptersReadAll({ itemLink: mangaIndex, chapters, read: true }));
                            });
                    },
                };
            },
            unreadAllChapter(mangaIndex) {
                return {
                    label: i18n.t("contextMenu.markAllAsUnread", { ns: "common" }),
                    // disabled: mangaIndex >= 0 ? false : true,
                    action() {
                        dialogUtils
                            .warn({
                                title: i18n.t("contextMenu.markAllAsUnread", { ns: "common" }),
                                message: i18n.t("contextMenu.markAllAsUnreadMessage", { ns: "common" }),
                                noOption: false,
                                buttons: [
                                    i18n.t("actions.cancel", { ns: "common" }),
                                    i18n.t("actions.yes", { ns: "common" }),
                                ],
                                defaultId: 0,
                            })
                            .then(({ response }) => {
                                if (!response) return;
                                dispatch(
                                    updateChaptersReadAll({ itemLink: mangaIndex, chapters: [], read: false }),
                                );
                            });
                    },
                };
            },
        };
    }, [appSettings, openInReaderIfValid]);

    useEffect(() => {
        const handleShortcut = (keyStr: string, e: Event) => {
            const i = (keys: string[]) => keys.includes(keyStr);
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
                case i(shortcutsMapped.navToHome):
                    e.preventDefault();
                    if (window.electron.currentWindow.isFullScreen())
                        window.electron.currentWindow.setFullScreen(false);
                    if (isReaderOpen) return closeReader();
                    window.location.reload();
                    break;
                case i(shortcutsMapped.openSettings):
                    e.preventDefault();
                    dispatch(toggleSettingsOpen());
                    break;
                case i(shortcutsMapped.uiSizeReset):
                    e.preventDefault();
                    window.electron.webFrame.setZoomFactor(1);
                    afterUIScale();
                    break;
                case i(shortcutsMapped.uiSizeDown):
                    e.preventDefault();
                    window.electron.webFrame.setZoomFactor(window.electron.webFrame.getZoomFactor() - 0.1);
                    afterUIScale();
                    break;
                case i(shortcutsMapped.uiSizeUp):
                    e.preventDefault();
                    window.electron.webFrame.setZoomFactor(window.electron.webFrame.getZoomFactor() + 0.1);
                    afterUIScale();
                    break;
                case i(shortcutsMapped.focusPageSearch):
                    dispatchFocusPageSearchShortcut(e, { settingsOpen: isSettingsOpen });
                    break;
                default:
                    break;
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            const keyStr = keyFormatter(e);
            if (keyStr === "") return;
            handleShortcut(keyStr, e);
        };
        const onMouseDown = (e: MouseEvent) => {
            const keyStr = mouseEventFormatter(e);
            if (keyStr === "") return;
            handleShortcut(keyStr, e);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("mousedown", onMouseDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("mousedown", onMouseDown);
        };
    }, [shortcutsMapped, isReaderOpen, isSettingsOpen]);

    useEffect(() => {
        const abortController = new AbortController();
        const signal = abortController.signal;
        document.addEventListener("dragover", (e) => e.preventDefault(), { signal });
        document.addEventListener(
            "drop",
            async (e) => {
                e.preventDefault();
                try {
                    if (e.dataTransfer) {
                        const data = e.dataTransfer.files;
                        if (data.length > 0) {
                            if (!window.fs.existsSync(data[0].path)) return;
                            if (linkInReader === data[0].path) return;
                            if (data.length > 1)
                                dialogUtils.customError({
                                    message: i18n.t("app.dropMultipleOnlyFirst", { ns: "common" }),
                                });
                            await window.fs.access(data[0].path);
                            if (window.fs.isDir(data[0].path)) {
                                await closeReader();
                                await openInReaderIfValid(data[0].path);
                            } else if (formatUtils.files.test(data[0].path)) {
                                await closeReader();
                                await openInReaderIfValid(data[0].path);
                            } else if (formatUtils.image.test(data[0].path.toLowerCase())) {
                                await closeReader();
                                await openInReaderIfValid(window.path.dirname(data[0].path));
                            }
                        }
                    }
                } catch (err) {
                    log.error("Drop handler: failed to open dropped path", err);
                    dialogUtils.customError({
                        message: i18n.t("app.dropError", { ns: "common" }),
                        detail: err instanceof Error ? err.message : String(err),
                    });
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
            <UiBlockOverlay />
        </AppContext.Provider>
    );
};
export default App;
