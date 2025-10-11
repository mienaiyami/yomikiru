import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import {
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faLocationDot,
    faRandom,
    faSort,
    faSyncAlt,
    faThumbtack,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ListNavigator from "@renderer/components/ListNavigator";
import { setAppSettings } from "@store/appSettings";
import { addBookmark, removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderManga, setReaderState } from "@store/reader";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";
import AnilistBar from "../../../anilist/AnilistBar";
import BookmarkList from "./BookmarkList";
import ReaderSideListItem from "./ReaderSideListItem";

type ChapterData = { name: string; pages: number; link: string; dateModified: number };

const filterChapter = (filter: string, chapter: ChapterData) => {
    return new RegExp(filter, "ig").test(chapter.name);
};

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

        const mangaLink = useAppSelector((store) => store.reader.content?.link);
        /** mangaInReader.link !== linkInReader */
        const mangaInReader = useAppSelector(getReaderManga);
        const bookmarks = useAppSelector((store) => store.bookmarks);
        const appSettings = useAppSelector((store) => store.appSettings);
        const anilistToken = useAppSelector((store) => store.anilist.token);
        const dispatch = useAppDispatch();

        const sideListRef = useRef<HTMLDivElement>(null);
        const [chapterData, setChapterData] = useState<ChapterData[]>([]);
        const [isListOpen, setListOpen] = useState(false);
        const [preventListClose, setPreventListClose] = useState(false);

        const [draggingResizer, setDraggingResizer] = useState(false);

        const [displayList, setDisplayList] = useState<"" | "content" | "bookmarks">("content");

        const [bookmarkedId, setBookmarkedId] = useState<number | null>(null);

        const sortedLocations = useMemo(() => {
            if (chapterData.length === 0) return [];
            const sorted = [...chapterData].sort((a, b) => {
                // chapterData is already sorted by name
                if (appSettings.locationListSortBy === "date") return a.dateModified - b.dateModified;
                return 0;
            });

            return appSettings.locationListSortType === "inverse" ? sorted.reverse() : sorted;
        }, [chapterData, appSettings.locationListSortBy, appSettings.locationListSortType]);

        useEffect(() => {
            if (mangaInReader?.link) {
                setBookmarkedId(
                    bookmarks.manga[mangaInReader.link]?.find(
                        (b) =>
                            b.link === mangaInReader.progress?.chapterLink &&
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
            if (sortedLocations.length >= 0 && mangaInReader) {
                const index = sortedLocations.findIndex((e) => e.link === mangaInReader.progress?.chapterLink);
                const prevCh = index <= 0 ? "~" : sortedLocations[index - 1].link;
                const nextCh = index >= sortedLocations.length - 1 ? "~" : sortedLocations[index + 1].link;
                if (appSettings.locationListSortType === "inverse") {
                    setPrevNextChapter({ prev: nextCh, next: prevCh });
                } else {
                    setPrevNextChapter({ prev: prevCh, next: nextCh });
                }
            }
        }, [sortedLocations, appSettings.locationListSortType]);

        const makeChapterList = async () => {
            if (!mangaLink) return;

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
                                window.logger.error(`Failed to read directory "${filePath}":`, err);
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
                        window.logger.error(`Failed to process file "${fileName}":`, err);
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
                    console.error("Failed to read manga directory:", err);
                }
                setChapterData([]);
            }
        };
        useLayoutEffect(() => {
            makeChapterList();

            if (mangaLink && appSettings.autoRefreshSideList) {
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
                    current={mangaInReader?.progress?.chapterLink === chapter.link}
                    link={chapter.link}
                    onClick={() => openInReader(chapter.link)}
                />
            );
        };

        return (
            <div
                className={`readerSideList listCont ${isListOpen ? "open" : ""} ${
                    !appSettings.showTextFileBadge ? "hideTextFileBadge" : ""
                } ${!appSettings.showPageCountInSideList ? "hidePageCountInSideList" : ""}`}
                onMouseEnter={() => {
                    setPreventListClose(true);
                    if (!isListOpen) setListOpen(true);
                }}
                onMouseLeave={(e) => {
                    if (!isSideListPinned) {
                        if (
                            preventListClose &&
                            !contextMenuData &&
                            !e.currentTarget.contains(document.activeElement)
                        )
                            setListOpen(false);
                        setPreventListClose(false);
                    }
                }}
                onFocus={() => {
                    setListOpen(true);
                    setPreventListClose(true);
                }}
                onMouseDown={(e) => {
                    if (e.target instanceof Node && e.currentTarget.contains(e.target)) setPreventListClose(true);
                }}
                onBlur={(e) => {
                    if (
                        !preventListClose &&
                        !e.currentTarget.contains(document.activeElement) &&
                        !contextMenuData
                    ) {
                        setListOpen(false);
                        setPreventListClose(false);
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.currentTarget.blur();
                    }
                }}
                ref={sideListRef}
                tabIndex={-1}
            >
                <div
                    className="indicator"
                    onClick={(e) => {
                        makeScrollPos();
                        if (isSideListPinned) {
                            sideListRef.current?.blur();
                            setListOpen(false);
                        }
                        setSideListPinned((init) => !init);
                        e.currentTarget.blur();
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if ([" ", "Enter"].includes(e.key)) e.currentTarget.click();
                    }}
                >
                    <FontAwesomeIcon
                        icon={faThumbtack}
                        style={{ transform: isSideListPinned ? "rotate(45deg)" : "" }}
                    />
                </div>
                <div
                    className="reSizer"
                    onMouseDown={() => {
                        setDraggingResizer(true);
                    }}
                    onMouseUp={handleResizerMouseUp}
                ></div>

                <ListNavigator.Provider
                    items={sortedLocations}
                    filterFn={filterChapter}
                    renderItem={renderChapterItem}
                    onContextMenu={handleContextMenu}
                    onSelect={handleSelect}
                    emptyMessage="No chapters found"
                >
                    <div className="tools">
                        <div className="row1">
                            <ListNavigator.SearchInput placeholder="Search chapters..." />

                            {!appSettings.autoRefreshSideList && (
                                <button data-tooltip="Refresh" onClick={() => makeChapterList()}>
                                    <FontAwesomeIcon icon={faSyncAlt} />
                                </button>
                            )}

                            <button
                                data-tooltip={
                                    "Sort: " +
                                    (appSettings.locationListSortType === "normal" ? "▲ " : "▼ ") +
                                    appSettings.locationListSortBy.toUpperCase()
                                }
                                onClick={(e) => {
                                    const items: Menu.ListItem[] = [
                                        {
                                            label: "Name",
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        locationListSortBy: "name",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.locationListSortBy === "name",
                                        },
                                        {
                                            label: "Date Modified",
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
                                            label: "Ascending",
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        locationListSortType: "normal",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.locationListSortType === "normal",
                                        },
                                        {
                                            label: "Descending",
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        locationListSortType: "inverse",
                                                    }),
                                                );
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
                                }}
                            >
                                <FontAwesomeIcon icon={faSort} />
                            </button>
                        </div>

                        <div className="row2">
                            <Button
                                className="ctrl-menu-item"
                                btnRef={openPrevChapterRef}
                                tooltip="Open Previous"
                                clickAction={() => {
                                    if (prevNextChapter.prev === "~") {
                                        dialogUtils
                                            .confirm({
                                                message: "There's no previous chapter.",
                                                buttons: ["Ok", "Home"],
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
                                }}
                            >
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </Button>
                            <Button
                                className="ctrl-menu-item"
                                btnRef={openNextChapterRef}
                                tooltip="Open Next"
                                clickAction={() => {
                                    if (prevNextChapter.next === "~") {
                                        dialogUtils
                                            .confirm({
                                                message: "There's no next chapter.",
                                                buttons: ["Ok", "Home"],
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
                                }}
                            >
                                <FontAwesomeIcon icon={faArrowRight} />
                            </Button>
                        </div>
                    </div>

                    <div className="in-reader">
                        <div>
                            <span className="bold">Manga</span>
                            <span className="bold"> : </span>
                            <span>{mangaInReader?.title}</span>
                        </div>
                        <div>
                            <span className="bold">Chapter</span>
                            <span className="bold"> : </span>
                            <span>{formatUtils.files.getName(mangaInReader?.progress?.chapterName || "")}</span>
                        </div>
                    </div>

                    {anilistToken && <AnilistBar />}

                    <div className="tools">
                        <div className="btnOptions">
                            <button
                                className={`${displayList === "content" ? "selected" : ""}`}
                                onClick={() => {
                                    setDisplayList((init) => (init === "content" ? "" : "content"));
                                }}
                                data-tooltip="Click again to hide"
                            >
                                Content
                            </button>
                            <button
                                className={`${displayList === "bookmarks" ? "selected" : ""}`}
                                onClick={() => {
                                    setDisplayList((init) => (init === "bookmarks" ? "" : "bookmarks"));
                                }}
                            >
                                Bookmarks
                            </button>
                        </div>
                        {displayList === "content" && (
                            <div className="row2">
                                <button
                                    className="ctrl-menu-item"
                                    data-tooltip="Locate Current Chapter"
                                    onClick={() => {
                                        if (sideListRef.current) {
                                            sideListRef.current.querySelectorAll("[data-url]").forEach((e) => {
                                                if (
                                                    e.getAttribute("data-url") ===
                                                    mangaInReader?.progress?.chapterLink
                                                )
                                                    e.scrollIntoView({ block: "nearest" });
                                            });
                                        }
                                    }}
                                >
                                    <FontAwesomeIcon icon={faLocationDot} />
                                </button>
                                <button
                                    className="ctrl-menu-item"
                                    data-tooltip="Open Random Chapter"
                                    disabled={chapterData.length === 0}
                                    onClick={() => {
                                        if (chapterData.length === 0) return;
                                        const randomChapter =
                                            chapterData[Math.floor(Math.random() * chapterData.length)];
                                        openInReader(randomChapter.link);
                                    }}
                                >
                                    <FontAwesomeIcon icon={faRandom} />
                                </button>
                                <Button
                                    className="ctrl-menu-item"
                                    tooltip="Bookmark"
                                    btnRef={addToBookmarkRef}
                                    clickAction={() => {
                                        if (!mangaInReader || !mangaInReader.progress) return;
                                        const itemLink = mangaInReader.link;
                                        if (bookmarkedId !== null) {
                                            return dialogUtils
                                                .warn({
                                                    title: "Warning",
                                                    message: "Remove - Remove Bookmark",
                                                    noOption: false,
                                                    buttons: ["Cancel", "Remove"],
                                                    defaultId: 0,
                                                })
                                                .then(({ response }) => {
                                                    if (response === 1 && mangaInReader) {
                                                        dispatch(
                                                            removeBookmark({
                                                                itemLink,
                                                                type: "manga",
                                                                ids: [bookmarkedId],
                                                            }),
                                                        );
                                                    }
                                                });
                                        }
                                        dispatch(
                                            addBookmark({
                                                type: "manga",
                                                data: {
                                                    itemLink,
                                                    page: mangaInReader.progress.currentPage || 1,
                                                    link: mangaInReader.progress.chapterLink,
                                                    chapterName: mangaInReader.progress.chapterName,
                                                },
                                            }),
                                        );
                                        setShortcutText("Bookmark Added");
                                    }}
                                >
                                    <FontAwesomeIcon icon={bookmarkedId !== null ? faBookmark : farBookmark} />
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
