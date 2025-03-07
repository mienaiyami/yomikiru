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
import { Fragment, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { addBookmark } from "@store/bookmarks";
import { dialogUtils } from "@utils/dialog";
import { getReaderLink } from "@store/reader";
import { getReaderBook } from "@store/reader";

const EPubReaderSideList = memo(
    ({
        epubData,
        openNextChapter,
        openPrevChapter,
        currentChapter,
        currentChapterFake,
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
        openNextChapter: () => void;
        openPrevChapter: () => void;
        currentChapter: EPUB.Spine[number];
        currentChapterFake: string;
        epubData: {
            manifest: EPUB.Manifest;
            spine: EPUB.Spine;
            metadata: EPUB.MetaData;
            ncx: EPUB.NCXTree[];
            toc: EPUB.TOC;
        };
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
        const bookInReader = useAppSelector(getReaderBook);
        const appSettings = useAppSelector((store) => store.appSettings);
        const linkInReader = useAppSelector(getReaderLink);
        const dispatch = useAppDispatch();

        const sideListRef = useRef<HTMLDivElement>(null);
        const [findInPageStr, setFindInPageStr] = useState<string>("");
        const [isListOpen, setListOpen] = useState(false);
        const [preventListClose, setpreventListClose] = useState(false);
        const [draggingResizer, setDraggingResizer] = useState(false);
        // when "", will hide all lists
        const [displayList, setDisplayList] = useState<"" | "content" | "bookmarks" | "notes">("content");

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
                            placeholder="Find In Page (regexp allowed)"
                            onChange={(e) => {
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
                                    return dialogUtils
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
                                            throw new Error("Not implemented");
                                            // if (response === 1) {
                                            //     dispatch(removeBookmark({
                                            //         itemLink : linkInReader.link,
                                            //         type: "book",
                                            //     }));
                                            //     setshortcutText("Bookmark Removed");
                                            //     setBookmarked(false);
                                            // }
                                            // if (response === 2) {
                                            //     makeScrollPos(() => {
                                            //         setshortcutText("Bookmark Updated");
                                            //         dispatch(
                                            //             updateEPUBBookmark({
                                            //                 link: linkInReader.link,
                                            //             })
                                            //         );
                                            //     });
                                            // }
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
                                                        chapterData: {
                                                            ...window.app.epubHistorySaveData,
                                                        },
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
                        <span>{epubData.metadata.title}</span>
                    </div>
                    {appSettings.epubReaderSettings.loadOneChapter && (
                        <div>
                            <span className="bold">Chapter</span>
                            <span className="bold"> : </span>
                            <span>{epubData.manifest.get(currentChapterFake)?.title || "~"}</span>
                        </div>
                    )}
                </div>
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
                        <button
                            className={`${displayList === "notes" ? "selected" : ""}`}
                            onClick={() => {
                                setDisplayList((init) => (init === "notes" ? "" : "notes"));
                            }}
                        >
                            Notes
                        </button>
                    </div>
                    {displayList === "content" && (
                        <div className="row2">
                            {/* <button
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
                            </button> */}
                            <button
                                className="ctrl-menu-item"
                                data-tooltip="Locate Current Chapter"
                                onClick={() => {
                                    if (sideListRef.current) {
                                        const href =
                                            epubData.manifest.get(currentChapterFake)?.href || currentChapter.href;
                                        const elem = sideListRef.current.querySelector(
                                            `a[data-href="${href.replaceAll("\\", "\\\\")}"]`
                                        );
                                        //todo : not a good way, state in List stays unchanged
                                        if (elem) {
                                            // sideListRef.current
                                            //     .querySelectorAll(".current")
                                            //     .forEach((e) => e.classList.remove("current"));
                                            elem.parentElement?.classList.add("current");
                                            const grandParent = elem.parentElement?.parentElement;
                                            const grandParentPrevSibling = grandParent?.previousElementSibling;
                                            if (
                                                grandParent &&
                                                grandParent.tagName === "OL" &&
                                                grandParentPrevSibling &&
                                                grandParentPrevSibling.tagName === "LI"
                                            )
                                                grandParentPrevSibling.classList.remove("collapsed");
                                            elem.scrollIntoView({ block: "center" });
                                        }
                                    }
                                }}
                            >
                                <FontAwesomeIcon icon={faLocationDot} />
                            </button>
                            {epubData.metadata.navId && (
                                <a
                                    data-href={epubData.manifest.get(epubData.metadata.navId)?.href}
                                    onClick={(ev) => {
                                        ev.preventDefault();
                                        onEpubLinkClick(ev);
                                    }}
                                    className="btn"
                                >
                                    Show in-book TOC
                                </a>
                            )}
                        </div>
                    )}
                </div>
                {/* //todo remove  appSettings.epubReaderSettings.hideSideList */}
                {/* {!appSettings.epubReaderSettings.hideSideList && ( */}
                <div
                    className="location-cont"
                    // style={{
                    //     display: appSettings.epubReaderSettings.hideSideList ? "none" : "initial",
                    // }}
                >
                    {displayList === "content" && (
                        <>
                            {epubData.toc.size > 500 && (
                                <p>
                                    Too many chapters, click "Content" to hide list to improve performance of
                                    application.
                                </p>
                            )}
                            <List
                                // currentChapter={currentChapter}
                                currentChapterHref={
                                    epubData.manifest.get(currentChapterFake)?.href || currentChapter.href
                                }
                                onEpubLinkClick={onEpubLinkClick}
                                epubNCX={epubData.ncx}
                                epubTOC={epubData.toc}
                                sideListRef={sideListRef}
                            />
                        </>
                    )}
                    {displayList === "bookmarks" && <p>To be implemented</p>}
                    {displayList === "notes" && <p>To be implemented</p>}
                </div>
            </div>
        );
    }
);

const List = memo(
    ({
        epubNCX,
        epubTOC,
        onEpubLinkClick,
        sideListRef,
        currentChapterHref,
    }: {
        currentChapterHref: string;
        epubTOC: EPUB.TOC;
        epubNCX: EPUB.NCXTree[];
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
        sideListRef: React.RefObject<HTMLDivElement>;
    }) => {
        //todo add button to show toc.xhtml if exist
        if (epubTOC.size === 0) return <p>No TOC found in epub</p>;

        const appSettings = useAppSelector((store) => store.appSettings);

        const [listShow, setListShow] = useState(new Array(epubTOC.size).fill(false));
        const NestedList = ({ ncx }: { ncx: EPUB.NCXTree[] }) => {
            return (
                <ol>
                    {ncx.map((e) => (
                        <Fragment key={e.ncx_index2}>
                            <li
                                className={`${e.sub.length > 0 ? "collapsible" : ""} ${
                                    !listShow[e.ncx_index2] ? "collapsed" : ""
                                } ${epubTOC.get(e.navId)?.href === currentChapterHref ? "current" : ""}`}
                                // style={{ "--level-top": epubNCXDepth - e.level }}
                                onClick={(ev) => {
                                    ev.stopPropagation();
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
                                        appSettings.epubReaderSettings.focusChapterInList
                                            ? (node) => {
                                                  if (node && epubTOC.get(e.navId)?.href === currentChapterHref) {
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
                        </Fragment>
                    ))}
                </ol>
            );
        };
        return <NestedList ncx={epubNCX} />;
    },
    //todo imp check if need in props
    // focusChapterInList will make sure that it wont rerender when its `false` for performance benefits
    // (prev, next) => !prev.focusChapterInList || prev.currentChapter.href === next.currentChapter.href
    (prev, next) => prev.currentChapterHref === next.currentChapterHref
);

export default EPubReaderSideList;
