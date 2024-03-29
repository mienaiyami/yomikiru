import {
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faThumbtack,
    faArrowUp,
    faArrowDown,
    faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { memo, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addBookmark, updateEPUBBookmark, removeBookmark } from "../store/bookmarks";
import { setEpubReaderSettings } from "../store/appSettings";

const EPubReaderSideList = memo(
    ({
        // openNextChapterRef,
        // openPrevChapterRef,
        // currentChapterURL,
        // setCurrentChapterURL,
        epubNCX,
        epubTOC,
        epubMetadata,
        openNextChapter,
        openPrevChapter,
        currentChapter,
        addToBookmarkRef,
        setshortcutText,
        isBookmarked,
        setBookmarked,
        findInPage,
        onEpubLinkClick,
        isSideListPinned,
        setSideListPinned,
        setSideListWidth,
        makeScrollPos,
        zenMode,
    }: {
        // openNextChapterRef: React.RefObject<HTMLButtonElement>;
        // openPrevChapterRef: React.RefObject<HTMLButtonElement>;
        openNextChapter: () => void;
        openPrevChapter: () => void;
        /**
         * `~` if appSettings.epubReaderSettings.loadOneChapter is `false`
         */
        // currentChapterURL: string;
        // currentChapter: {
        //     id: string;
        //     /** `#` part of url */
        //     fragment: string;
        // };
        /** currentChapter Id */
        currentChapter: EPUB.Spine[number];
        epubMetadata: EPUB.MetaData;
        epubTOC: EPUB.TOC;
        epubNCX: EPUB.NCXTree[];
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
        addToBookmarkRef: React.RefObject<HTMLButtonElement>;
        isBookmarked: boolean;
        setBookmarked: React.Dispatch<React.SetStateAction<boolean>>;
        setshortcutText: React.Dispatch<React.SetStateAction<string>>;
        isSideListPinned: boolean;
        setSideListPinned: React.Dispatch<React.SetStateAction<boolean>>;
        setSideListWidth: React.Dispatch<React.SetStateAction<number>>;
        findInPage: (str: string, forward?: boolean) => void;
        makeScrollPos: (callback?: ((queryString?: string) => any) | undefined) => void;
        zenMode: boolean;
    }) => {
        const bookInReader = useAppSelector((store) => store.bookInReader);
        const appSettings = useAppSelector((store) => store.appSettings);
        const linkInReader = useAppSelector((store) => store.linkInReader);
        const prevNextChapter = useAppSelector((store) => store.prevNextChapter);

        const dispatch = useAppDispatch();

        const sideListRef = useRef<HTMLDivElement>(null);
        const [findInPageStr, setFindInPageStr] = useState<string>("");
        const [isListOpen, setListOpen] = useState(false);
        const [preventListClose, setpreventListClose] = useState(false);
        const [draggingResizer, setDraggingResizer] = useState(false);
        const currentRef = useRef<HTMLAnchorElement | null>(null);
        useEffect(() => {
            if (!zenMode && currentRef.current)
                setTimeout(() => {
                    currentRef.current?.scrollIntoView({ block: "start" });
                }, 100);
        }, [zenMode]);
        useLayoutEffect(() => {
            if (isSideListPinned) {
                setListOpen(true);
            }
        }, [isSideListPinned]);

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
                        if (preventListClose && !e.currentTarget.contains(document.activeElement))
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
                    tabIndex={0}
                    onClick={(e) => {
                        makeScrollPos();
                        if (isSideListPinned) {
                            sideListRef.current?.blur();
                            setListOpen(false);
                        }
                        setSideListPinned((init) => !init);
                        e.currentTarget.blur();
                    }}
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
                        <button
                            className="ctrl-menu-item"
                            data-tooltip="Open Previous"
                            //todo
                            // disabled={prevNextChapter.prev === "~"}
                            onClick={() => {
                                openPrevChapter();
                            }}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <button
                            className="ctrl-menu-item"
                            data-tooltip="Bookmark"
                            ref={addToBookmarkRef}
                            onClick={() => {
                                if (isBookmarked) {
                                    return window.dialog
                                        .warn({
                                            title: "Warning",
                                            message:
                                                "Remove - Remove Bookmark\n" +
                                                "Replace - Replace existing bookmark with current location",
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
                                                makeScrollPos(() => {
                                                    setshortcutText("Bookmark Updated");
                                                    dispatch(
                                                        updateEPUBBookmark({
                                                            link: linkInReader.link,
                                                        })
                                                    );
                                                });
                                            }
                                        });
                                }
                                if (bookInReader) {
                                    makeScrollPos(() => {
                                        if (window.app.epubHistorySaveData)
                                            dispatch(
                                                addBookmark({
                                                    type: "book",
                                                    data: {
                                                        ...bookInReader,
                                                        chapter: window.app.epubHistorySaveData.chapter,
                                                        elementQueryString:
                                                            window.app.epubHistorySaveData.queryString,
                                                    },
                                                })
                                            );
                                        setshortcutText("Bookmark Added");
                                        setBookmarked(true);
                                    });
                                }
                            }}
                        >
                            <FontAwesomeIcon icon={isBookmarked ? faBookmark : farBookmark} />
                        </button>
                        <button
                            className="ctrl-menu-item"
                            data-tooltip="Open Next"
                            disabled={prevNextChapter.next === "~"}
                            onClick={() => {
                                openNextChapter();
                            }}
                        >
                            <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    </div>
                </div>
                <div className="in-reader">
                    <div>
                        <span className="bold">Title</span>
                        <span className="bold"> : </span>
                        <span>{epubMetadata.title}</span>
                    </div>
                    {appSettings.epubReaderSettings.loadOneChapter && (
                        <div>
                            <span className="bold">Chapter</span>
                            <span className="bold"> : </span>
                            <span>
                                {/* //todo use "one above(get from spine+toc)" .title if not found */}
                                {epubTOC.get(currentChapter.href)?.title || "~"}
                            </span>
                        </div>
                    )}
                </div>
                <div className="tools">
                    <div className="row2">
                        <button
                            className="ctrl-menu-item"
                            data-tooltip="Improves performance"
                            onClick={() => {
                                dispatch(
                                    setEpubReaderSettings({
                                        hideSideList: !appSettings.epubReaderSettings.hideSideList,
                                    })
                                );
                            }}
                        >
                            {appSettings.epubReaderSettings.hideSideList ? "Show" : "Hide"} List
                        </button>
                        <button
                            className="ctrl-menu-item"
                            data-tooltip="Locate Current Chapter"
                            onClick={() => {
                                //todo maybe make a state for closest item in toc according to id and spine
                                if (sideListRef.current) {
                                    const elem = sideListRef.current.querySelector(
                                        `a[data-href="${currentChapter.href.replaceAll("\\", "\\\\")}"]`
                                    );
                                    console.log(elem, currentChapter.href);
                                    if (elem) {
                                        sideListRef.current
                                            .querySelectorAll(".current")
                                            .forEach((e) => e.classList.remove("current"));
                                        elem.parentElement?.classList.add("current");
                                        elem.scrollIntoView({ block: "center" });
                                    }
                                }
                            }}
                        >
                            <FontAwesomeIcon icon={faLocationDot} />
                        </button>
                    </div>
                </div>
                {!appSettings.epubReaderSettings.hideSideList && (
                    <div
                        className="location-cont"
                        // style={{
                        //     display: appSettings.epubReaderSettings.hideSideList ? "none" : "initial",
                        // }}
                    >
                        <List
                            currentChapter={currentChapter}
                            onEpubLinkClick={onEpubLinkClick}
                            epubNCX={epubNCX}
                            // epubNCXDepth={epubMetadata.ncx_depth}
                            epubTOC={epubTOC}
                            sideListRef={sideListRef}
                            focusChapterInList={appSettings.epubReaderSettings.focusChapterInList}
                            // setCurrentChapterURL={setCurrentChapterURL}
                            // currentRef={currentRef}
                        />
                    </div>
                )}
            </div>
        );
    }
);

