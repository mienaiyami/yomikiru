import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import {
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faDice,
    faLocationDot,
    faShuffle,
    faSort,
    faSyncAlt,
    faThumbtack,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ItemDisplayTitle } from "@renderer/components/ItemDisplayTitle";
import ListNavigator from "@renderer/components/ListNavigator";
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { setAppSettings } from "@store/appSettings";
import { addBookmark, removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectResolvedItemMetadata } from "@store/library";
import { getReaderManga, setReaderState } from "@store/reader";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { createRendererLogger } from "@utils/logger";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("manga/ReaderSideList");

import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";
import AnilistBar from "../../../anilist/AnilistBar";
import BookmarkList from "./BookmarkList";
import ReaderSideListItem from "./ReaderSideListItem";

type ChapterData = { name: string; pages: number; link: string; dateModified: number };

const filterChapter = (filter: string, chapter: ChapterData) => {
    return new RegExp(filter, "ig").test(chapter.name);
};

const RECENT_CHAPTERS_SIZE = 10;

/** Fisher-Yates shuffle. Returns new shuffled array. */
function shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

const handleContextMenu = (elem: HTMLElement) => {
    elem.dispatchEvent(window.contextMenu.fakeEvent(elem));
};

const handleSelect = (elem: HTMLElement) => {
    elem.click();
};

