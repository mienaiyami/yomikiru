import {
    faSort,
    faSyncAlt,
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faThumbtack,
} from "@fortawesome/free-solid-svg-icons";
import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReaderSideListItem from "./ReaderSideListItem";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setLinkInReader } from "../store/linkInReader";
import { updateLastHistoryPage } from "../store/history";
import { addBookmark, updateBookmark, removeBookmark } from "../store/bookmarks";
import { setAppSettings } from "../store/appSettings";
import { setPrevNextChapter } from "../store/prevNextChapter";

type ChapterData = { name: string; pages: number; link: string };

const ReaderSideList = ({
    openNextChapterRef,
    openPrevChapterRef,
    addToBookmarkRef,
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
    isSideListPinned: boolean;
    setSideListPinned: React.Dispatch<React.SetStateAction<boolean>>;
    setSideListWidth: React.Dispatch<React.SetStateAction<number>>;
    makeScrollPos: () => void;
}) => {
    const mangaInReader = useAppSelector((store) => store.mangaInReader);
    const history = useAppSelector((store) => store.history);
    const appSettings = useAppSelector((store) => store.appSettings);
    const prevNextChapter = useAppSelector((store) => store.prevNextChapter);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    const contextMenu = useAppSelector((store) => store.contextMenu);

    const dispatch = useAppDispatch();

    const sideListRef = useRef<HTMLDivElement>(null);
    const [chapterData, setChapterData] = useState<ChapterData[]>([]);
    const [filter, setFilter] = useState<string>("");
    const [isListOpen, setListOpen] = useState(false);
    const [preventListClose, setpreventListClose] = useState(false);
    const prevMangaRef = useRef<string>("");
    const [historySimple, setHistorySimple] = useState<string[]>([]);
    const [draggingResizer, setDraggingResizer] = useState(false);

    //TODO: useless rn
    const currentLinkInListRef = useRef<HTMLAnchorElement>(null);
    useEffect(() => {
        if (!contextMenu && !isSideListPinned) return setListOpen(false);
        setpreventListClose(true);
    }, [contextMenu]);
    useEffect(() => {
        if (mangaInReader) {
            const historyItem = history.find((e) => e.mangaLink === window.path.dirname(mangaInReader.link));
            if (historyItem) setHistorySimple(historyItem.chaptersRead);
        }
    }, [history]);
    useLayoutEffect(() => {
        if (isSideListPinned) {
            setListOpen(true);
        }
    }, [isSideListPinned]);
    const changePrevNext = () => {
        if (mangaInReader) {
            const listDataName = chapterData.map((e) => e.name);
            const dir = mangaInReader.link.replace(mangaInReader.chapterName, "");
            const prevIndex = listDataName.indexOf(mangaInReader.chapterName) - 1;
            const nextIndex = listDataName.indexOf(mangaInReader.chapterName) + 1;
            const prevCh = prevIndex < 0 ? "~" : dir + chapterData[prevIndex].name;
            const nextCh = nextIndex >= chapterData.length ? "~" : dir + chapterData[nextIndex].name;
            dispatch(setPrevNextChapter({ prev: prevCh, next: nextCh }));
        }
    };
    useEffect(() => {
        if (chapterData.length >= 0) changePrevNext();
    }, [chapterData]);
    const makeChapterList = async () => {
        if (mangaInReader) {
            const dir = mangaInReader.link.replace(mangaInReader.chapterName, "");
            window.fs.readdir(dir, (err, files) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                    return;
                }
                const listData: ChapterData[] = [];
                let validFile = 0;
                let responseCompleted = 0;
                files.forEach((e) => {
                    const path = window.path.join(dir, e);
                    if (window.fs.lstatSync(path).isDirectory()) {
                        validFile++;
                        window.fs.promises
                            .readdir(path)
                            .then((data) => {
                                responseCompleted++;
                                data = data.filter((e) =>
                                    window.supportedFormats.includes(window.path.extname(e).toLowerCase())
                                );
                                if (data.length > 0) {
                                    listData.push({
                                        name: window.app.replaceExtension(e),
                                        pages: data.length,
                                        link: path,
                                    });
                                }
                                if (responseCompleted >= validFile) {
                                    setChapterData(
                                        listData.sort((a, b) => window.app.betterSortOrder(a.name, b.name))
                                    );
                                }
                            })
                            .catch((err) => {
                                window.logger.error(err);
                                responseCompleted++;
                                if (responseCompleted >= validFile) {
                                    setChapterData(
                                        listData.sort((a, b) => window.app.betterSortOrder(a.name, b.name))
                                    );
                                }
                            });
                    } else if ([".zip", ".cbz"].includes(window.path.extname(path))) {
                        validFile++;
                        setTimeout(() => {
                            responseCompleted++;
                            listData.push({
                                name: window.app.replaceExtension(e),
                                pages: 0,
                                link: path,
                            });
                            if (responseCompleted >= validFile) {
                                setChapterData(
                                    listData.sort((a, b) => window.app.betterSortOrder(a.name, b.name))
                                );
                            }
                        }, 1000);
                    }
                });
            });
        }
    };
    useEffect(() => {
        if (mangaInReader) {
            if (prevMangaRef.current === mangaInReader.mangaName) {
                changePrevNext();
                return;
            }
            prevMangaRef.current = mangaInReader.mangaName;
            makeChapterList();
        }
    }, [mangaInReader]);
    const List = (chapterData: ChapterData[], filter: string) => {
        return chapterData.map((e) => {
            if (mangaInReader && new RegExp(filter, "ig").test(e.name)) {
                const current = mangaInReader?.link === e.link;
                return (
                    <ReaderSideListItem
                        name={e.name}
                        alreadyRead={historySimple.includes(e.name)}
                        key={e.name}
                        pages={e.pages}
                        current={current}
                        ref={current ? currentLinkInListRef : null}
                        realRef={current ? currentLinkInListRef : null}
                        link={e.link}
                    />
                );
            }
        });
    };
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
    return (
        <div
            className={`currentMangaList listCont ${isListOpen ? "open" : ""}`}
            onMouseEnter={() => {
                setpreventListClose(true);
                if (!isListOpen) setListOpen(true);
            }}
            onMouseLeave={(e) => {
                if (!isSideListPinned) {
                    if (preventListClose && !contextMenu && !e.currentTarget.contains(document.activeElement))
                        setListOpen(false);
                    setpreventListClose(false);
                }
            }}
            onMouseDown={(e) => {
                if (e.target instanceof Node && e.currentTarget.contains(e.target)) setpreventListClose(true);
            }}
            onBlur={(e) => {
                if (!preventListClose && !e.currentTarget.contains(document.activeElement)) setListOpen(false);
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
                onClick={() => {
                    makeScrollPos();
                    if (isSideListPinned) {
                        sideListRef.current?.blur();
                        setListOpen(false);
                    }
                    setSideListPinned((init) => !init);
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
                            setFilter(filter);
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }
                            if (e.key === "Escape") {
                                e.currentTarget.blur();
                            }
                        }}
                    />
                    <button
                        // tabIndex={-1}
                        data-tooltip="Refresh"
                        onClick={() => {
                            makeChapterList();
                        }}
                    >
                        <FontAwesomeIcon icon={faSyncAlt} />
                    </button>
                    <button
                        // tabIndex={-1}
                        data-tooltip="Sort"
                        onClick={() =>
                            dispatch(
                                setAppSettings({
                                    locationListSortType:
                                        appSettings.locationListSortType === "inverse" ? "normal" : "inverse",
                                })
                            )
                        }
                    >
                        <FontAwesomeIcon icon={faSort} />
                    </button>
                </div>
                <div className="row2">
                    <Button
                        className="ctrl-menu-item"
                        btnRef={openPrevChapterRef}
                        tooltip="Open Previous"
                        disabled={prevNextChapter.prev === "~"}
                        clickAction={() => {
                            dispatch(updateLastHistoryPage({ linkInReader: linkInReader.link }));
                            dispatch(setLinkInReader({ link: prevNextChapter.prev, page: 1 }));
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </Button>
                    <Button
                        className="ctrl-menu-item"
                        tooltip="Bookmark"
                        btnRef={addToBookmarkRef}
                        clickAction={() => {
                            if (isBookmarked) {
                                return window.dialog
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
                                        if (response === 1) {
                                            dispatch(removeBookmark(linkInReader.link));
                                            setBookmarked(false);
                                        }
                                        if (response === 2) {
                                            dispatch(
                                                updateBookmark({
                                                    link: linkInReader.link,
                                                    page: window.app.currentPageNumber,
                                                })
                                            );
                                        }
                                    });
                            }
                            if (mangaInReader) {
                                // todo: was addnewBookmark before
                                dispatch(
                                    addBookmark({ ...mangaInReader, page: window.app.currentPageNumber || 0 })
                                );
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
                        disabled={prevNextChapter.next === "~"}
                        clickAction={() => {
                            dispatch(updateLastHistoryPage({ linkInReader: linkInReader.link }));
                            dispatch(setLinkInReader({ link: prevNextChapter.next, page: 1 }));
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </Button>
                </div>
            </div>
            <div className="in-reader">
                <div>
                    <b className="prop">Manga</b> {mangaInReader?.mangaName}
                </div>
                <div>
                    <b className="prop">Chapter</b> {mangaInReader?.chapterName}
                </div>
            </div>
            <div className="location-cont">
                {chapterData.length <= 0 ? (
                    <p>Loading...</p>
                ) : (
                    <ol>
                        {appSettings.locationListSortType === "inverse"
                            ? List([...chapterData], filter).reverse()
                            : List(chapterData, filter)}
                    </ol>
                )}
            </div>
        </div>
    );
};

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
