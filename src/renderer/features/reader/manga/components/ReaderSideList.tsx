import type { MangaBookmark } from "@common/types/db";
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
import { useAppContext } from "@renderer/App";
import { ItemDisplayTitle } from "@renderer/components/ItemDisplayTitle";
import ListNavigator from "@renderer/components/ListNavigator";
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { setAppSettings } from "@store/appSettings";
import { addBookmark, removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectResolvedItemMetadata } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { createRendererLogger } from "@utils/logger";
import { normalizeMangaPathSegment, resolveMangaChapterPath } from "@utils/mangaChapterPath";
import {
    CHAPTER_NAV_NONE,
    type ChapterNavDirection,
    listMangaChapterChildren,
    type MangaChapterChild,
    mangaChapterPathExists,
    orderMangaChapterList,
    pickChapterNavOpenPath,
    resolvePrevNextChapter,
    selectChapterNavList,
    shuffleArray,
} from "@utils/mangaChapters";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("manga/ReaderSideList");

import { shallowEqual } from "react-redux";
import AnilistBar from "../../../anilist/AnilistBar";
import BookmarkList from "./BookmarkList";
import ReaderSideListItem from "./ReaderSideListItem";

type ChapterData = MangaChapterChild;

const filterChapter = (filter: string, chapter: ChapterData) => {
    return new RegExp(filter, "ig").test(chapter.name);
};

const RECENT_CHAPTERS_SIZE = 10;

/** Stable fallback keeps an absent bookmark map from invalidating the button selector. */
const EMPTY_MANGA_BOOKMARKS: readonly MangaBookmark[] = [];

