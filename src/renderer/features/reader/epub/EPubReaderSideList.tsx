import { faArrowLeft, faArrowRight, faLocationDot, faThumbtack } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppSelector } from "@store/hooks";
import type { EPubData } from "@utils/epub";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppContext } from "src/renderer/App";
import BookmarkButton from "./components/BookmarkButton";
import BookmarkList from "./components/BookmarkList";
import ContentList from "./components/ContentList";
import FindInPage from "./components/FindInPage";
import NotesList from "./components/NotesList";

const EPubReaderSideList = memo(
    ({
        epubData,
        openNextChapter,
        openPrevChapter,
        currentChapter,
        currentChapterFake,
        openChapterById,
        addToBookmarkRef,
        setShortcutText,
        findInPage,
        onEpubLinkClick,
        isSideListPinned,
        setSideListPinned,
        setSideListWidth,
        makeScrollPos,
        zenMode,
        addNote,
        editNoteId,
        setEditNoteId,
        displayList,
        setDisplayList,
    }: {
        openNextChapter: () => void;
        openPrevChapter: () => void;
        currentChapter: EPUB.Spine[number];
        currentChapterFake: string;
        openChapterById: (chapterId: string, position?: string) => void;
        epubData: EPubData;
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
        addToBookmarkRef: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
        isSideListPinned: boolean;
        setSideListPinned: React.Dispatch<React.SetStateAction<boolean>>;
        setSideListWidth: React.Dispatch<React.SetStateAction<number>>;
        findInPage: (str: string, forward?: boolean) => void;
        makeScrollPos: (
            callback?: (progress: { chapterName: string; chapterId: string; position: string }) => any,
        ) => void;
        zenMode: boolean;
        addNote: (color?: string) => void;
        editNoteId: number | null;
        setEditNoteId: (noteId: number | null) => void;
        displayList: "" | "content" | "bookmarks" | "notes";
        setDisplayList: React.Dispatch<React.SetStateAction<"" | "content" | "bookmarks" | "notes">>;
    }) => {
        const { contextMenuData, colorSelectData } = useAppContext();
        const appSettings = useAppSelector((store) => store.appSettings);
        const sideListRef = useRef<HTMLDivElement>(null);
        const [isListOpen, setListOpen] = useState(false);
        const [preventListClose, setPreventListClose] = useState(false);
        const [draggingResizer, setDraggingResizer] = useState(false);

        const currentRef = useRef<HTMLAnchorElement | null>(null);

        useEffect(() => {
            if (
                !contextMenuData &&
                !isSideListPinned &&
                !(
                    colorSelectData?.focusBackElem && sideListRef.current?.contains(colorSelectData?.focusBackElem)
                ) &&
                document.activeElement !== sideListRef.current &&
                !sideListRef.current?.contains(document.activeElement)
            )
                return setListOpen(false);

            setPreventListClose(true);
        }, [contextMenuData, colorSelectData]);

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
                    setPreventListClose(true);
                    if (!isListOpen) setListOpen(true);
                }}
                onMouseLeave={(e) => {
                    if (!isSideListPinned) {
                        if (
                            preventListClose &&
                            !contextMenuData &&
                            !(
                                colorSelectData?.focusBackElem &&
                                sideListRef.current?.contains(colorSelectData?.focusBackElem)
                            ) &&
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
                    <FindInPage findInPage={findInPage} />
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
                        <BookmarkButton
                            addToBookmarkRef={addToBookmarkRef}
                            setShortcutText={setShortcutText}
                            makeScrollPos={makeScrollPos}
                        />
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
                            <button
                                className="ctrl-menu-item"
                                data-tooltip="Locate Current Chapter"
                                onClick={() => {
                                    if (sideListRef.current) {
                                        const href =
                                            epubData.manifest.get(currentChapterFake)?.href || currentChapter.href;
                                        const elem = sideListRef.current.querySelector(
                                            `a[data-href="${href.replaceAll("\\", "\\\\")}"]`,
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
                {displayList === "content" && (
                    <div
                        className="location-cont"
                        // style={{
                        //     display: appSettings.epubReaderSettings.hideSideList ? "none" : "initial",
                        // }}
                    >
                        {/* //todo virtualize list */}
                        {epubData.toc.size > 500 && (
                            <p>
                                Too many chapters, click &quot;Content&quot; to hide list to improve performance of
                                application.
                            </p>
                        )}
                        {epubData.ncx.length > 0 && (
                            <ContentList
                                currentChapterHref={
                                    epubData.manifest.get(currentChapterFake)?.href || currentChapter.href
                                }
                                onEpubLinkClick={onEpubLinkClick}
                                epubNCX={epubData.ncx}
                                epubTOC={epubData.toc}
                                sideListRef={sideListRef}
                            />
                        )}
                        {epubData.ncx.length === 0 && (
                            <p>No NCX found in epub, use &quot;Show in-book TOC&quot; to for Table of Contents.</p>
                        )}
                    </div>
                )}
                {displayList === "bookmarks" && <BookmarkList openChapterById={openChapterById} />}
                {displayList === "notes" && (
                    <NotesList
                        openChapterById={openChapterById}
                        addNote={addNote}
                        editNoteId={editNoteId}
                        setEditNoteId={setEditNoteId}
                    />
                )}
            </div>
        );
    },
);

EPubReaderSideList.displayName = "EPubReaderSideList";

export default EPubReaderSideList;