const ReaderSideList = memo(
    ({
        openNextChapterRef,
        openPrevChapterRef,
        openRandomChapterRef,
        sideListSearchRef,
        addToBookmarkRef,
        setShortcutText,
        isSideListPinned,
        setSideListPinned,
        setSideListWidth,
        makeScrollPos,
        prevNextChapter,
        setPrevNextChapter,
    }: {
        openNextChapterRef: React.RefObject<HTMLButtonElement>;
        openPrevChapterRef: React.RefObject<HTMLButtonElement>;
        openRandomChapterRef: React.RefObject<HTMLButtonElement>;
        sideListSearchRef: React.RefObject<HTMLInputElement>;
        addToBookmarkRef: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
        isSideListPinned: boolean;
        setSideListPinned: React.Dispatch<React.SetStateAction<boolean>>;
        setSideListWidth: React.Dispatch<React.SetStateAction<number>>;
        makeScrollPos: () => void;
        // todo: temp solution only, improve
        prevNextChapter: { prev: string; next: string };
        setPrevNextChapter: React.Dispatch<React.SetStateAction<{ prev: string; next: string }>>;
    }) => {
        const { contextMenuData, openInReader, setContextMenuData, closeReader } = useAppContext();

        const contentLink = useAppSelector((store) => store.reader.content?.link);
        const readerLink = useAppSelector((store) => store.reader.link);
        const readerType = useAppSelector((store) => store.reader.type);
        // TODO: temporary solution only, improve
        /** Stable manga folder; content clears during chapter switch, so derive from chapter path when needed */
        const mangaLink =
            contentLink ?? (readerType === "manga" && readerLink ? window.path.dirname(readerLink) : undefined);
        /** mangaInReader.link !== linkInReader */
        const mangaInReader = useAppSelector(getReaderManga);
        const mangaDisplay = useAppSelector((store) =>
            selectResolvedItemMetadata(store, mangaInReader?.link ?? mangaLink),
        );
        const bookmarks = useAppSelector((store) => store.bookmarks);
        const appSettings = useAppSelector((store) => store.appSettings);
        const anilistToken = useAppSelector((store) => store.anilist.token);
        const dispatch = useAppDispatch();

        const sideListRef = useRef<HTMLDivElement>(null);
        const [chapterData, setChapterData] = useState<ChapterData[]>([]);
        const [isListOpen, setListOpen] = useState(false);
        const [preventListClose, setPreventListClose] = useState(false);

        const [draggingResizer, setDraggingResizer] = useState(false);

        const { t } = useTranslation("reader");
        const { t: tDialogs } = useTranslation("dialogs");
        const { t: tCommon } = useTranslation("common");
        const [displayList, setDisplayList] = useState<"" | "content" | "bookmarks">("content");

        const [bookmarkedId, setBookmarkedId] = useState<number | null>(null);

        const [isShuffleMode, setShuffleMode] = useState(false);
        const [shuffledLocations, setShuffledLocations] = useState<ChapterData[]>([]);
        const [isSearchFixed, setSearchFixed] = useState(false);
        const [filteredItemsFromList, setFilteredItemsFromList] = useState<ChapterData[]>([]);
        const [filterActive, setFilterActive] = useState(false);
        const recentChaptersRef = useRef<string[]>([]);

        const currentChapterPath = useMemo(() => {
            if (!mangaInReader?.progress?.itemLink || !mangaInReader?.progress?.chapterName) return "";
            return resolveMangaChapterPath(mangaInReader.progress.itemLink, mangaInReader.progress.chapterName);
        }, [mangaInReader?.progress?.itemLink, mangaInReader?.progress?.chapterName]);

        const sortedLocations = useMemo(() => {
            if (chapterData.length === 0) return [];
            const sorted = [...chapterData].sort((a, b) => {
                // chapterData is already sorted by name
                if (appSettings.locationListSortBy === "date") return a.dateModified - b.dateModified;
                return 0;
            });

            return appSettings.locationListSortType === "inverse" ? sorted.reverse() : sorted;
        }, [chapterData, appSettings.locationListSortBy, appSettings.locationListSortType]);

        const locationsToUse = isShuffleMode ? shuffledLocations : sortedLocations;
        const effectiveListForNav =
            filterActive && filteredItemsFromList.length > 0 ? filteredItemsFromList : locationsToUse;

        useEffect(() => {
            if (!isShuffleMode) {
                setShuffledLocations([]);
                return;
            }
            if (sortedLocations.length > 0) {
                setShuffledLocations(shuffleArray(sortedLocations));
            }
        }, [isShuffleMode, sortedLocations]);

        useEffect(() => {
            if (currentChapterPath) {
                const link = currentChapterPath;
                recentChaptersRef.current = [link, ...recentChaptersRef.current.filter((l) => l !== link)].slice(
                    0,
                    RECENT_CHAPTERS_SIZE,
                );
            }
        }, [currentChapterPath]);

        useEffect(() => {
            if (mangaInReader?.link) {
                setBookmarkedId(
                    bookmarks.manga[mangaInReader.link]?.find(
                        (b) =>
                            b.chapterName === mangaInReader.progress?.chapterName &&
                            b.page === mangaInReader.progress?.currentPage,
                    )?.id || null,
                );
            } else {
                setBookmarkedId(null);
            }
        }, [bookmarks, mangaInReader]);

        useEffect(() => {
            if (
                !contextMenuData &&
                !isSideListPinned &&
                document.activeElement !== sideListRef.current &&
                !sideListRef.current?.contains(document.activeElement)
            )
                return setListOpen(false);
            setPreventListClose(true);
        }, [contextMenuData]);

        useLayoutEffect(() => {
            if (isSideListPinned) {
                setListOpen(true);
            }
        }, [isSideListPinned]);

        useEffect(() => {
            if (effectiveListForNav.length >= 0 && mangaInReader) {
                const index = effectiveListForNav.findIndex((e) => e.link === currentChapterPath);
                const prevCh = index <= 0 ? "~" : effectiveListForNav[index - 1].link;
                const nextCh = index >= effectiveListForNav.length - 1 ? "~" : effectiveListForNav[index + 1].link;
                if (appSettings.locationListSortType === "inverse" && !isShuffleMode) {
                    setPrevNextChapter({ prev: nextCh, next: prevCh });
                } else {
                    setPrevNextChapter({ prev: prevCh, next: nextCh });
                }
            }
        }, [
            effectiveListForNav,
            appSettings.locationListSortType,
            isShuffleMode,
            mangaInReader,
            currentChapterPath,
        ]);

        const makeChapterList = async () => {
            if (!mangaLink) return;
            recentChaptersRef.current = [];

            try {
                const files = await window.fs.readdir(mangaLink);
                const chapterPromises = files.map(async (fileName): Promise<ChapterData | null> => {
                    try {
                        const filePath = window.path.join(mangaLink, fileName);
                        const stat = await window.fs.stat(filePath);

                        if (stat.isDir) {
                            try {
                                const dirContents = await window.fs.readdir(filePath);
                                const imageFiles = dirContents.filter((file) => formatUtils.image.test(file));

                                if (imageFiles.length > 0) {
                                    return {
                                        name: fileName,
                                        pages: imageFiles.length,
                                        link: filePath,
                                        dateModified: stat.mtimeMs,
                                    };
                                }
                            } catch (err) {
                                log.error(`readdir failed for "${filePath}"`, err);
                            }
                        } else if (formatUtils.files.test(filePath)) {
                            return {
                                name: fileName,
                                pages: 0,
                                link: filePath,
                                dateModified: stat.mtimeMs,
                            };
                        }

                        return null;
                    } catch (err) {
                        log.error(`could not stat or read "${fileName}"`, err);
                        return null;
                    }
                });

                const results = await Promise.allSettled(chapterPromises);
                const validChapters = results
                    .filter(
                        (result): result is PromiseFulfilledResult<ChapterData> =>
                            result.status === "fulfilled" && result.value !== null,
                    )
                    .map((result) => result.value);

                setChapterData(
                    validChapters.sort((a, b) =>
                        window.app.betterSortOrder(
                            formatUtils.files.getName(a.name),
                            formatUtils.files.getName(b.name),
                        ),
                    ),
                );
            } catch (err) {
                if (err instanceof Error) {
                    dialogUtils.nodeError(err);
                } else {
                    log.error(`chapter list build failed for "${mangaLink}"`, err);
                }
                setChapterData([]);
            }
        };
        useLayoutEffect(() => {
            makeChapterList();

            if (mangaLink && appSettings.autoRefreshSideList && !isShuffleMode) {
                const refresh = () => {
                    if (timeout) clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        makeChapterList();
                    }, 1000);
                };
                const closeWatcher = window.chokidar.watch({
                    path: mangaLink,
                    event: "all",
                    options: {
                        depth: 0,
                        ignoreInitial: true,
                    },
                    callback: refresh,
                });
                let timeout: NodeJS.Timeout;
                return () => {
                    closeWatcher();
                };
            }
        }, [mangaLink]);

        const handleResizerDrag = (e: MouseEvent) => {
            if (draggingResizer) {
                if (isSideListPinned) {
                    makeScrollPos();
                }
                const width =
                    e.clientX > (window.innerWidth * 90) / 100
                        ? (window.innerWidth * 90) / 100
                        : e.clientX < 192
                          ? 192
                          : e.clientX;
                setSideListWidth(width);
            }
        };
        const handleResizerMouseUp = () => {
            setDraggingResizer(false);
        };

        const handleIndicatorClick = (e: React.MouseEvent<HTMLDivElement>) => {
            makeScrollPos();
            if (isSideListPinned) {
                sideListRef.current?.blur();
                setListOpen(false);
            }
            setSideListPinned((init) => !init);
            (e.currentTarget as HTMLElement).blur();
        };

        const handleIndicatorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if ([" ", "Enter"].includes(e.key)) (e.currentTarget as HTMLElement).click();
        };

        const handleReSizerMouseDown = () => {
            setDraggingResizer(true);
        };

        const handleListMouseEnter = () => {
            setPreventListClose(true);
            if (!isListOpen) setListOpen(true);
        };

        const handleListMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
            if (!isSideListPinned) {
                if (preventListClose && !contextMenuData && !e.currentTarget.contains(document.activeElement))
                    setListOpen(false);
                setPreventListClose(false);
            }
        };

        const handleListFocus = () => {
            setListOpen(true);
            setPreventListClose(true);
        };

        const handleListMouseDown = (e: React.MouseEvent) => {
            if (e.target instanceof Node && e.currentTarget.contains(e.target)) setPreventListClose(true);
        };

        const handleListBlur = (e: React.FocusEvent) => {
            if (!preventListClose && !e.currentTarget.contains(document.activeElement) && !contextMenuData) {
                setListOpen(false);
                setPreventListClose(false);
            }
        };

        const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Escape") {
                (e.currentTarget as HTMLElement).blur();
            }
        };

        const handleSortClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            const items: Menu.ListItem[] = [
                {
                    label: t("sideList.sortName"),
                    action() {
                        dispatch(setAppSettings({ locationListSortBy: "name" }));
                    },
                    selected: appSettings.locationListSortBy === "name",
                },
                {
                    label: t("sideList.sortDateModified"),
                    action() {
                        dispatch(
                            setAppSettings({
                                locationListSortBy: "date",
                                locationListSortType: "inverse",
                            }),
                        );
                    },
                    selected: appSettings.locationListSortBy === "date",
                },
                window.contextMenu.template.divider(),
                {
                    label: t("sideList.sortAscending"),
                    action() {
                        dispatch(setAppSettings({ locationListSortType: "normal" }));
                    },
                    selected: appSettings.locationListSortType === "normal",
                },
                {
                    label: t("sideList.sortDescending"),
                    action() {
                        dispatch(setAppSettings({ locationListSortType: "inverse" }));
                    },
                    selected: appSettings.locationListSortType === "inverse",
                },
            ];
            setContextMenuData({
                clickX: e.currentTarget.getBoundingClientRect().x,
                clickY: e.currentTarget.getBoundingClientRect().bottom + 4,
                padLeft: true,
                items,
                focusBackElem: e.currentTarget,
            });
        };

        const handlePrevChapterClick = () => {
            if (prevNextChapter.prev === "~") {
                dialogUtils
                    .confirm({
                        message: t("dialogs.noPreviousChapter"),
                        buttons: [tDialogs("buttons.okAlt"), t("dialogs.home")],
                        noOption: false,
                        noLink: true,
                    })
                    .then((e) => {
                        if (e.response === 1) {
                            closeReader();
                        }
                    });
                return;
            }
            dispatch(
                setReaderState({
                    link: prevNextChapter.prev,
                    type: "manga",
                    content: null,
                    mangaPageNumber: 1,
                    epubChapterId: "",
                    epubElementQueryString: "",
                }),
            );
        };

        const handleBookmarkClick = () => {
            if (!mangaInReader || !mangaInReader.progress) return;
            const itemLink = mangaInReader.link;
            if (bookmarkedId !== null) {
                return dialogUtils
                    .warn({
                        title: tDialogs("titles.warning"),
                        message: t("dialogs.removeBookmarkManga"),
                        noOption: false,
                        buttons: [tDialogs("buttons.cancel"), tCommon("actions.remove")],
                        defaultId: 0,
                    })
                    .then(({ response }) => {
                        if (response === 1 && mangaInReader) {
                            dispatch(removeBookmark({ itemLink, type: "manga", ids: [bookmarkedId] }));
                        }
                    });
            }
            dispatch(
                addBookmark({
                    type: "manga",
                    data: {
                        itemLink,
                        page: mangaInReader.progress.currentPage || 1,
                        chapterName: mangaInReader.progress.chapterName,
                    },
                }),
            );
            setShortcutText(t("hud.bookmarkAdded"));
        };

        const handleNextChapterClick = () => {
            if (prevNextChapter.next === "~") {
                dialogUtils
                    .confirm({
                        message: t("dialogs.noNextChapter"),
                        buttons: [tDialogs("buttons.okAlt"), t("dialogs.home")],
                        noOption: false,
                        noLink: true,
                    })
                    .then((e) => {
                        if (e.response === 1) {
                            closeReader();
                        }
                    });
                return;
            }
            dispatch(
                setReaderState({
                    link: prevNextChapter.next,
                    type: "manga",
                    content: null,
                    mangaPageNumber: 1,
                    epubChapterId: "",
                    epubElementQueryString: "",
                }),
            );
        };

        const handleLocateClick = () => {
            if (sideListRef.current) {
                sideListRef.current.querySelectorAll("[data-url]").forEach((elem) => {
                    if (elem.getAttribute("data-url") === currentChapterPath)
                        elem.scrollIntoView({ block: "nearest" });
                });
            }
        };

        const handleRandomChapterClick = () => {
            const list = effectiveListForNav;
            if (list.length === 0) return;
            const pool = list.filter((ch) => !recentChaptersRef.current.includes(ch.link));
            const candidates = pool.length > 0 ? pool : list;
            if (pool.length === 0) recentChaptersRef.current = [];
            const randomChapter = candidates[Math.floor(Math.random() * candidates.length)];
            openInReader(randomChapter.link);
        };

        const handleContentToggle = () => {
            setDisplayList((init) => (init === "content" ? "" : "content"));
        };

        const handleBookmarksToggle = () => {
            setDisplayList((init) => (init === "bookmarks" ? "" : "bookmarks"));
        };

        const handleShuffleToggle = () => {
            setShuffleMode((v) => !v);
        };

        const handleSearchFixedToggle = () => {
            setSearchFixed((v) => !v);
        };

        const handleFilteredItemsChange = useCallback((items: ChapterData[], active: boolean) => {
            setFilteredItemsFromList(items);
            setFilterActive(active);
        }, []);

        const handleChapterItemClick = (link: string) => {
            openInReader(link);
        };

        useLayoutEffect(() => {
            document.body.style.cursor = "auto";
            if (draggingResizer) {
                document.body.style.cursor = "ew-resize";
            }
            window.addEventListener("mousemove", handleResizerDrag);
            window.addEventListener("mouseup", handleResizerMouseUp);
            return () => {
                window.removeEventListener("mousemove", handleResizerDrag);
                window.removeEventListener("mouseup", handleResizerMouseUp);
            };
        }, [draggingResizer]);

        const renderChapterItem = (chapter: ChapterData, _index: number, isSelected: boolean) => {
            return (
                <ReaderSideListItem
                    name={chapter.name}
                    inHistory={!!mangaInReader?.progress?.chaptersRead.includes(chapter.name)}
                    focused={isSelected}
                    key={chapter.name}
                    pages={chapter.pages}
                    current={currentChapterPath === chapter.link}
                    link={chapter.link}
                    onClick={handleChapterItemClick.bind(null, chapter.link)}
                />
            );
        };

        return (
            <div
                className={`readerSideList listCont ${isListOpen ? "open" : ""} ${
                    !appSettings.showTextFileBadge ? "hideTextFileBadge" : ""
                } ${!appSettings.showPageCountInSideList ? "hidePageCountInSideList" : ""}`}
                onMouseEnter={handleListMouseEnter}
                onMouseLeave={handleListMouseLeave}
                onFocus={handleListFocus}
                onMouseDown={handleListMouseDown}
                onBlur={handleListBlur}
                onKeyDown={handleListKeyDown}
                ref={sideListRef}
                tabIndex={-1}
            >
                <div
                    className="indicator"
                    onClick={handleIndicatorClick}
                    tabIndex={0}
                    onKeyDown={handleIndicatorKeyDown}
                >
                    <FontAwesomeIcon
                        icon={faThumbtack}
                        style={{ transform: isSideListPinned ? "rotate(45deg)" : "" }}
                    />
                </div>
                <div
                    className="reSizer"
                    onMouseDown={handleReSizerMouseDown}
                    onMouseUp={handleResizerMouseUp}
                ></div>

                <ListNavigator.Provider
                    items={locationsToUse}
                    filterFn={filterChapter}
                    renderItem={renderChapterItem}
                    onContextMenu={handleContextMenu}
                    onSelect={handleSelect}
                    emptyMessage={t("sideList.noChaptersFound")}
                    inputRef={sideListSearchRef}
                    onFilteredItemsChange={handleFilteredItemsChange}
                    persistFilterOnItemsChange={isSearchFixed}
                >
                    <div className="tools">
                        <div className="row1">
                            <div className="search-with-pin">
                                <ListNavigator.SearchInput
                                    placeholder={t("sideList.searchChapters")}
                                    pageSearch={{
                                        id: "reader-manga-sidelist",
                                        priority: PAGE_SEARCH_PRIORITY.reader,
                                    }}
                                />
                                <button
                                    className={`pin-filter-toggle ${isSearchFixed ? "selected" : ""}`}
                                    data-tooltip={
                                        isSearchFixed ? t("sideList.filterPinned") : t("sideList.filterUnpinned")
                                    }
                                    onClick={handleSearchFixedToggle}
                                >
                                    <FontAwesomeIcon
                                        icon={faThumbtack}
                                        style={{ transform: isSearchFixed ? "rotate(45deg)" : "" }}
                                    />
                                </button>
                            </div>

                            {(isShuffleMode || !appSettings.autoRefreshSideList) && (
                                <button
                                    data-tooltip={
                                        isShuffleMode ? t("sideList.refreshAndReshuffle") : t("sideList.refresh")
                                    }
                                    onClick={makeChapterList}
                                >
                                    <FontAwesomeIcon icon={faSyncAlt} />
                                </button>
                            )}

                            <button
                                data-tooltip={t("sideList.sortTooltip", {
                                    arrow: appSettings.locationListSortType === "normal" ? "▲ " : "▼ ",
                                    by: appSettings.locationListSortBy.toUpperCase(),
                                })}
                                onClick={handleSortClick}
                            >
                                <FontAwesomeIcon icon={faSort} />
                            </button>
                        </div>

                        <div className="row2">
                            <Button
                                className="ctrl-menu-item"
                                btnRef={openPrevChapterRef}
                                tooltip={t("sideList.openPrevious")}
                                clickAction={handlePrevChapterClick}
                            >
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </Button>
                            <Button
                                className="ctrl-menu-item"
                                tooltip={t("sideList.bookmark")}
                                btnRef={addToBookmarkRef}
                                clickAction={handleBookmarkClick}
                            >
                                <FontAwesomeIcon icon={bookmarkedId !== null ? faBookmark : farBookmark} />
                            </Button>
                            <Button
                                className="ctrl-menu-item"
                                btnRef={openNextChapterRef}
                                tooltip={t("sideList.openNext")}
                                clickAction={handleNextChapterClick}
                            >
                                <FontAwesomeIcon icon={faArrowRight} />
                            </Button>
                        </div>
                    </div>

                    <div className="in-reader">
                        <div>
                            <span className="bold">{t("sideList.manga")}</span>
                            <span className="bold"> : </span>
                            <ItemDisplayTitle
                                primary={mangaDisplay?.title ?? mangaInReader?.title ?? ""}
                                original={mangaDisplay?.originalTitle}
                            />
                        </div>
                        <div>
                            <span className="bold">{t("sideList.chapter")}</span>
                            <span className="bold"> : </span>
                            <span>{formatUtils.files.getName(mangaInReader?.progress?.chapterName || "")}</span>
                        </div>
                    </div>

                    {anilistToken && <AnilistBar />}

                    <div className="tools">
                        <div className="btnOptions">
                            <button
                                className={`${displayList === "content" ? "selected" : ""}`}
                                onClick={handleContentToggle}
                                data-tooltip={t("sideList.clickAgainToHide")}
                            >
                                {t("sideList.content")}
                            </button>
                            <button
                                className={`${displayList === "bookmarks" ? "selected" : ""}`}
                                onClick={handleBookmarksToggle}
                            >
                                {t("sideList.bookmarks")}
                            </button>
                        </div>
                        {displayList === "content" && (
                            <div className="row2">
                                <button
                                    className="ctrl-menu-item"
                                    data-tooltip={t("sideList.locateCurrentChapter")}
                                    onClick={handleLocateClick}
                                >
                                    <FontAwesomeIcon icon={faLocationDot} />
                                </button>

                                <button
                                    className={`shuffle-mode-toggle ${isShuffleMode ? "selected" : ""}`}
                                    data-tooltip={
                                        isShuffleMode ? t("sideList.shuffleOn") : t("sideList.shuffleOff")
                                    }
                                    onClick={handleShuffleToggle}
                                    aria-pressed={isShuffleMode}
                                    type="button"
                                >
                                    <FontAwesomeIcon icon={faShuffle} />
                                    <span className="shuffle-label">
                                        {isShuffleMode
                                            ? t("sideList.shuffleLabelOn")
                                            : t("sideList.shuffleLabelOff")}
                                    </span>
                                </button>
                                <Button
                                    className="ctrl-menu-item"
                                    btnRef={openRandomChapterRef}
                                    tooltip={t("sideList.openRandomChapter")}
                                    disabled={effectiveListForNav.length === 0}
                                    clickAction={handleRandomChapterClick}
                                >
                                    <FontAwesomeIcon icon={faDice} />
                                </Button>
                            </div>
                        )}
                    </div>

                    {displayList === "content" && (
                        <div
                            className="location-cont"
                            style={{
                                display: appSettings.readerSettings.hideSideList ? "none" : "initial",
                            }}
                        >
                            <ListNavigator.List />
                        </div>
                    )}
                    {displayList === "bookmarks" && (
                        <div className="location-cont">
                            <BookmarkList />
                        </div>
                    )}
                </ListNavigator.Provider>
            </div>
        );
    },
    shallowEqual,
);

const Button = (props: {
    className: string;
    tooltip: string;
    btnRef: React.RefObject<HTMLButtonElement>;
    clickAction: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) => {
    return (
        <button
            className={props.className}
            data-tooltip={props.tooltip}
            ref={props.btnRef}
            onClick={props.clickAction}
            // tabIndex={-1}
            disabled={props.disabled}
            // onFocus={(e) => e.currentTarget.blur()}
        >
            {props.children}
        </button>
    );
};
export default ReaderSideList;
