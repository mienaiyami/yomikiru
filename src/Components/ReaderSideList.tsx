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
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";
import ReaderSideListItem from "./ReaderSideListItem";

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
    const {
        mangaInReader,
        history,
        setAppSettings,
        appSettings,
        prevNextChapter,
        setPrevNextChapter,
        setBookmarks,
        addNewBookmark,
        linkInReader,
        setLinkInReader,
    } = useContext(AppContext);
    const { isContextMenuOpen } = useContext(MainContext);
    const sideListRef = useRef<HTMLDivElement>(null);
    const [chapterData, setChapterData] = useState<{ name: string; pages: number }[]>([]);
    const [filter, setFilter] = useState<string>("");
    const [isListOpen, setListOpen] = useState(false);
    const [preventListClose, setpreventListClose] = useState(false);
    const prevMangaRef = useRef<string>("");
    const [historySimple, sethistorySimple] = useState(history.map((e) => e.link));
    const [draggingResizer, setDraggingResizer] = useState(false);

    //TODO: useless rn
    const currentLinkInListRef = useRef<HTMLAnchorElement>(null);
    useEffect(() => {
        if (!isContextMenuOpen && !isSideListPinned) return setListOpen(false);
        setpreventListClose(true);
    }, [isContextMenuOpen]);
    useEffect(() => {
        sethistorySimple(history.map((e) => e.link));
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
            const prevCh = prevIndex < 0 ? "first" : dir + chapterData[prevIndex].name;
            const nextCh = nextIndex >= chapterData.length ? "last" : dir + chapterData[nextIndex].name;
            setPrevNextChapter({ prev: prevCh, next: nextCh });
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
                const listData: { name: string; pages: number }[] = [];
                let validFile = 0;
                let responseCompleted = 0;
                files.forEach((e) => {
                    const path = dir + "\\" + e;
                    if (window.fs.lstatSync(path).isDirectory()) {
                        validFile++;
                        window.fs.promises
                            .readdir(path)
                            .then((data) => {
                                responseCompleted++;
                                data = data.filter((e) =>
                                    window.supportedFormats.includes(window.path.extname(e))
                                );
                                if (data.length > 0) {
                                    listData.push({ name: e, pages: data.length });
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
                        responseCompleted++;
                        listData.push({ name: e, pages: 0 });
                        if (responseCompleted >= validFile) {
                            setChapterData(listData.sort((a, b) => window.app.betterSortOrder(a.name, b.name)));
                        }
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
    const List = (chapterData: { name: string; pages: number }[], filter: string) => {
        return chapterData.map((e) => {
            if (mangaInReader && new RegExp(filter, "ig").test(e.name)) {
                const link = mangaInReader.link.replace(mangaInReader.chapterName, e.name);
                const current = mangaInReader?.chapterName === e.name;
                return (
                    <ReaderSideListItem
                        name={e.name}
                        alreadyRead={historySimple.includes(link)}
                        key={e.name}
                        pages={e.pages}
                        current={current}
                        ref={current ? currentLinkInListRef : null}
                        realRef={current ? currentLinkInListRef : null}
                        link={link}
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
            window.addEventListener("mouseup", handleResizerMouseUp);
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
                    if (
                        preventListClose &&
                        !isContextMenuOpen &&
                        !e.currentTarget.contains(document.activeElement)
                    )
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
                            setAppSettings((init) => {
                                switch (init.locationListSortType) {
                                    case "normal":
                                        init.locationListSortType = "inverse";
                                        break;
                                    case "inverse":
                                        init.locationListSortType = "normal";
                                        break;
                                    default:
                                        break;
                                }
                                return { ...init };
                            })
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
                        disabled={prevNextChapter.prev === "first"}
                        clickAction={() => {
                            setLinkInReader(prevNextChapter.prev);
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
                                        message: "Remove Bookmark?",
                                        noOption: false,
                                    })
                                    .then((res) => {
                                        if (res.response === 0) {
                                            setBookmarks((init) => [
                                                ...init.filter((e) => e.link !== linkInReader),
                                            ]);
                                            setBookmarked(false);
                                        }
                                    });
                            }
                            if (mangaInReader) {
                                addNewBookmark(mangaInReader);
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
                        disabled={prevNextChapter.next === "last"}
                        clickAction={() => {
                            setLinkInReader(prevNextChapter.next);
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </Button>
                </div>
            </div>
            <h1>
                Manga: <span className="mangaName">{mangaInReader?.mangaName}</span>
                <br />
                Chapter: <span className="chapterName">{mangaInReader?.chapterName}</span>
            </h1>
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
