import React, { useEffect, useLayoutEffect, useRef, useState, memo, useCallback } from "react";

import { useAppContext } from "src/renderer/App";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAppSettings, setEpubReaderSettings, setReaderSettings } from "@store/appSettings";
import EPUBReaderSettings from "./EPubReaderSettings";
import EPubReaderSideList from "./EPubReaderSideList";
import EPUB from "@utils/epub";
import { addLibraryItem, selectLibraryItem, updateBookProgress, updateCurrentItemProgress } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { getCSSPath } from "@utils/utils";
import { keyFormatter } from "@utils/keybindings";
import {
    setReaderLoading,
    setReaderOpen,
    updateReaderContent,
    updateReaderBookProgress,
    getReaderBook,
} from "@store/reader";
import { BookProgress } from "@common/types/db";
import HTMLPart from "./HTMLPart";
import StyleSheets from "./StyleSheets";
import FootNodeModal from "./components/FootNodeModal";
import { getShortcutsMapped } from "@store/shortcuts";
import { shallowEqual } from "react-redux";
import { DEFAULT_HIGHLIGHT_COLORS, highlightUtils } from "@utils/highlight";
import { addNote } from "@store/bookNotes";
import { colorUtils } from "@utils/color";

type EPubData = {
    metadata: EPUB.MetaData;
    manifest: EPUB.Manifest;
    spine: EPUB.Spine;
    toc: EPUB.TOC;
    ncx: EPUB.NCXTree[];
    styleSheets: string[];
};