//todo optimize
const List = memo(
    ({
        epubNCX,
        // epubNCXDepth,
        epubTOC,
        onEpubLinkClick,
        sideListRef,
        currentChapter,
        focusChapterInList,
    }: // setCurrentChapterURL,
    // currentRef,
    {
        currentChapter: EPUB.Spine[number];
        epubTOC: EPUB.TOC;
        epubNCX: EPUB.NCXTree[];
        // epubNCXDepth: number;
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
        sideListRef: React.RefObject<HTMLDivElement>;

        focusChapterInList: boolean;
        // setCurrentChapterURL: React.Dispatch<React.SetStateAction<string>>;
        // currentRef: React.MutableRefObject<HTMLAnchorElement | null>;
    }) => {
        //todo add button to show toc.xhtml if exist
        if (epubTOC.size === 0) return <p>No TOC found in epub</p>;

        const [listShow, setListShow] = useState(new Array(epubTOC.size).fill(true));
        const NestedList = ({ ncx }: { ncx: EPUB.NCXTree[] }) => {
            return (
                <ol>
                    {ncx.map((e) => (
                        <React.Fragment key={e.ncx_index2}>
                            <li
                                className={`${e.sub.length > 0 ? "collapse" : ""} ${
                                    listShow[e.ncx_index2] ? "collapsed" : ""
                                } ${epubTOC.get(e.navId)?.href === currentChapter.href ? "current" : ""}`}
                                // style={{ "--level-top": epubNCXDepth - e.level }}
                                onClick={() => {
                                    setListShow((init) => {
                                        const dup = [...init];
                                        dup[e.ncx_index2] = !dup[e.ncx_index2];
                                        return dup;
                                    });
                                }}
                            >
                                <a
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        onEpubLinkClick(ev);
                                        sideListRef.current?.blur();
                                    }}
                                    title={epubTOC.get(e.navId)?.title}
                                    data-href={epubTOC.get(e.navId)?.href}
                                    data-depth={e.level}
                                    //todo check if works
                                    ref={
                                        focusChapterInList
                                            ? (node) => {
                                                  if (node && epubTOC.get(e.navId)?.href === currentChapter.href) {
                                                      if (listShow[e.ncx_index2] === false)
                                                          setListShow((init) => {
                                                              const dup = [...init];
                                                              dup[e.ncx_index2] = true;
                                                              return dup;
                                                          });
                                                      node.scrollIntoView({ block: "start" });
                                                  }
                                              }
                                            : undefined
                                    }
                                >
                                    <span className="text">
                                        {"\u00A0".repeat(e.level * 5)}
                                        {epubTOC.get(e.navId)?.title}
                                    </span>
                                </a>
                            </li>
                            {e.sub.length > 0 && <NestedList ncx={e.sub} />}
                        </React.Fragment>
                    ))}
                </ol>
            );
        };
        return <NestedList ncx={epubNCX} />;
    },
    // focusChapterInList will make sure that it wont rerender when its `false` for performance benefits
    (prev, next) => !prev.focusChapterInList || prev.currentChapter.href === next.currentChapter.href
);

export default EPubReaderSideList;
