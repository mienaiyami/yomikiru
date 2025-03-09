import {
    faSort,
    faSyncAlt,
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faThumbtack,
    faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, useEffect, useLayoutEffect, useRef, useState, useContext, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";
// import { updateCurrentHistoryPage } from "../store/history";
import { addBookmark } from "@store/bookmarks";
import { setAppSettings, setReaderSettings } from "@store/appSettings";
import { setPrevNextChapter } from "@store/prevNextChapter";
import AnilistBar from "../../anilist/AnilistBar";
import { formatUtils } from "@utils/file";
import { dialogUtils } from "@utils/dialog";
import { keyFormatter } from "@utils/keybindings";
import { getReaderManga, setReaderState } from "@store/reader";
import { useAppContext } from "src/renderer/App";
import ReaderSideListItem from "./ReaderSideListItem";

type ChapterData = { name: string; pages: number; link: string; dateModified: number };

const ReaderSideList = memo(
    ({
        openNextChapterRef,
        openPrevChapterRef,
        addToBookmarkRef,
        setshortcutText,
        isBookmarked,
        setBookmarked,
        isSideListPinned,
        setSideListPinned,
        setSideListWidth,
        makeScrollPos,
    }: {
        openNextChapterRef: React.RefObject<HTMLButtonElement>;
        openPrevChapterRef: React.RefObject<HTMLButtonElement>;
        addToBookmarkRef: React.RefObject<HTMLButtonElement>;
        isBookmarked: boolean;
        setBookmarked: React.Dispatch<React.SetStateAction<boolean>>;
        setshortcutText: React.Dispatch<React.SetStateAction<string>>;
        isSideListPinned: boolean;
        setSideListPinned: React.Dispatch<React.SetStateAction<boolean>>;
        setSideListWidth: React.Dispatch<React.SetStateAction<number>>;
        makeScrollPos: () => void;
    }) => {
        const { contextMenuData, openInReader, setContextMenuData, closeReader } = useAppContext();

        const linkInReader = useAppSelector((store) => store.reader.link);
        const mangaLink = useAppSelector((store) => store.reader.content?.link);
        // mangaInReader.link !== linkInReader
        const mangaInReader = useAppSelector(getReaderManga);
        const library = useAppSelector((store) => store.library);
        const appSettings = useAppSelector((store) => store.appSettings);
        const prevNextChapter = useAppSelector((store) => store.prevNextChapter);
        // const contextMenu = useAppSelector((store) => store.contextMenu);
        const anilistToken = useAppSelector((store) => store.anilist.token);
        const shortcuts = useAppSelector((store) => store.shortcuts);
        const dispatch = useAppDispatch();

        const sideListRef = useRef<HTMLDivElement>(null);
        const [chapterData, setChapterData] = useState<ChapterData[]>([]);
        const [filter, setFilter] = useState<string>("");
        const [isListOpen, setListOpen] = useState(false);
        const [preventListClose, setpreventListClose] = useState(false);
        // const prevMangaRef = useRef<string>("");

        const [draggingResizer, setDraggingResizer] = useState(false);

        const [focused, setFocused] = useState(-1);
        const locationContRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (
                !contextMenuData &&
                !isSideListPinned &&
                document.activeElement !== sideListRef.current &&
                !sideListRef.current?.contains(document.activeElement)
            )
                return setListOpen(false);
            setpreventListClose(true);
        }, [contextMenuData]);

        useLayoutEffect(() => {
            if (isSideListPinned) {
                setListOpen(true);
            }
        }, [isSideListPinned]);
        const changePrevNext = () => {
            if (mangaInReader) {
                const listDataName = chapterData.map((e) => e.name);
                const prevIndex = listDataName.indexOf(mangaInReader.progress?.chapterName || "") - 1;
                const nextIndex = listDataName.indexOf(mangaInReader.progress?.chapterName || "") + 1;
                const prevCh = prevIndex < 0 ? "~" : chapterData[prevIndex].link;
                const nextCh = nextIndex >= chapterData.length ? "~" : chapterData[nextIndex].link;
                dispatch(setPrevNextChapter({ prev: prevCh, next: nextCh }));
            }
        };
        useEffect(() => {
            if (chapterData.length >= 0) changePrevNext();
        }, [chapterData]);
        const makeChapterList = async (refresh = false) => {
            if (!refresh) {
                setFilter("");
                setFocused(-1);
            }
            // setFocused(-1);
            if (mangaLink) {
                const dir = mangaLink;
                try {
                    const files = await window.fs.readdir(dir);
                    const listData: ChapterData[] = [];
                    let validFile = 0;
                    let responseCompleted = 0;
                    files.forEach(async (e) => {
                        try {
                            const filePath = window.path.join(dir, e);

                            const stat = await window.fs.stat(filePath);
                            //todo refactor
                            if (stat.isDir) {
                                validFile++;
                                window.fs
                                    .readdir(filePath)
                                    .then((data) => {
                                        responseCompleted++;
                                        data = data.filter((e) => formatUtils.image.test(e));
                                        if (data.length > 0) {
                                            listData.push({
                                                name: e,
                                                pages: data.length,
                                                link: filePath,
                                                dateModified: stat.mtimeMs,
                                            });
                                        }
                                        if (responseCompleted >= validFile) {
                                            setChapterData(
                                                listData.sort((a, b) =>
                                                    window.app.betterSortOrder(a.name, b.name),
                                                ),
                                            );
                                        }
                                    })
                                    .catch((err) => {
                                        window.logger.error(err);
                                        responseCompleted++;
                                        if (responseCompleted >= validFile) {
                                            setChapterData(
                                                listData.sort((a, b) =>
                                                    window.app.betterSortOrder(a.name, b.name),
                                                ),
                                            );
                                        }
                                    });
                            } else if (formatUtils.files.test(filePath)) {
                                validFile++;
                                //todo why?
                                setTimeout(() => {
                                    responseCompleted++;
                                    listData.push({
                                        name: e,
                                        pages: 0,
                                        link: filePath,
                                        dateModified: stat.mtimeMs,
                                    });
                                    if (responseCompleted >= validFile) {
                                        setChapterData(
                                            listData.sort((a, b) => window.app.betterSortOrder(a.name, b.name)),
                                        );
                                    }
                                }, 1000);
                            }
                        } catch (err) {
                            if (err instanceof Error) dialogUtils.nodeError(err);
                            else console.error(err);
                        }
                    });
                } catch (err) {
                    if (err instanceof Error) dialogUtils.nodeError(err);
                    else console.error(err);
                }
            }
        };
        useLayoutEffect(() => {
            makeChapterList();

            if (mangaLink && appSettings.autoRefreshSideList) {
                const refresh = () => {
                    if (timeout) clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        makeChapterList(true);
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

        const temp_prevNextOpener = (link: string) => {
            if ([".xhtml", ".html", ".txt"].includes(window.path.extname(link).toLowerCase()))
                return openInReader(link);
            // todo :temp
            dispatch(
                setReaderState({
                    link: link,
                    type: "manga",
                    content: null,
                    mangaPageNumber: 1,
                    epubChapterId: undefined,
                    epubElementQueryString: undefined,
                }),
            );
        };

        const sortedLocations = useMemo(() => {
            const qq = (file: string) => {
                return formatUtils.files.getName(file);
            };
            const sorted =
                appSettings.locationListSortBy === "name"
                    ? chapterData.sort((a, b) => window.app.betterSortOrder(qq(a.name), qq(b.name)))
                    : chapterData.sort((a, b) => (a.dateModified < b.dateModified ? -1 : 1));
            return appSettings.locationListSortType === "inverse" ? [...sorted].reverse() : sorted;
        }, [chapterData, appSettings.locationListSortBy, appSettings.locationListSortType]);

        return (
            <div
                className={`readerSideList listCont ${isListOpen ? "open" : ""} ${
                    !appSettings.showTextFileBadge ? "hideTextFileBadge" : ""
                } ${!appSettings.showPageCountInSideList ? "hidePageCountInSideList" : ""}`}
                onMouseEnter={() => {
                    setpreventListClose(true);
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
                        setpreventListClose(false);
                    }
                }}
                onFocus={() => {
                    setListOpen(true);
                    setpreventListClose(true);
                }}
                onMouseDown={(e) => {
                    if (e.target instanceof Node && e.currentTarget.contains(e.target)) setpreventListClose(true);
                }}
                onBlur={(e) => {
                    if (
                        !preventListClose &&
                        !e.currentTarget.contains(document.activeElement) &&
                        !contextMenuData
                    ) {
                        setListOpen(false);
                        setpreventListClose(false);
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
                <div className="tools">
                    <div className="row1">
                        <input
                            type="text"
                            name=""
                            spellCheck={false}
                            placeholder="Type to Search"
                            // tabIndex={-1}
                            onChange={(e) => {
                                const val = e.target.value;
                                let filter = "";
                                for (let i = 0; i < val.length; i++) {
                                    filter += val[i] + ".*";
                                }
                                setFocused(-1);
                                setFilter(filter);
                            }}
                            onBlur={() => {
                                setFocused(-1);
                            }}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                    e.preventDefault();
                                }
                                if (e.key === "Escape") {
                                    e.currentTarget.blur();
                                }
                                const keyStr = keyFormatter(e);
                                if (keyStr === "" && e.key !== "Escape") return;

                                const shortcutsMapped = Object.fromEntries(
                                    shortcuts.map((e) => [e.command, e.keys]),
                                ) as Record<ShortcutCommands, string[]>;
                                switch (true) {
                                    case shortcutsMapped["contextMenu"].includes(keyStr): {
                                        const elem = locationContRef.current?.querySelector(
                                            '[data-focused="true"] a',
                                        ) as HTMLLIElement | null;
                                        if (elem) {
                                            e.currentTarget.blur();
                                            elem.dispatchEvent(
                                                window.contextMenu.fakeEvent(elem, e.currentTarget),
                                            );
                                        }
                                        break;
                                    }
                                    case shortcutsMapped["listDown"].includes(keyStr):
                                        e.preventDefault();
                                        setFocused((init) => {
                                            if (init + 1 >= chapterData.length) return 0;
                                            return init + 1;
                                        });
                                        break;
                                    case shortcutsMapped["listUp"].includes(keyStr):
                                        e.preventDefault();
                                        setFocused((init) => {
                                            if (init - 1 < 0) return chapterData.length - 1;
                                            return init - 1;
                                        });
                                        break;
                                    case shortcutsMapped["listSelect"].includes(keyStr): {
                                        const elem = locationContRef.current?.querySelector(
                                            '[data-focused="true"] a',
                                        ) as HTMLLIElement | null;
                                        if (elem) return elem.click();
                                        const elems = locationContRef.current?.querySelectorAll("a");
                                        if (elems?.length === 1) elems[0].click();
                                        break;
                                    }
                                    default:
                                        break;
                                }
                            }}
                        />
                        {!appSettings.autoRefreshSideList && (
                            <button
                                // tabIndex={-1}
                                data-tooltip="Refresh"
                                onClick={() => {
                                    makeChapterList();
                                }}
                            >
                                <FontAwesomeIcon icon={faSyncAlt} />
                            </button>
                        )}
                        <button
                            data-tooltip={
                                "Sort: " +
                                (appSettings.locationListSortType === "normal" ? "▲ " : "▼ ") +
                                appSettings.locationListSortBy.toUpperCase()
                            }
                            // tabIndex={-1}
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
                                temp_prevNextOpener(prevNextChapter.prev);
                            }}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </Button>
                        <Button
                            className="ctrl-menu-item bookmarkBtn"
                            tooltip="Bookmark"
                            btnRef={addToBookmarkRef}
                            clickAction={() => {
                                if (isBookmarked) {
                                    return dialogUtils
                                        .warn({
                                            title: "Warning",
                                            message:
                                                "Remove - Remove Bookmark\n" +
                                                "Replace - Replace existing bookmark with current page number",
                                            noOption: false,
                                            buttons: ["Cancel", "Remove", "Replace"],
                                            defaultId: 0,
                                        })
                                        .then(({ response }) => {
                                            // if (response === 1) {
                                            //     dispatch(removeBookmark(linkInReader.link));
                                            //     setshortcutText("Bookmark Removed");
                                            //     setBookmarked(false);
                                            // }
                                            // if (response === 2) {
                                            //     setshortcutText("Bookmark Updated");
                                            //     dispatch(
                                            //         updateBookmark()
                                            //     );
                                            // }
                                        });
                                }
                                if (mangaInReader?.progress) {
                                    // was addnewBookmark before
                                    dispatch(
                                        addBookmark({
                                            type: "manga",
                                            data: {
                                                itemLink: mangaInReader.progress.itemLink,
                                                page: mangaInReader.progress.currentPage || 1,
                                                link: mangaInReader.link || "",
                                                note: "",
                                                title: mangaInReader.progress.chapterName || "",
                                            },
                                        }),
                                    );
                                    setshortcutText("Bookmark Added");
                                    setBookmarked(true);
                                }
                            }}
                        >
                            <FontAwesomeIcon icon={isBookmarked ? faBookmark : farBookmark} />
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
                                temp_prevNextOpener(prevNextChapter.next);
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
                <div className="tools">
                    <div className="row2">
                        <button
                            className="ctrl-menu-item"
                            data-tooltip="Improves performance"
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        hideSideList: !appSettings.readerSettings.hideSideList,
                                    }),
                                );
                            }}
                        >
                            {appSettings.readerSettings.hideSideList ? "Show" : "Hide"} List
                        </button>
                        <button
                            className="ctrl-menu-item"
                            data-tooltip="Locate Current Chapter"
                            onClick={() => {
                                if (sideListRef.current) {
                                    sideListRef.current.querySelectorAll("a").forEach((e) => {
                                        if (e.getAttribute("data-url") === mangaInReader?.link)
                                            e.scrollIntoView({ block: "nearest" });
                                    });
                                }
                            }}
                        >
                            <FontAwesomeIcon icon={faLocationDot} />
                        </button>
                    </div>
                </div>
                {anilistToken && <AnilistBar />}
                <div
                    className="location-cont"
                    ref={locationContRef}
                    style={{
                        display: appSettings.readerSettings.hideSideList ? "none" : "initial",
                    }}
                >
                    {chapterData.length <= 0 ? (
                        <p>Loading...</p>
                    ) : (
                        <ol>
                            {sortedLocations
                                .filter((e) => new RegExp(filter, "ig") && new RegExp(filter, "ig").test(e.name))
                                .map(
                                    (e, i, arr) =>
                                        new RegExp(filter, "ig") &&
                                        new RegExp(filter, "ig").test(e.name) && (
                                            <ReaderSideListItem
                                                name={e.name}
                                                inHistory={Object.hasOwn(library.items, e.link)}
                                                focused={focused >= 0 && focused % arr.length === i}
                                                key={e.name}
                                                pages={e.pages}
                                                current={mangaInReader?.link === e.link}
                                                link={e.link}
                                            />
                                        ),
                                )}
                        </ol>
                    )}
                </div>
            </div>
        );
    },
);

const Button = (props: any) => {
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