// todo: replace useLayoutEffect that is not needed with useEffect
const EPubReader: React.FC = () => {
    const { bookProgressRef, setContextMenuData } = useAppContext();

    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const isSettingOpen = useAppSelector((store) => store.ui.isOpen.settings);
    const readerState = useAppSelector((store) => store.reader);
    const isLoading = useAppSelector((store) => store.reader.loading !== null);

    const libraryItem = useAppSelector((store) => selectLibraryItem(store, readerState.link));
    const bookInReader = useAppSelector(getReaderBook);

    const dispatch = useAppDispatch();
    const [epubData, setEpubData] = useState<EPubData | null>(null);
    /** index of current chapter in EPUB.Spine */
    const [currentChapter, setCurrentChapter] = useState({
        index: -1,
        fragment: "",
    });
    /**
     * `EPUB.Spine.id` before `currentChapter` that has a title in toc
     * only for display purpose in side-list, titlebar, history
     * it can be heavy to get because title only exists in toc, and not all href have a title
     * so it will find any last title before current chapter (href from spine) which has a occurrence in toc
     */
    const [currentChapterFake, setCurrentChapterFake] = useState("");

    const [isSideListPinned, setSideListPinned] = useState(false);
    const [sideListWidth, setSideListWidth] = useState(appSettings.readerSettings.sideListWidth || 450);
    const [zenMode, setZenMode] = useState(appSettings.openInZenMode || false);
    const [wasMaximized, setWasMaximized] = useState(false);
    // display this text when shortcuts clicked
    const [shortcutText, setShortcutText] = useState("");
    // [0-100]
    const [bookProgress, setBookProgress] = useState(0);
    const [footnoteModalData, setFootnoteModalData] = useState<{
        title: string;
        content: string;
    } | null>(null);

    const [editNoteId, setEditNoteId] = useState<number | null>(null);
    // when "", will hide all lists
    const [displayList, setDisplayList] = useState<"" | "content" | "bookmarks" | "notes">("content");

    const readerRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLSelectElement>(null);
    const readerSettingExtender = useRef<HTMLButtonElement>(null);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const fontSizePlusRef = useRef<HTMLButtonElement>(null);
    const fontSizeMinusRef = useRef<HTMLButtonElement>(null);
    const shortcutTextRef = useRef<HTMLDivElement>(null);
    const addToBookmarkRef = useRef<HTMLButtonElement>(null);

    /**
     *  uses: css selector of element which was on top of view before changing size,etc.
     *  also used on first load to scroll to last read position
     */
    const setProgressPosition = useCallback(
        (queryString: string) => {
            dispatch(
                updateReaderBookProgress({
                    position: queryString,
                }),
            );
        },
        [dispatch],
    );

    useLayoutEffect(() => {
        if (readerState.link) {
            loadEPub(readerState.link);
        }
    }, [readerState.link]);
    useLayoutEffect(() => {
        if (appSettings.epubReaderSettings.loadOneChapter && readerRef.current) readerRef.current.scrollTop = 0;
        const abortController = new AbortController();
        (async function () {
            if (epubData) {
                let index = currentChapter.index;
                let id = "";
                // will only check 10 chapters before current chapter
                while (index >= 0 && currentChapter.index - index < 10 && !abortController.signal.aborted) {
                    if (epubData.manifest.get(epubData.spine[index].id)?.title) {
                        id = epubData.spine[index].id;
                        break;
                    }
                    index--;
                }
                if (!abortController.signal.aborted) {
                    dispatch(
                        updateReaderBookProgress({
                            chapterId: id,
                            position: "",
                            chapterName: epubData.manifest.get(id)?.title || "~",
                        }),
                    );
                    dispatch(updateCurrentItemProgress());
                    setCurrentChapterFake(id);
                }
            }
        })();
        return () => {
            abortController.abort();
        };
    }, [currentChapter.index, epubData]);

    const findInPageRefs = useRef<{
        // prevResult: HTMLParagraphElement;
        prevStr: string;
        originalHTML: string;
        currentIndex: number;
    } | null>(null);

    const scrollReader = (intensity: number) => {
        if (readerRef.current) {
            let prevTime: number;
            const anim = (timeStamp: number) => {
                if (prevTime !== timeStamp && readerRef.current) {
                    readerRef.current.scrollBy(0, intensity);
                }
                if (window.app.keydown) {
                    prevTime = timeStamp;
                    window.requestAnimationFrame(anim);
                }
            };
            window.requestAnimationFrame(anim);
            return;
        }
    };
    const openNextChapter = useCallback(() => {
        setCurrentChapter((prev) => {
            if (epubData && prev.index + 1 < epubData.spine.length) {
                return { index: prev.index + 1, fragment: "" };
            }
            return prev;
        });
    }, [epubData]);
    const openPrevChapter = useCallback(() => {
        setCurrentChapter((prev) => {
            if (prev.index - 1 >= 0) {
                return { index: prev.index - 1, fragment: "" };
            }
            return prev;
        });
    }, [epubData]);

    /**
     * @param chapterId - `EPUB.Spine[].id`
     * @param position - element query string of position to scroll to
     */
    const openChapterById = useCallback(
        (chapterId: string, position?: string) => {
            if (epubData) {
                const index = epubData.spine.findIndex((e) => e.id === chapterId);
                if (index >= 0) {
                    setCurrentChapter({ index, fragment: "" });
                    if (position) {
                        setProgressPosition(position);
                        // backup in case same chapter
                        const element = mainRef.current?.querySelector(position);
                        if (element) {
                            element.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                    }
                } else {
                    dialogUtils.customError({
                        message: "Could not find the chapter for corresponding id.",
                    });
                }
            }
        },
        [epubData],
    );

    /**
     * scroll to internal links or open external link
     * * `data-href` - scroll to internal
     * * `href     ` - open external
     */
    const onEpubLinkClick = useCallback(
        (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
            ev.preventDefault();
            if (!epubData) return;
            const href = (ev.currentTarget as HTMLAnchorElement).getAttribute("data-href");
            if (href) {
                if (href.startsWith("http")) {
                    dialogUtils
                        .warn({
                            message: "Open external link?",
                            detail: href,
                            noOption: false,
                        })
                        .then((res) => {
                            if (res.response === 0) window.electron.openExternal(href);
                        });
                } else {
                    setProgressPosition("");
                    if (appSettings.epubReaderSettings.loadOneChapter) {
                        const fragment = href.split("#")[1] || "";
                        if (
                            href.startsWith("#") ||
                            href.split("#")[0] === epubData.spine[currentChapter.index].href
                        ) {
                            // setCurrentChapter(prev=>({...prev, fragment}))
                            if (
                                ev.currentTarget instanceof HTMLElement &&
                                ev.currentTarget.getAttribute("epub:type")?.includes("note")
                            ) {
                                // for test use lotm,orv epub
                                const note =
                                    document.querySelector(`[data-epub-id="${fragment}"]`)?.innerHTML || "";
                                setFootnoteModalData({
                                    title: ev.currentTarget.innerText,
                                    content: note,
                                });
                                return;
                            }
                            document
                                .querySelector(`[data-epub-id="${fragment}"]`)
                                ?.scrollIntoView({ block: "start" });
                            return;
                        }
                        const itemIdx = epubData.spine.findIndex((e) => e.href === href.split("#")[0]);
                        if (itemIdx < 0) {
                            dialogUtils.customError({
                                message: "Could not find the chapter for corresponding link.",
                            });
                            return;
                        }
                        setCurrentChapter({ index: itemIdx, fragment: fragment });
                    } else {
                        //todo
                    }
                }
            }
        },
        [epubData, currentChapter.index],
    );

    const loadEPub = (link: string) => {
        if (window.fs.existsSync(window.app.deleteDirOnClose))
            window.fs
                .rm(window.app.deleteDirOnClose, {
                    recursive: true,
                })
                .catch((err) => window.logger.error("Error while deleting temp dir", err));

        link = window.path.normalize(link);
        EPUB.readEpubFile(link, appSettings.keepExtractedFiles)
            .then(async (ed) => {
                // todo : When current chapter is not top level(level=0), make BookItem.chapter concat of all parent chapters.
                let currentChapterIndex = 0;
                if (readerState.epubChapterId)
                    currentChapterIndex = ed.spine.findIndex((e) => e.id === readerState.epubChapterId);
                if (currentChapterIndex < 0) currentChapterIndex = 0;

                const progress: BookProgress = {
                    chapterId: ed.spine[currentChapterIndex].id,
                    chapterName: ed.manifest.get(ed.spine[currentChapterIndex].id)?.title || "~",
                    position: readerState.epubElementQueryString || "",
                    itemLink: link,
                    lastReadAt: new Date(),
                };
                if (libraryItem && libraryItem.type === "book") {
                    dispatch(
                        updateReaderContent({
                            ...libraryItem,
                            progress,
                        }),
                    );
                    await dispatch(updateBookProgress(progress));
                } else {
                    const bookOpened = {
                        type: "book",
                        link,
                        title: ed.metadata.title,
                        author: ed.metadata.author,
                        cover: ed.metadata.cover,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    } as const;
                    dispatch(
                        updateReaderContent({
                            ...bookOpened,
                            progress,
                        }),
                    );
                    await dispatch(
                        addLibraryItem({
                            type: "book",
                            data: bookOpened,
                            progress,
                        }),
                    );
                }
                setCurrentChapter({
                    index: currentChapterIndex,
                    fragment: "",
                });
                setEpubData(ed);
                // if (ed.toc.length > 200 && !appSettings.epubReaderSettings.loadOneChapter)
                //     dialogUtils.warn({
                //         message: "Too many chapters in book.",
                //         detail: "It might cause instability and high RAM usage. It is recommended to enable option to load and show only chapter at a time from Settings → Other Settings.",
                //         noOption: false,
                //     });
                dispatch(setReaderLoading(null));
                dispatch(setReaderOpen());
            })
            .catch(() => {
                dispatch(setReaderLoading(null));
            });
    };

    const makeScrollPos = useCallback(
        (callback?: (progress: { chapterName: string; chapterId: string; position: string }) => void) => {
            // todo, isn't a great way maybe, sometimes doesn't work, catches wrong element
            // but using % is not good either because height change is not constant if it contains images
            if (mainRef.current) {
                let y = (zenMode ? 0 : window.app.titleBarHeight) + 10;
                let x = mainRef.current.offsetLeft + mainRef.current.offsetWidth / 3;
                let elem: Element | null = null;
                const sectionMain = document.querySelector("#EPubReader > section");
                while (x < mainRef.current.offsetLeft + mainRef.current.offsetWidth / 1.3) {
                    if (y > window.innerHeight / 2) {
                        y = 50;
                        x += 20;
                    }
                    elem = document.elementFromPoint(x, y);
                    if (elem) if (elem.tagName !== "SECTION" && elem.parentElement !== sectionMain) break;
                    y += 10;
                }
                if (elem) {
                    const cssPath = getCSSPath(elem);
                    const progress = {
                        chapterName: epubData?.manifest.get(currentChapterFake)?.title || "~",
                        chapterId: epubData?.spine[currentChapter.index].id || "",
                        position: cssPath,
                    };
                    if (callback) callback(progress);
                    dispatch(updateReaderBookProgress(progress));
                    setProgressPosition(cssPath);
                }
            }
        },
        [mainRef.current, zenMode, epubData, currentChapter.index, currentChapterFake],
    );

    const findInPage = useCallback(
        (str: string, forward = true) => {
            //todo it wont work with multiple spine item
            if (str === "") {
                if (findInPageRefs.current && mainRef.current) {
                    const cont = mainRef.current.querySelector(":scope > .cont");
                    if (cont) cont.innerHTML = findInPageRefs.current.originalHTML;
                }
                findInPageRefs.current = null;
                return;
            }
            if (mainRef.current) {
                const cont = mainRef.current.querySelector(":scope > .cont");
                if (!cont) return;
                if (!findInPageRefs.current) {
                    findInPageRefs.current = {
                        originalHTML: cont.innerHTML,
                        currentIndex: 0,
                        prevStr: "",
                    };
                }
                if (findInPageRefs.current) {
                    //todo : this results in dom events getting destroyed, use canvas as alternative? or re-attach events
                    if (findInPageRefs.current.currentIndex === 0 || str !== findInPageRefs.current.prevStr) {
                        const modified = findInPageRefs.current.originalHTML.replace(
                            new RegExp(`(${str})`, "ig"),
                            `<span class="findInPage-highlight">$1</span>`,
                        );
                        cont.innerHTML = modified;
                    }
                    let index = findInPageRefs.current.currentIndex + (forward ? 0 : -2);
                    if (findInPageRefs.current.prevStr !== str) index = 0;
                    const foundElems = mainRef.current.querySelectorAll(".findInPage-highlight");
                    foundElems.forEach((e) => e.classList.remove("current"));
                    if (index < 0) index = foundElems.length - 1;
                    else if (index >= foundElems.length) index = 0;
                    const currentElem = foundElems[index];
                    if (currentElem) {
                        currentElem.classList.add("current");
                        currentElem.scrollIntoView({
                            behavior: "auto",
                            block: "start",
                        });
                        findInPageRefs.current.currentIndex = index + 1;
                        findInPageRefs.current.prevStr = str;
                    } else {
                        console.warn("findInPage: element not found.");
                    }
                }
            }
        },
        [findInPageRefs.current, mainRef.current],
    );

    const updateProgress = () => {
        let progress = 0;
        if (readerRef.current)
            progress =
                Math.round(
                    (readerRef.current.scrollTop /
                        (readerRef.current.scrollHeight - readerRef.current.offsetHeight)) *
                        100,
                ) || 0;
        if (bookProgressRef.current) bookProgressRef.current.value = progress.toString();
        setBookProgress(progress);
        makeScrollPos();
    };

    const handleAddNote = useCallback(
        (color?: string) => {
            const epubReader = document.querySelector("#EPubReader");
            if (!epubReader || !bookInReader?.progress?.chapterId) return;

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !mainRef.current?.contains(selection.anchorNode)) {
                dialogUtils.customError({
                    message: "Please select some text first",
                });
                return;
            }

            const range = highlightUtils.getCurrentSelection();
            if (!range) {
                dialogUtils.customError({
                    message: "Could not get selection range",
                });
                return;
            }

            const text = selection.toString();
            selection.removeAllRanges();
            try {
                if (!color) {
                    color = "OPEN_EDIT";
                    setDisplayList("notes");
                } else color = colorUtils.new(color).hexa();
            } catch (err) {
                console.error(err);
                color = DEFAULT_HIGHLIGHT_COLORS[0];
            }
            dispatch(
                addNote({
                    itemLink: bookInReader.link,
                    chapterId: bookInReader.progress.chapterId,
                    chapterName: bookInReader.progress.chapterName,
                    range,
                    selectedText: text,
                    color,
                }),
            );
        },
        [bookInReader, dispatch],
    );

    //todo remove behavior
    const scrollToPage = (percent: number, behavior: ScrollBehavior = "smooth", callback?: () => void) => {
        const reader = document.querySelector("#EPubReader") as HTMLDivElement;
        if (reader) {
            reader.scrollTo(0, (percent / 100) * (reader.scrollHeight - reader.offsetHeight));
            if (callback) callback();
        }
    };
    window.app.scrollToPage = scrollToPage;
    useEffect(() => {
        if ((zenMode && !window.electron.currentWindow.isMaximized()) || (!zenMode && !wasMaximized)) {
            setTimeout(() => {
                if (bookInReader?.progress?.position)
                    document.querySelector(bookInReader.progress.position)?.scrollIntoView({
                        behavior: "auto",
                        block: "start",
                    });
            }, 100);
        }
        if (zenMode) {
            setSideListPinned(false);
            setWasMaximized(window.electron.currentWindow.isMaximized());
            document.body.classList.add("zenMode");
            window.electron.currentWindow.setFullScreen(true);
        } else {
            document.body.classList.remove("zenMode");
            setWasMaximized(false);
            if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);
        }
    }, [zenMode]);

    useLayoutEffect(() => {
        if (isSideListPinned) {
            const position = bookInReader?.progress?.position;
            if (position)
                document.querySelector(position)?.scrollIntoView({
                    behavior: "auto",
                    block: "start",
                });
        }
        const timeOutId = setTimeout(() => {
            if (sideListWidth !== appSettings?.readerSettings?.sideListWidth)
                dispatch(setReaderSettings({ sideListWidth }));
        }, 500);
        return () => {
            clearTimeout(timeOutId);
        };
    }, [sideListWidth]);

    useLayoutEffect(() => {
        window.app.clickDelay = 100;
        const wheelFunction = (e: WheelEvent) => {
            if (e.ctrlKey) {
                if (e.deltaY < 0) {
                    sizePlusRef.current?.click();
                    return;
                }
                if (e.deltaY > 0) {
                    sizeMinusRef.current?.click();
                    return;
                }
            }
        };

        const registerShortcuts = (e: KeyboardEvent) => {
            // /&& document.activeElement!.tagName === "BODY"
            window.app.keyRepeated = e.repeat;
            const keyStr = keyFormatter(e);
            if (keyStr === "" && e.key !== "Escape") return;

            const is = (keys: string[]) => {
                return keys.includes(keyStr);
            };
            if (is(shortcutsMapped["contextMenu"])) {
                e.stopPropagation();
                e.preventDefault();
                if (mainRef.current)
                    mainRef.current.dispatchEvent(
                        window.contextMenu.fakeEvent(
                            { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                            readerRef.current,
                        ),
                    );
                return;
            }
            const topBottomLogic =
                readerRef.current &&
                !e.repeat &&
                (Math.ceil(
                    readerRef.current.scrollTop +
                        window.innerHeight +
                        (1 + Math.abs(1 - window.electron.webFrame.getZoomFactor())),
                ) >= readerRef.current.scrollHeight ||
                    readerRef.current.scrollTop < window.innerHeight / 4);
            if (!isSettingOpen && readerState.active && !isLoading) {
                if ([" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                if (!e.repeat) {
                    switch (true) {
                        case is(shortcutsMapped["readerSettings"]):
                            readerSettingExtender.current?.click();
                            readerSettingExtender.current?.focus();
                            break;
                        case is(shortcutsMapped["toggleZenMode"]):
                            // makeScrollPos();
                            setZenMode((prev) => !prev);
                            break;
                        case e.key === "Escape":
                            // makeScrollPos();
                            setZenMode(false);
                            break;

                        case is(shortcutsMapped["nextPage"]):
                            if (topBottomLogic) openNextChapter();
                            break;
                        case is(shortcutsMapped["prevPage"]):
                            if (topBottomLogic) openPrevChapter();
                            break;
                        case is(shortcutsMapped["nextChapter"]):
                            if (!e.repeat) openNextChapter();
                            break;
                        case is(shortcutsMapped["prevChapter"]):
                            if (!e.repeat) openPrevChapter();
                            break;
                        case is(shortcutsMapped["bookmark"]):
                            if (!e.repeat) addToBookmarkRef.current?.click();
                            break;
                        case is(shortcutsMapped["sizePlus"]):
                            sizePlusRef.current?.click();
                            break;
                        case is(shortcutsMapped["sizeMinus"]):
                            sizeMinusRef.current?.click();
                            break;
                        case is(shortcutsMapped["fontSizePlus"]):
                            fontSizePlusRef.current?.click();
                            break;
                        case is(shortcutsMapped["fontSizeMinus"]):
                            fontSizeMinusRef.current?.click();
                            break;
                        default:
                            break;
                    }
                    if (
                        document.activeElement!.tagName === "BODY" ||
                        document.activeElement === readerRef.current
                    ) {
                        window.app.keydown = true;

                        switch (true) {
                            case is(shortcutsMapped["largeScrollReverse"]):
                                e.preventDefault();
                                scrollReader(0 - appSettings.epubReaderSettings.scrollSpeedB);
                                break;
                            case is(shortcutsMapped["largeScroll"]):
                                e.preventDefault();
                                scrollReader(appSettings.epubReaderSettings.scrollSpeedB);
                                break;
                            case is(shortcutsMapped["scrollDown"]):
                                scrollReader(appSettings.epubReaderSettings.scrollSpeedA);
                                break;
                            case is(shortcutsMapped["scrollUp"]):
                                scrollReader(0 - appSettings.epubReaderSettings.scrollSpeedA);
                                break;
                            case is(shortcutsMapped["showHidePageNumberInZen"]):
                                setShortcutText(
                                    (!appSettings.epubReaderSettings.showProgressInZenMode ? "Show" : "Hide") +
                                        " progress in Zen Mode",
                                );
                                dispatch(
                                    setEpubReaderSettings({
                                        showProgressInZenMode:
                                            !appSettings.epubReaderSettings.showProgressInZenMode,
                                    }),
                                );
                                break;
                        }
                    }
                }
            }
        };

        const aaa = () => {
            window.app.keydown = false;
        };
        window.addEventListener("wheel", wheelFunction);
        window.addEventListener("keydown", registerShortcuts);
        window.addEventListener("keyup", aaa);
        return () => {
            window.removeEventListener("wheel", wheelFunction);
            window.removeEventListener("keydown", registerShortcuts);
            window.removeEventListener("keyup", aaa);
        };
    }, [isSideListPinned, appSettings, isLoading, shortcutsMapped, isSettingOpen, epubData, readerState.active]);

    useLayoutEffect(() => {
        const position = bookInReader?.progress?.position;
        if (position)
            document.querySelector(position)?.scrollIntoView({
                behavior: "auto",
                block: "start",
            });
    }, [
        epubData,
        appSettings.epubReaderSettings.readerWidth,
        isSideListPinned,
        appSettings.epubReaderSettings.fontSize,
        appSettings.epubReaderSettings.lineSpacing,
        appSettings.epubReaderSettings.paragraphSpacing,
        //! these were not needed caused bad auto scroll
        // appSettings.epubReaderSettings.fontFamily,
        // appSettings.epubReaderSettings.wordSpacing,
        // appSettings.epubReaderSettings.useDefault_fontFamily,
        appSettings.epubReaderSettings.useDefault_lineSpacing,
        appSettings.epubReaderSettings.useDefault_paragraphSpacing,
        // appSettings.epubReaderSettings.useDefault_wordSpacing,
    ]);

    useEffect(() => {
        let timeOutId: NodeJS.Timeout;
        const e = shortcutTextRef.current;
        if (shortcutText !== "") {
            if (e) {
                e.innerText = shortcutText;
                e.classList.remove("faded");
                timeOutId = setTimeout(() => {
                    e.classList.add("faded");
                }, 500);
            }
        }
        return () => {
            clearTimeout(timeOutId);
            e?.classList.add("faded");
        };
    }, [shortcutText]);

    return (
        <div
            ref={readerRef}
            id="EPubReader"
            className={
                (isSideListPinned ? "sideListPinned " : "") +
                "reader " +
                (zenMode && appSettings.hideCursorInZenMode ? "noCursor " : "")
            }
            style={{
                gridTemplateColumns: sideListWidth + "px auto",
                display: readerState.active ? (isSideListPinned ? "grid" : "block") : "none",
                "--sideListWidth": sideListWidth + "px",
            }}
            onScroll={updateProgress}
            tabIndex={-1}
        >
            <EPUBReaderSettings
                readerRef={readerRef}
                makeScrollPos={makeScrollPos}
                readerSettingExtender={readerSettingExtender}
                sizePlusRef={sizePlusRef}
                sizeMinusRef={sizeMinusRef}
                setShortcutText={setShortcutText}
                fontSizePlusRef={fontSizePlusRef}
                fontSizeMinusRef={fontSizeMinusRef}
            />
            {epubData && (
                <EPubReaderSideList
                    onEpubLinkClick={onEpubLinkClick}
                    openNextChapter={openNextChapter}
                    openPrevChapter={openPrevChapter}
                    currentChapter={epubData.spine[currentChapter.index]}
                    currentChapterFake={currentChapterFake}
                    epubData={epubData}
                    openChapterById={openChapterById}
                    addToBookmarkRef={addToBookmarkRef}
                    setShortcutText={setShortcutText}
                    isSideListPinned={isSideListPinned}
                    setSideListPinned={setSideListPinned}
                    setSideListWidth={setSideListWidth}
                    makeScrollPos={makeScrollPos}
                    findInPage={findInPage}
                    zenMode={zenMode}
                    addNote={handleAddNote}
                    editNoteId={editNoteId}
                    setEditNoteId={setEditNoteId}
                    displayList={displayList}
                    setDisplayList={setDisplayList}
                />
            )}
            {appSettings.epubReaderSettings.showProgressInZenMode && (
                <div
                    className={"zenModePageNumber " + " show"}
                    style={{
                        backgroundColor: appSettings.epubReaderSettings.useDefault_progressBackgroundColor
                            ? "var(--body-bg-color)"
                            : appSettings.epubReaderSettings.progressBackgroundColor,
                        color: appSettings.epubReaderSettings.useDefault_fontColor
                            ? "currentColor"
                            : appSettings.epubReaderSettings.fontColor,
                    }}
                >
                    {bookProgress}%
                </div>
            )}
            <div className="shortcutClicked faded" ref={shortcutTextRef}>
                {shortcutText}
            </div>
            {appSettings.epubReaderSettings.forceLowBrightness.enabled && (
                <div
                    className="forcedLowBrightness"
                    style={{ "--neg-brightness": appSettings.epubReaderSettings.forceLowBrightness.value }}
                ></div>
            )}
            <section
                className={
                    "main " +
                    (appSettings.epubReaderSettings.useDefault_fontFamily ? "" : "forceFont ") +
                    (appSettings.epubReaderSettings.useDefault_fontWeight ? "" : "forceFontWeight ") +
                    (appSettings.epubReaderSettings.useDefault_paragraphSpacing ? "" : "forceParaGap ") +
                    (appSettings.epubReaderSettings.hyphenation ? "hyphen " : "") +
                    (appSettings.epubReaderSettings.limitImgHeight ? "limitImgHeight " : "") +
                    (appSettings.epubReaderSettings.noIndent ? "noIndent " : "") +
                    (appSettings.epubReaderSettings.invertImageColor ? "blendImage " : "") +
                    (appSettings.epubReaderSettings.textSelect ? "textSelect " : "")
                }
                ref={mainRef}
                style={{
                    fontSize: appSettings.epubReaderSettings.fontSize + "px",
                    "--font-family": appSettings.epubReaderSettings.useDefault_fontFamily
                        ? "inherit"
                        : appSettings.epubReaderSettings.fontFamily,
                    "--font-weight": appSettings.epubReaderSettings.useDefault_fontWeight
                        ? "inherit"
                        : appSettings.epubReaderSettings.fontWeight,
                    "--line-height": appSettings.epubReaderSettings.useDefault_lineSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.lineSpacing + "em",
                    "--word-spacing": appSettings.epubReaderSettings.useDefault_wordSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.wordSpacing + "em",
                    "--letter-spacing": appSettings.epubReaderSettings.useDefault_letterSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.letterSpacing + "em",
                    "--paragraph-gap": appSettings.epubReaderSettings.useDefault_paragraphSpacing
                        ? "auto"
                        : appSettings.epubReaderSettings.paragraphSpacing / 2 + "em 0",
                    "--width": appSettings.epubReaderSettings.readerWidth + "%",
                    "--epub-font-color": appSettings.epubReaderSettings.useDefault_fontColor
                        ? "none"
                        : appSettings.epubReaderSettings.fontColor,
                    "--epub-link-color": appSettings.epubReaderSettings.useDefault_linkColor
                        ? "none"
                        : appSettings.epubReaderSettings.linkColor,
                    "--epub-background-color": appSettings.epubReaderSettings.useDefault_backgroundColor
                        ? "var(--body-bg-color)"
                        : appSettings.epubReaderSettings.backgroundColor,
                }}
                onContextMenu={(e) => {
                    e.stopPropagation();
                    const items: Menu.ListItem[] = [
                        {
                            label: "Zen Mode",
                            selected: zenMode,
                            action() {
                                setZenMode((init) => !init);
                            },
                        },
                        {
                            label: "Hide Cursor in Zen Mode",
                            selected: appSettings.hideCursorInZenMode,
                            action() {
                                dispatch(
                                    setAppSettings({
                                        hideCursorInZenMode: !appSettings.hideCursorInZenMode,
                                    }),
                                );
                            },
                        },
                        {
                            label: "Double Click Zen Mode",
                            selected: !appSettings.epubReaderSettings.textSelect,
                            action() {
                                dispatch(
                                    setEpubReaderSettings({
                                        textSelect: !appSettings.epubReaderSettings.textSelect,
                                    }),
                                );
                            },
                        },
                        window.contextMenu.template.divider(),
                    ];
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && mainRef.current?.contains(selection.anchorNode)) {
                        items.push({
                            label: "Add Note",
                            action() {
                                handleAddNote();
                            },
                        });
                    }
                    items.push(
                        ...[
                            {
                                label: "Bookmark",
                                action() {
                                    addToBookmarkRef.current?.click();
                                },
                            },
                            window.contextMenu.template.divider(),
                            window.contextMenu.template.openInNewWindow(readerState.link),
                            window.contextMenu.template.showInExplorer(readerState.link),
                            window.contextMenu.template.copyPath(readerState.link),
                        ],
                    );
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        items,
                        padLeft: true,
                    });
                }}
                onClick={(e) => {
                    if (readerRef.current && appSettings.epubReaderSettings.loadOneChapter) {
                        if (
                            Math.ceil(
                                readerRef.current.scrollTop +
                                    window.innerHeight +
                                    (1 + Math.abs(1 - window.electron.webFrame.getZoomFactor())),
                            ) >= readerRef.current.scrollHeight ||
                            readerRef.current.scrollTop < window.innerHeight / 4
                        ) {
                            let clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                            if (isSideListPinned) {
                                clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                            }
                            if (clickPos <= 5) openPrevChapter();
                            if (clickPos > 95) openNextChapter();
                        }
                    }
                }}
                onDoubleClick={(e) => {
                    if (!appSettings.epubReaderSettings.textSelect) {
                        let clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                        if (isSideListPinned) {
                            clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                        }
                        if (clickPos > 5 && clickPos < 95) setZenMode((init) => !init);
                    }
                }}
            >
                <FootNodeModal
                    footnoteModalData={footnoteModalData}
                    close={() => setFootnoteModalData(null)}
                    onEpubLinkClick={onEpubLinkClick}
                />
                <StyleSheets sheets={epubData?.styleSheets || []} />
                {epubData && (
                    <HTMLPart
                        // loadOneChapter={appSettings.epubReaderSettings.loadOneChapter}
                        key={"epub" + currentChapter.index}
                        onEpubLinkClick={onEpubLinkClick}
                        currentChapter={{
                            id: epubData.spine[currentChapter.index].id,
                            fragment: currentChapter.fragment,
                            elementQuery: bookInReader?.progress?.position || "",
                        }}
                        epubManifest={epubData.manifest}
                        // bookmarkedElem={bookmarkedElem}
                    />
                )}
            </section>
        </div>
    );
};

export default EPubReader;
