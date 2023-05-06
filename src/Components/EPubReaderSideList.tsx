import {
    faSort,
    faSyncAlt,
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faThumbtack,
    faArrowUp,
    faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
// import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setPrevNextChapter } from "../store/prevNextChapter";

const EPubReaderSideList = ({
    tocData,
    openNextChapterRef,
    openPrevChapterRef,
    currentChapterURL,
    setCurrentChapterURL,
    // addToBookmarkRef,
    // setshortcutText,
    // isBookmarked,
    // setBookmarked,
    findInPage,
    epubLinkClick,
    isSideListPinned,
    setSideListPinned,
    setSideListWidth,
    makeScrollPos,
}: {
    tocData: TOCData;
    openNextChapterRef: React.RefObject<HTMLButtonElement>;
    openPrevChapterRef: React.RefObject<HTMLButtonElement>;
    /**
     * `~` if appSettings.epubReaderSettings.loadOneChapter is `false`
     */
    currentChapterURL: string;
    setCurrentChapterURL: React.Dispatch<React.SetStateAction<string>>;

    epubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    // addToBookmarkRef: React.RefObject<HTMLButtonElement>;
    // isBookmarked: boolean;
    // setBookmarked: React.Dispatch<React.SetStateAction<boolean>>;
    // setshortcutText: React.Dispatch<React.SetStateAction<string>>;
    isSideListPinned: boolean;
    setSideListPinned: React.Dispatch<React.SetStateAction<boolean>>;
    setSideListWidth: React.Dispatch<React.SetStateAction<number>>;
    findInPage: (str: string, forward?: boolean) => void;
    makeScrollPos: () => void;
}) => {
    const bookInReader = useAppSelector((store) => store.bookInReader);
    // const history = useAppSelector((store) => store.history);
    const appSettings = useAppSelector((store) => store.appSettings);
    const prevNextChapter = useAppSelector((store) => store.prevNextChapter);
    // const contextMenu = useAppSelector((store) => store.contextMenu);

    const dispatch = useAppDispatch();

    const sideListRef = useRef<HTMLDivElement>(null);
    const [findInPageStr, setFindInPageStr] = useState<string>("");
    const [isListOpen, setListOpen] = useState(false);
    const [preventListClose, setpreventListClose] = useState(false);
    // const prevMangaRef = useRef<string>("");
    // const [historySimple, setHistorySimple] = useState<string[]>([]);
    const [draggingResizer, setDraggingResizer] = useState(false);

    // useEffect(() => {
    //     if (!contextMenu && !isSideListPinned) return setListOpen(false);
    //     setpreventListClose(true);
    // }, [contextMenu]);
    // useEffect(() => {
    //     if (mangaInReader) {
    //         const historyItem = history.find((e) => e.mangaLink === window.path.dirname(mangaInReader.link));
    //         if (historyItem) setHistorySimple(historyItem.chaptersRead);
    //     }
    // }, [history]);
    useLayoutEffect(() => {
        if (isSideListPinned) {
            setListOpen(true);
        }
    }, [isSideListPinned]);

    const changePrevNext = () => {
        if (bookInReader) {
            const listData = tocData.nav.map((e) => e.src);
            let nextIndex = listData.indexOf(currentChapterURL) + 1;
            if (nextIndex < listData.length && listData[nextIndex] === currentChapterURL) nextIndex += 1;
            let prevIndex = listData.indexOf(currentChapterURL) - 1;
            if (prevIndex > 0 && listData[prevIndex] === currentChapterURL) prevIndex -= 1;
            const prevCh = prevIndex < 0 ? "~" : listData[prevIndex];
            const nextCh = nextIndex >= listData.length ? "~" : listData[nextIndex];
            // console.log({ prev: prevCh, next: nextCh });
            dispatch(setPrevNextChapter({ prev: prevCh, next: nextCh }));
        }
    };

    useEffect(() => {
        if (appSettings.epubReaderSettings.loadOneChapter) changePrevNext();
        else dispatch(setPrevNextChapter({ prev: "~", next: "~" }));
    }, [tocData, currentChapterURL]);

    // useEffect(() => {
    //     if (mangaInReader) {
    //         if (prevMangaRef.current === mangaInReader.mangaName) {
    //             changePrevNext();
    //             return;
    //         }
    //         prevMangaRef.current = mangaInReader.mangaName;
    //         makeChapterList();
    //     }
    // }, [mangaInReader]);

    // useEffect(() => {
    //     console.log(prevNextChapter, currentChapterURL);
    // }, [prevNextChapter]);

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
            className={`readerSideList listCont ${isListOpen ? "open" : ""}`}
            onMouseEnter={() => {
                setpreventListClose(true);
                if (!isListOpen) setListOpen(true);
            }}
            onMouseLeave={(e) => {
                if (!isSideListPinned) {
                    // if (preventListClose && !contextMenu && !e.currentTarget.contains(document.activeElement))
                    if (preventListClose && !e.currentTarget.contains(document.activeElement)) setListOpen(false);
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
                        placeholder="Find In Page"
                        // tabIndex={-1}
                        onChange={(e) => {
                            // if (e.currentTarget.value === "")
                            setFindInPageStr(e.currentTarget.value);
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Escape") {
                                e.currentTarget.blur();
                            }
                            if (e.key === "Enter") {
                                if (e.shiftKey) {
                                    findInPage(findInPageStr, false);
                                } else findInPage(findInPageStr);
                            }
                        }}
                        onBlur={(e) => {
                            if (e.currentTarget.value === "") findInPage("");
                        }}
                    />
                    <button
                        // tabIndex={-1}
                        data-tooltip="Previous"
                        onClick={() => {
                            findInPage(findInPageStr, false);
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowUp} />
                    </button>
                    <button
                        // tabIndex={-1}
                        data-tooltip="Next"
                        onClick={() => {
                            findInPage(findInPageStr);
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowDown} />
                    </button>
                </div>
                <div className="row2">
                    <Button_A
                        className="ctrl-menu-item"
                        btnRef={openPrevChapterRef}
                        tooltip="Open Previous"
                        disabled={prevNextChapter.prev === "~"}
                        clickAction={() => {
                            if (sideListRef.current) {
                                sideListRef.current.querySelectorAll("a").forEach((e) => {
                                    if (e.getAttribute("data-href") === prevNextChapter.prev)
                                        (e as HTMLAnchorElement).click();
                                });
                            }

                            // dispatch(setLinkInReader({ type: "image", link: prevNextChapter.prev, page: 1 }));
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </Button_A>
                    {/* <Button
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
                                            setshortcutText("Bookmark Removed");
                                            setBookmarked(false);
                                        }
                                        if (response === 2) {
                                            setshortcutText("Bookmark Updated");
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
                                // was addnewBookmark before
                                dispatch(
                                    addBookmark({ ...mangaInReader, page: window.app.currentPageNumber || 0 })
                                );
                                setshortcutText("Bookmark Added");
                                setBookmarked(true);
                            }
                        }}
                    >
                        <FontAwesomeIcon icon={isBookmarked ? faBookmark : farBookmark} />
                    </Button> */}
                    <Button_A
                        className="ctrl-menu-item"
                        btnRef={openNextChapterRef}
                        tooltip="Open Next"
                        disabled={prevNextChapter.next === "~"}
                        clickAction={() => {
                            if (sideListRef.current) {
                                // [data-depth="1"
                                sideListRef.current.querySelectorAll("a").forEach((e) => {
                                    // console.log({ a: e.getAttribute("data-href"), b: prevNextChapter.next });
                                    if (e.getAttribute("data-href") === prevNextChapter.next)
                                        (e as HTMLAnchorElement).click();
                                    // (
                                    //     sideListRef.current.querySelector(
                                    //         `a[data-href="${prevNextChapter.next}"`
                                    //     ) as HTMLAnchorElement
                                    // ).click();
                                });
                            }
                            // dispatch(updateLastHistoryPage({ linkInReader: linkInReader.link }));
                            // dispatch(setLinkInReader({ type: "image", link: prevNextChapter.next, page: 1 }));
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </Button_A>
                </div>
            </div>
            <div className="in-reader">
                <div>
                    <span className="bold">Title</span>
                    <span className="bold"> : </span>
                    <span>{tocData.title}</span>
                </div>
                {/* <div>
                    <span className="bold">Author</span>
                    <span className="bold"> : </span>
                    <span>{tocData.author}</span>
                </div> */}
                {appSettings.epubReaderSettings.loadOneChapter && (
                    <div>
                        <span className="bold">Chapter</span>
                        <span className="bold"> : </span>
                        <span>{tocData.nav.find((e) => e.src === currentChapterURL)?.name || "~"}</span>
                    </div>
                )}
            </div>
            <div className="location-cont">
                <ol>
                    {tocData.nav.map((e) => (
                        <li className={e.src === currentChapterURL ? "current " : ""} key={e.name}>
                            <a
                                onClick={(ev) => {
                                    epubLinkClick(ev);
                                    sideListRef.current?.blur();
                                    setCurrentChapterURL(ev.currentTarget.getAttribute("data-href") || "~");
                                }}
                                style={{ "--depth": e.depth - 1 }}
                                data-href={e.src}
                                data-depth={e.depth}
                                title={e.name}
                                // ref={(node) => {
                                //     if (current && node !== null) node.scrollIntoView();
                                // }}
                            >
                                <span className="text">
                                    {"\u00A0".repeat((tocData.depth - e.depth) * 5) + e.name}
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
};

const Button_A = (props: any) => {
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
export default EPubReaderSideList;