/** Stable fallback prevents an unloaded manga from creating a new chapter history reference. */
const EMPTY_CHAPTERS_READ: readonly string[] = [];

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
        /**
         * Pushes derived prev/next into the manga Reader for the chapter-changer labels.
         * State (not a ref) so those labels re-render; siblings are computed here from the
         * chapter list and open path, including while content is cleared on a chapter switch.
         */
        setPrevNextChapter: React.Dispatch<React.SetStateAction<{ prev: string; next: string }>>;
    }) => {
        const { contextMenuData, openInReader, setContextMenuData, closeReader } = useAppContext();

        const readerLink = useAppSelector((store) => store.reader.link);
        const readerType = useAppSelector((store) => store.reader.type);
        /** Reader content identifies the manga, while readerLink identifies its active chapter. */
        const mangaContentLink = useAppSelector((store) =>
            store.reader.type === "manga" ? store.reader.content?.link : undefined,
        );
        // TODO: temporary solution only, improve
        /** Stable manga folder; content clears during chapter switch, so derive from chapter path when needed */
        const mangaLink =
            mangaContentLink ??
            (readerType === "manga" && readerLink ? window.path.dirname(readerLink) : undefined);
        const mangaTitle = useAppSelector((store) =>
            store.reader.type === "manga" ? (store.reader.content?.title ?? "") : "",
        );
        const mangaProgressItemLink = useAppSelector((store) =>
            store.reader.type === "manga" ? store.reader.content?.progress?.itemLink : undefined,
        );
        const mangaChapterName = useAppSelector((store) =>
            store.reader.type === "manga" ? (store.reader.content?.progress?.chapterName ?? "") : "",
        );
        const mangaChaptersRead = useAppSelector((store) =>
            store.reader.type === "manga"
                ? (store.reader.content?.progress?.chaptersRead ?? EMPTY_CHAPTERS_READ)
                : EMPTY_CHAPTERS_READ,
        );
        const mangaDisplay = useAppSelector((store) =>
            selectResolvedItemMetadata(store, mangaContentLink ?? mangaLink),
        );
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
        const [displayList, setDisplayList] = useState<"" | "content" | "bookmarks">("content");

        const [isShuffleMode, setShuffleMode] = useState(false);
        const [shuffledLocations, setShuffledLocations] = useState<ChapterData[]>([]);
        const [isSearchFixed, setSearchFixed] = useState(false);
        const [filteredItemsFromList, setFilteredItemsFromList] = useState<ChapterData[]>([]);
        const [filterActive, setFilterActive] = useState(false);
        const recentChaptersRef = useRef<string[]>([]);
        const chapterNavInFlightRef = useRef(false);

        const currentChapterPath = useMemo(() => {
            if (mangaProgressItemLink && mangaChapterName) {
                return resolveMangaChapterPath(mangaProgressItemLink, mangaChapterName);
            }
            // content is null during chapter switch; reader.link is already the target chapter
            if (readerType === "manga" && readerLink) return normalizeMangaPathSegment(readerLink);
            return "";
        }, [mangaChapterName, mangaProgressItemLink, readerLink, readerType]);

        const sortedLocations = useMemo(
            () =>
                orderMangaChapterList(chapterData, {
                    sortBy: appSettings.locationListSortBy,
                    inverse: appSettings.locationListSortType === "inverse",
                }),
            [appSettings.locationListSortBy, appSettings.locationListSortType, chapterData],
        );

        const locationsToUse = isShuffleMode ? shuffledLocations : sortedLocations;
        // unpinned search is display-only; prev/next/random follow the pin
        const effectiveListForNav = selectChapterNavList(locationsToUse, filteredItemsFromList, {
            filterPinned: isSearchFixed,
            filterActive,
        });
        const chapterNavSiblings = useMemo(
            () =>
                resolvePrevNextChapter(effectiveListForNav, currentChapterPath, {
                    inverseSort: appSettings.locationListSortType === "inverse",
                    shuffle: isShuffleMode,
                    compareNames: (a, b) => window.app.betterSortOrder(a, b),
                }),
            [appSettings.locationListSortType, currentChapterPath, effectiveListForNav, isShuffleMode],
        );

        useEffect(() => {
            if (!isShuffleMode) {
                setShuffledLocations([]);
                return;
            }
            if (sortedLocations.length === 0) return;
            /* keep session order across a rescan; empty prev means first shuffle or a full refresh */
            setShuffledLocations((prev) => {
                if (prev.length === 0) return shuffleArray(sortedLocations);
                return orderMangaChapterList(sortedLocations, {
                    sortBy: appSettings.locationListSortBy,
                    inverse: appSettings.locationListSortType === "inverse",
                    shuffled: prev,
                });
            });
        }, [appSettings.locationListSortBy, appSettings.locationListSortType, isShuffleMode, sortedLocations]);

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
            if (
                !contextMenuData &&
                !isSideListPinned &&
                document.activeElement !== sideListRef.current &&
                !sideListRef.current?.contains(document.activeElement)
            )
                return setListOpen(false);
            setPreventListClose(true);
        }, [contextMenuData, isSideListPinned]);

        useLayoutEffect(() => {
            if (isSideListPinned) {
                setListOpen(true);
            }
        }, [isSideListPinned]);

        /* chapter-changer labels in Reader read this state; skip set when the pair is unchanged */
        useLayoutEffect(() => {
            setPrevNextChapter((init) =>
                init.prev === chapterNavSiblings.prev && init.next === chapterNavSiblings.next
                    ? init
                    : chapterNavSiblings,
            );
        }, [chapterNavSiblings, setPrevNextChapter]);

        /**
         * Scans the series folder and returns the name-sorted chapter list.
         * Does not clear random-chapter history; callers that mean a full refresh do that.
         */
        const scanMangaChapters = useCallback(async (): Promise<ChapterData[]> => {
            if (!mangaLink || !window.fs.isDir(mangaLink)) {
                setChapterData([]);
                return [];
            }

            try {
                const children = await listMangaChapterChildren(mangaLink);
                const sorted = [...children].sort((a, b) =>
                    window.app.betterSortOrder(
                        formatUtils.files.getName(a.name),
                        formatUtils.files.getName(b.name),
                    ),
                );
                setChapterData(sorted);
                return sorted;
            } catch (err) {
                if (err instanceof Error) {
                    dialogUtils.nodeError(err);
                } else {
                    log.error(`chapter list build failed for "${mangaLink}"`, err);
                }
                setChapterData([]);
                return [];
            }
        }, [mangaLink]);

        /** Manual / watcher refresh: rescan and reset recency; empty shuffle so the list is shuffled again. */
        const makeChapterList = useCallback(async () => {
            recentChaptersRef.current = [];
            setShuffledLocations([]);
            await scanMangaChapters();
        }, [scanMangaChapters]);

        useLayoutEffect(() => {
            void makeChapterList();

            if (!mangaLink || !window.fs.isDir(mangaLink) || !appSettings.autoRefreshSideList || isShuffleMode)
                return;

            let timeout: NodeJS.Timeout | undefined;
            const refresh = () => {
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(() => {
                    void makeChapterList();
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
            return () => {
                if (timeout) clearTimeout(timeout);
                closeWatcher();
            };
        }, [appSettings.autoRefreshSideList, isShuffleMode, makeChapterList, mangaLink]);

        const handleResizerDrag = useCallback(
            (e: MouseEvent) => {
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
            },
            [draggingResizer, isSideListPinned, makeScrollPos, setSideListWidth],
        );

        const handleResizerMouseUp = useCallback(() => {
            setDraggingResizer(false);
        }, []);

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

        /** Confirm when prev/next has no existing sibling after a disk rescan. */
        const showNoNeighborDialog = (direction: ChapterNavDirection) => {
            dialogUtils
                .confirm({
                    message: direction === "next" ? t("dialogs.noNextChapter") : t("dialogs.noPreviousChapter"),
                    buttons: [tDialogs("buttons.okAlt"), t("dialogs.home")],
                    noOption: false,
                    noLink: true,
                })
                .then((e) => {
                    if (e.response === 1) {
                        closeReader();
                    }
                });
        };

        /**
         * Opens prev/next after checking the target still exists. If the current chapter
         * or the planned sibling is gone (rename/delete before auto-refresh), rescans
         * and opens the name-neighbor instead of setting reader.link to a missing path.
         */
        const goToNeighborChapter = async (direction: ChapterNavDirection) => {
            if (chapterNavInFlightRef.current) return;
            chapterNavInFlightRef.current = true;
            try {
                const target = await pickChapterNavOpenPath({
                    list: effectiveListForNav,
                    currentLink: currentChapterPath,
                    direction,
                    inverseSort: appSettings.locationListSortType === "inverse",
                    shuffle: isShuffleMode,
                    compareNames: (a, b) => window.app.betterSortOrder(a, b),
                    pathExists: mangaChapterPathExists,
                    refreshList: async () => {
                        const scanned = await scanMangaChapters();
                        const ordered = orderMangaChapterList(scanned, {
                            sortBy: appSettings.locationListSortBy,
                            inverse: appSettings.locationListSortType === "inverse",
                            shuffled: isShuffleMode ? shuffledLocations : undefined,
                        });
                        return selectChapterNavList(ordered, filteredItemsFromList, {
                            filterPinned: isSearchFixed,
                            filterActive,
                        });
                    },
                });
                if (target === CHAPTER_NAV_NONE) {
                    showNoNeighborDialog(direction);
                    return;
                }
                await openInReader(target);
            } finally {
                chapterNavInFlightRef.current = false;
            }
        };

        const handlePrevChapterClick = () => {
            void goToNeighborChapter("prev");
        };

        const handleNextChapterClick = () => {
            void goToNeighborChapter("next");
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
        }, [draggingResizer, handleResizerDrag, handleResizerMouseUp]);

        const renderChapterItem = (chapter: ChapterData, _index: number, isSelected: boolean) => {
            return (
                <ReaderSideListItem
                    name={chapter.name}
                    inHistory={mangaChaptersRead.includes(chapter.name)}
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
                    !appSettings.showPageCountInSideList ? "hidePageCountInSideList" : ""
                }`}
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
                    resetFilterKey={currentChapterPath}
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
                            <MangaBookmarkButton btnRef={addToBookmarkRef} setShortcutText={setShortcutText} />
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
                                primary={mangaDisplay?.title ?? mangaTitle}
                                original={mangaDisplay?.originalTitle}
                            />
                        </div>
                        <div>
                            <span className="bold">{t("sideList.chapter")}</span>
                            <span className="bold"> : </span>
                            <span>{formatUtils.files.getName(mangaChapterName)}</span>
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

/**
 * Isolates page-sensitive bookmark state so page ticks do not reconcile the chapter navigator.
 */
const MangaBookmarkButton = memo(
    ({
        btnRef,
        setShortcutText,
    }: {
        btnRef: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
    }) => {
        const { t } = useTranslation("reader");
        const { t: tDialogs } = useTranslation("dialogs");
        const { t: tCommon } = useTranslation("common");
        const mangaContentLink = useAppSelector((store) =>
            store.reader.type === "manga" ? store.reader.content?.link : undefined,
        );
        const mangaChapterName = useAppSelector((store) =>
            store.reader.type === "manga" ? store.reader.content?.progress?.chapterName : undefined,
        );
        const currentPage = useAppSelector((store) =>
            store.reader.type === "manga" ? store.reader.content?.progress?.currentPage : undefined,
        );
        const bookmarks = useAppSelector((store) =>
            mangaContentLink
                ? (store.bookmarks.manga[mangaContentLink] ?? EMPTY_MANGA_BOOKMARKS)
                : EMPTY_MANGA_BOOKMARKS,
        );
        const dispatch = useAppDispatch();
        const bookmarkedId = bookmarks.find(
            (bookmark) => bookmark.chapterName === mangaChapterName && bookmark.page === currentPage,
        )?.id;

        const handleClick = () => {
            if (!mangaContentLink || !mangaChapterName) return;
            const itemLink = mangaContentLink;
            if (bookmarkedId != null) {
                void dialogUtils
                    .warn({
                        title: tDialogs("titles.warning"),
                        message: t("dialogs.removeBookmarkManga"),
                        noOption: false,
                        buttons: [tDialogs("buttons.cancel"), tCommon("actions.remove")],
                        defaultId: 0,
                    })
                    .then(({ response }) => {
                        if (response === 1) {
                            dispatch(removeBookmark({ itemLink, type: "manga", ids: [bookmarkedId] }));
                        }
                    });
                return;
            }
            dispatch(
                addBookmark({
                    type: "manga",
                    data: {
                        itemLink,
                        page: currentPage ?? 1,
                        chapterName: mangaChapterName,
                    },
                }),
            );
            setShortcutText(t("hud.bookmarkAdded"));
        };

        return (
            <Button
                className="ctrl-menu-item"
                tooltip={t("sideList.bookmark")}
                btnRef={btnRef}
                clickAction={handleClick}
            >
                <FontAwesomeIcon icon={bookmarkedId != null ? faBookmark : farBookmark} />
            </Button>
        );
    },
);
MangaBookmarkButton.displayName = "MangaBookmarkButton";

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
