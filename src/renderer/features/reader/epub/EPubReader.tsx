import { type EpubPackage, isExternalEpubReference } from "@common/epub";
import type { BookProgress } from "@common/types/db";
import { setAnilistCurrentListEntry } from "@store/anilist";
import { setAppSettings, setReaderSettings } from "@store/appSettings";
import { addNote } from "@store/bookNotes";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import store from "@store/index";
import { selectLibraryItem, updateCurrentItemProgress } from "@store/library";
import {
    getReaderBook,
    selectLiveBookReaderSettings,
    setReaderLoading,
    setReaderOpen,
    updateReaderBookProgress,
} from "@store/reader";
import {
    cyclePresetNext,
    cyclePresetPrev,
    ensureReaderPresetSession,
    patchLiveBookReaderSettings,
    selectPresetSlot,
} from "@store/readerPresets";
import { getShortcutsMapped } from "@store/shortcuts";
import { updateTrackerSnapshot } from "@store/trackers";
import { setAnilistListProgress, toAnilistTrackerSnapshotUpdate } from "@utils/anilist";
import { processChapterNumber } from "@utils/chapterUtils";
import { colorUtils } from "@utils/color";
import { dialogUtils } from "@utils/dialog";
import { readEpubFile } from "@utils/epub";
import { DEFAULT_HIGHLIGHT_COLORS, highlightUtils } from "@utils/highlight";
import { keyFormatter, mouseEventFormatter } from "@utils/keybindings";
import { syncBookLibraryOnReaderOpen } from "@utils/libraryMissingPath";
import { createRendererLogger } from "@utils/logger";
import { getCSSPath } from "@utils/utils";
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";
import FootNodeModal from "./components/FootNodeModal";
import EPUBReaderSettings from "./EPubReaderSettings";
import EPubReaderSideList from "./EPubReaderSideList";
import HTMLPart from "./HTMLPart";
import StyleSheets from "./StyleSheets";

const log = createRendererLogger("epub/EPubReader");

// todo: planning major refactor similar to manga Reader.tsx

const EPubReader: React.FC = () => {
    const { bookProgressRef, setContextMenuData } = useAppContext();

    const appSettings = useAppSelector((store) => store.appSettings);
    const epubReaderSettings = useAppSelector(selectLiveBookReaderSettings);
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const isSettingOpen = useAppSelector((store) => store.ui.isOpen.settings);
    const readerState = useAppSelector((store) => store.reader);
    const anilistCurrentListEntry = useAppSelector((store) => store.anilist.currentListEntry);
    const isLoading = useAppSelector((store) => store.reader.loading !== null);

    const libraryItem = useAppSelector((store) => selectLibraryItem(store, readerState.link));
    const bookInReader = useAppSelector(getReaderBook);

    const dispatch = useAppDispatch();
    const [epubData, setEpubData] = useState<EpubPackage | null>(null);
    /** Index of the current chapter in {@link EpubPackage.spine}. */
    const [currentChapter, setCurrentChapter] = useState({
        index: -1,
        fragment: "",
    });
    /**
     * Spine id at or before `currentChapter` that has a title in the TOC.
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
    const { t } = useTranslation("reader");
    const [shortcutText, setShortcutText] = useState("");
    // [0-100]
    const [bookProgress, setBookProgress] = useState(0);
    // last progress % flushed to React / makeScrollPos; scroll hot path only updates refs until this changes
    const flushedBookProgressRef = useRef(-1);
    const [footnoteModalData, setFootnoteModalData] = useState<{
        title: string;
        content: string;
    } | null>(null);

    const [editNoteId, setEditNoteId] = useState<number | null>(null);
    const [updatedAnilistProgress, setUpdatedAnilistProgress] = useState(false);
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
        if (epubReaderSettings.loadOneChapter && readerRef.current) readerRef.current.scrollTop = 0;
        const abortController = new AbortController();
        (async () => {
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
     * @param chapterId - id from {@link EpubPackage.spine}
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
                        message: t("errors.chapterIdNotFound"),
                    });
                }
            }
        },
        [epubData, t],
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
                if (isExternalEpubReference(href)) {
                    dialogUtils
                        .warn({
                            message: t("dialogs.openExternalLink"),
                            detail: href,
                            noOption: false,
                        })
                        .then((res) => {
                            if (res.response === 0) window.electron.openExternal(href);
                        });
                } else {
                    setProgressPosition("");
                    if (epubReaderSettings.loadOneChapter) {
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
                                message: t("errors.chapterLinkNotFound"),
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
        [epubData, currentChapter.index, t],
    );

    const loadEPub = (link: string) => {
        if (window.fs.existsSync(window.app.deleteDirOnClose))
            window.fs
                .rm(window.app.deleteDirOnClose, {
                    recursive: true,
                })
                .catch((err) => log.error("temp extract dir delete failed", err));

        link = window.path.normalize(link);
        readEpubFile(link, appSettings.keepExtractedFiles)
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
                await syncBookLibraryOnReaderOpen({
                    dispatch,
                    openedPath: link,
                    libraryItem: libraryItem?.type === "book" ? libraryItem : null,
                    progress,
                    title: ed.metadata.title,
                    author: ed.metadata.author || null,
                    coverAbsolutePath: ed.metadata.cover,
                });
                /* primary bind after the row exists; skip when openInReaderIfValid already started this session */
                if (store.getState().reader.presetSession?.itemLink !== link) {
                    await dispatch(ensureReaderPresetSession({ itemLink: link, itemType: "book" }));
                }
                setCurrentChapter({
                    index: currentChapterIndex,
                    fragment: "",
                });
                setEpubData(ed);
                // if (ed.toc.length > 200 && !epubReaderSettings.loadOneChapter)
                //     dialogUtils.warn({
                //         message: "Too many chapters in book.",
                //         detail: "It might cause instability and high RAM usage. It is recommended to enable option to load and show only chapter at a time from Settings -> Other Settings.",
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
                    foundElems.forEach((e) => void e.classList.remove("current"));
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
                        log.warn("find-in-page: no matching element in chapter DOM");
                    }
                }
            }
        },
        [findInPageRefs.current, mainRef.current],
    );

    /**
     * Scroll hot path: update the progress input from a ref; flush React state
     * only when the displayed integer % changes.
     * Redux CSS position still flushes on % change; call {@link makeScrollPos} directly
     * for bookmarks, and {@link window.app.flushEpubScrollPos} before close/save.
     */
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
        if (progress === flushedBookProgressRef.current) return;
        flushedBookProgressRef.current = progress;
        setBookProgress(progress);
        makeScrollPos();
    };

    useEffect(() => {
        window.app.flushEpubScrollPos = () => {
            makeScrollPos();
        };
        return () => {
            delete window.app.flushEpubScrollPos;
        };
    }, [makeScrollPos]);

    useEffect(() => {
        setUpdatedAnilistProgress(false);
        flushedBookProgressRef.current = -1;
        setBookProgress(0);
    }, [currentChapter.index]);

    useLayoutEffect(() => {
        if (updatedAnilistProgress || !appSettings.readerSettings.autoUpdateAnilistProgress) return;
        if (bookProgress < 70) return;
        if (!anilistCurrentListEntry || !bookInReader?.progress) return;
        const chapterNumber = processChapterNumber(bookInReader.progress.chapterName);
        if (!chapterNumber) return;
        setUpdatedAnilistProgress(true);
        if (chapterNumber > anilistCurrentListEntry.progress)
            setAnilistListProgress(chapterNumber).then((e) => {
                if (e) {
                    dispatch(setAnilistCurrentListEntry(e));
                    if (bookInReader.link)
                        void dispatch(updateTrackerSnapshot(toAnilistTrackerSnapshotUpdate(bookInReader.link, e)));
                }
            });
    }, [bookProgress, appSettings.readerSettings.autoUpdateAnilistProgress]);

    const handleAddNote = useCallback(
        (color?: string) => {
            const epubReader = document.querySelector("#EPubReader");
            if (!epubReader || !bookInReader?.progress?.chapterId) return;

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !mainRef.current?.contains(selection.anchorNode)) {
                dialogUtils.customError({
                    message: t("errors.selectTextFirst"),
                });
                return;
            }

            const range = highlightUtils.getCurrentSelection();
            if (!range) {
                dialogUtils.customError({
                    message: t("errors.selectionRangeFailed"),
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
                log.error("find-in-page scroll/highlight failed", err);
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
        [bookInReader, dispatch, t],
    );

    //todo remove behavior
    const scrollToPage = (percent: number, _behavior: ScrollBehavior = "smooth", callback?: () => void) => {
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

        type ShortcutEv = {
            preventDefault: () => void;
            stopPropagation: () => void;
            repeat: boolean;
            key?: string;
        };
        const handleShortcut = (keyStr: string, e: ShortcutEv): boolean => {
            window.app.keyRepeated = e.repeat;
            window.app.keydown = true;

            const is = (keys: string[]) => keys.includes(keyStr);
            const isReaderActive = !isSettingOpen && readerState.active && !isLoading;
            const isReaderFocused =
                document.activeElement?.tagName === "BODY" || document.activeElement === readerRef.current;
            const topBottomLogic =
                readerRef.current &&
                !e.repeat &&
                (Math.ceil(
                    readerRef.current.scrollTop +
                        window.innerHeight +
                        (1 + Math.abs(1 - window.electron.webFrame.getZoomFactor())),
                ) >= readerRef.current.scrollHeight ||
                    readerRef.current.scrollTop < window.innerHeight / 4);
            if (is(shortcutsMapped.contextMenu)) {
                e.stopPropagation();
                e.preventDefault();
                if (mainRef.current)
                    mainRef.current.dispatchEvent(
                        window.contextMenu.fakeEvent(
                            { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                            readerRef.current,
                        ),
                    );
                return true;
            }

            if (!isReaderActive) return false;

            if (e.key && [" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();

            if (e.repeat) return false;

            switch (true) {
                case is(shortcutsMapped.nextPage):
                    if (!isReaderFocused) break;
                    if (topBottomLogic) openNextChapter();
                    return true;
                case is(shortcutsMapped.prevPage):
                    if (!isReaderFocused) break;
                    if (topBottomLogic) openPrevChapter();
                    return true;
                case is(shortcutsMapped.readerSettings):
                    readerSettingExtender.current?.click();
                    readerSettingExtender.current?.focus();
                    return true;
                case is(shortcutsMapped.toggleZenMode):
                    setZenMode((prev) => !prev);
                    return true;
                case keyStr === "escape":
                    setZenMode(false);
                    return true;
                case is(shortcutsMapped.nextChapter):
                    openNextChapter();
                    return true;
                case is(shortcutsMapped.prevChapter):
                    openPrevChapter();
                    return true;
                case is(shortcutsMapped.bookmark):
                    addToBookmarkRef.current?.click();
                    return true;
                case is(shortcutsMapped.sizePlus):
                    sizePlusRef.current?.click();
                    return true;
                case is(shortcutsMapped.sizeMinus):
                    sizeMinusRef.current?.click();
                    return true;
                case is(shortcutsMapped.fontSizePlus):
                    fontSizePlusRef.current?.click();
                    return true;
                case is(shortcutsMapped.fontSizeMinus):
                    fontSizeMinusRef.current?.click();
                    return true;
                case is(shortcutsMapped.showHidePageNumberInZen):
                    setShortcutText(
                        epubReaderSettings.showProgressInZenMode
                            ? t("hud.hideProgressInZen")
                            : t("hud.showProgressInZen"),
                    );
                    dispatch(
                        patchLiveBookReaderSettings({
                            showProgressInZenMode: !epubReaderSettings.showProgressInZenMode,
                        }),
                    );
                    return true;
                case is(shortcutsMapped.cyclePresetNext): {
                    const name = dispatch(cyclePresetNext("book")) as string | null;
                    if (name) setShortcutText(t("hud.presetNamed", { name }));
                    return true;
                }
                case is(shortcutsMapped.cyclePresetPrev): {
                    const name = dispatch(cyclePresetPrev("book")) as string | null;
                    if (name) setShortcutText(t("hud.presetNamed", { name }));
                    return true;
                }
                case is(shortcutsMapped.selectPreset1):
                case is(shortcutsMapped.selectPreset2):
                case is(shortcutsMapped.selectPreset3):
                case is(shortcutsMapped.selectPreset4):
                case is(shortcutsMapped.selectPreset5): {
                    const slotIdx = [
                        shortcutsMapped.selectPreset1,
                        shortcutsMapped.selectPreset2,
                        shortcutsMapped.selectPreset3,
                        shortcutsMapped.selectPreset4,
                        shortcutsMapped.selectPreset5,
                    ].findIndex((keys) => is(keys ?? []));
                    if (slotIdx >= 0) {
                        const name = dispatch(selectPresetSlot("book", slotIdx)) as string | null;
                        if (name) setShortcutText(t("hud.presetNamed", { name }));
                    }
                    return true;
                }
                default:
                    break;
            }
            if (isReaderFocused) {
                switch (true) {
                    case is(shortcutsMapped.largeScrollReverse):
                        e.preventDefault();
                        scrollReader(0 - epubReaderSettings.scrollSpeedB);
                        return true;
                    case is(shortcutsMapped.largeScroll):
                        e.preventDefault();
                        scrollReader(epubReaderSettings.scrollSpeedB);
                        return true;
                    case is(shortcutsMapped.scrollDown):
                        scrollReader(epubReaderSettings.scrollSpeedA);
                        return true;
                    case is(shortcutsMapped.scrollUp):
                        scrollReader(0 - epubReaderSettings.scrollSpeedA);
                        return true;
                    default:
                        break;
                }
            }
            return false;
        };
        const registerShortcuts = (e: KeyboardEvent) => {
            const keyStr = keyFormatter(e);
            if (keyStr === "" && e.key !== "Escape") return;
            handleShortcut(keyStr, e);
        };
        const registerMouseShortcuts = (e: MouseEvent) => {
            const keyStr = mouseEventFormatter(e);
            if (keyStr === "") return;
            if (
                handleShortcut(keyStr, {
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation(),
                    repeat: false,
                })
            )
                e.preventDefault();
        };
        const onPointerUp = () => {
            window.app.keydown = false;
        };
        window.addEventListener("wheel", wheelFunction);
        window.addEventListener("keydown", registerShortcuts);
        window.addEventListener("mousedown", registerMouseShortcuts);
        window.addEventListener("keyup", onPointerUp);
        window.addEventListener("mouseup", onPointerUp);
        return () => {
            window.removeEventListener("wheel", wheelFunction);
            window.removeEventListener("keydown", registerShortcuts);
            window.removeEventListener("mousedown", registerMouseShortcuts);
            window.removeEventListener("keyup", onPointerUp);
            window.removeEventListener("mouseup", onPointerUp);
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
        epubReaderSettings.readerWidth,
        isSideListPinned,
        epubReaderSettings.fontSize,
        epubReaderSettings.lineSpacing,
        epubReaderSettings.paragraphSpacing,
        //! these were not needed caused bad auto scroll
        // epubReaderSettings.fontFamily,
        // epubReaderSettings.wordSpacing,
        // epubReaderSettings.useDefault_fontFamily,
        epubReaderSettings.useDefault_lineSpacing,
        epubReaderSettings.useDefault_paragraphSpacing,
        // epubReaderSettings.useDefault_wordSpacing,
    ]);

    useEffect(() => {
        if (shortcutText === "") return;
        let timeOutId: NodeJS.Timeout;
        let timeOutId2: NodeJS.Timeout;
        const e = shortcutTextRef.current;
        if (shortcutText !== "") {
            if (e) {
                e.innerText = shortcutText;
                e.classList.remove("faded");
                timeOutId = setTimeout(() => {
                    e.classList.add("faded");
                    timeOutId2 = setTimeout(() => {
                        setShortcutText("");
                    }, 500);
                }, 500);
            }
        }
        return () => {
            clearTimeout(timeOutId);
            clearTimeout(timeOutId2);
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
                gridTemplateColumns: `${sideListWidth}px auto`,
                display: readerState.active ? (isSideListPinned ? "grid" : "block") : "none",
                "--sideListWidth": `${sideListWidth}px`,
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
            {epubReaderSettings.showProgressInZenMode && (
                <div
                    className={"zenModePageNumber " + " show"}
                    style={{
                        backgroundColor: epubReaderSettings.useDefault_progressBackgroundColor
                            ? "var(--body-bg-color)"
                            : epubReaderSettings.progressBackgroundColor,
                        color: epubReaderSettings.useDefault_fontColor
                            ? "currentColor"
                            : epubReaderSettings.fontColor,
                    }}
                >
                    {bookProgress}%
                </div>
            )}
            <div className="shortcutClicked faded" ref={shortcutTextRef}>
                {shortcutText}
            </div>
            {epubReaderSettings.forceLowBrightness.enabled && (
                <div
                    className="forcedLowBrightness"
                    style={{ "--neg-brightness": epubReaderSettings.forceLowBrightness.value }}
                ></div>
            )}
            {epubReaderSettings.backgroundImage.enabled && epubReaderSettings.backgroundImage.path && (
                <>
                    <div
                        className="epubBackgroundWallpaper"
                        style={{
                            backgroundImage: `url("file:///${epubReaderSettings.backgroundImage.path.replace(/\\/g, "/").replaceAll("#", "%23")}")`,
                            filter: `brightness(${epubReaderSettings.backgroundImage.brightness / 100}) contrast(${epubReaderSettings.backgroundImage.contrast / 100})`,
                        }}
                    />
                    {epubReaderSettings.backgroundImage.dimIntensity > 0 && (
                        <div
                            className="epubBackgroundDim"
                            style={{
                                opacity: epubReaderSettings.backgroundImage.dimIntensity / 100,
                            }}
                        />
                    )}
                    {epubReaderSettings.backgroundImage.layer.enabled && (
                        <div
                            className="epubBackgroundLayer"
                            style={{
                                backgroundColor: epubReaderSettings.backgroundImage.layer.color,
                                opacity: epubReaderSettings.backgroundImage.layer.opacity,
                            }}
                        />
                    )}
                </>
            )}
            <section
                className={
                    "main " +
                    (epubReaderSettings.backgroundImage.enabled && epubReaderSettings.backgroundImage.path
                        ? "hasBackgroundImage "
                        : "") +
                    (epubReaderSettings.useDefault_fontFamily ? "" : "forceFont ") +
                    (epubReaderSettings.useDefault_fontWeight ? "" : "forceFontWeight ") +
                    (epubReaderSettings.useDefault_paragraphSpacing ? "" : "forceParaGap ") +
                    (epubReaderSettings.hyphenation ? "hyphen " : "") +
                    (epubReaderSettings.limitImgHeight ? "limitImgHeight " : "") +
                    (epubReaderSettings.noIndent ? "noIndent " : "") +
                    (epubReaderSettings.invertImageColor ? "blendImage " : "") +
                    (epubReaderSettings.textSelect ? "textSelect " : "") +
                    (epubReaderSettings.overrideEpubColors && !epubReaderSettings.useDefault_fontColor
                        ? "overrideEpubFontColor "
                        : "") +
                    (epubReaderSettings.overrideEpubColors && !epubReaderSettings.useDefault_linkColor
                        ? "overrideEpubLinkColor "
                        : "") +
                    (epubReaderSettings.overrideEpubColors && !epubReaderSettings.useDefault_backgroundColor
                        ? "overrideEpubPageBg "
                        : "") +
                    (epubReaderSettings.overrideEpubColors &&
                    !epubReaderSettings.contentFrame.useDefault_contentBackgroundColor
                        ? "overrideEpubContentBg "
                        : "")
                }
                ref={mainRef}
                style={{
                    fontSize: `${epubReaderSettings.fontSize}px`,
                    "--font-family": epubReaderSettings.useDefault_fontFamily
                        ? "inherit"
                        : epubReaderSettings.fontFamily,
                    "--font-weight": epubReaderSettings.useDefault_fontWeight
                        ? "inherit"
                        : epubReaderSettings.fontWeight,
                    "--line-height": epubReaderSettings.useDefault_lineSpacing
                        ? "normal"
                        : `${epubReaderSettings.lineSpacing}em`,
                    "--word-spacing": epubReaderSettings.useDefault_wordSpacing
                        ? "normal"
                        : `${epubReaderSettings.wordSpacing}em`,
                    "--letter-spacing": epubReaderSettings.useDefault_letterSpacing
                        ? "normal"
                        : `${epubReaderSettings.letterSpacing}em`,
                    "--paragraph-gap": epubReaderSettings.useDefault_paragraphSpacing
                        ? "auto"
                        : `${epubReaderSettings.paragraphSpacing / 2}em 0`,
                    "--width": `${epubReaderSettings.readerWidth}%`,
                    "--epub-font-color": epubReaderSettings.useDefault_fontColor
                        ? "none"
                        : epubReaderSettings.fontColor,
                    "--epub-link-color": epubReaderSettings.useDefault_linkColor
                        ? "none"
                        : epubReaderSettings.linkColor,
                    "--epub-background-color": epubReaderSettings.useDefault_backgroundColor
                        ? "var(--body-bg-color)"
                        : epubReaderSettings.backgroundColor,
                    "--epub-content-background-color": epubReaderSettings.contentFrame
                        .useDefault_contentBackgroundColor
                        ? "transparent"
                        : epubReaderSettings.contentFrame.contentBackgroundColor,
                    "--epub-cont-padding-inline": `${epubReaderSettings.contentFrame.paddingInline}px`,
                    "--epub-content-border-width": epubReaderSettings.contentFrame.border.enabled
                        ? `${epubReaderSettings.contentFrame.border.width}px`
                        : "0px",
                    "--epub-content-border-style": epubReaderSettings.contentFrame.border.style,
                    "--epub-content-border-color": epubReaderSettings.contentFrame.border.enabled
                        ? epubReaderSettings.contentFrame.border.color
                        : "transparent",
                }}
                onContextMenu={(e) => {
                    e.stopPropagation();
                    const items: Menu.ListItem[] = [
                        {
                            label: t("contextMenu.zenMode"),
                            selected: zenMode,
                            action() {
                                setZenMode((init) => !init);
                            },
                        },
                        {
                            label: t("contextMenu.hideCursorInZen"),
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
                            label: t("contextMenu.doubleClickZen"),
                            selected: !epubReaderSettings.textSelect,
                            action() {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        textSelect: !epubReaderSettings.textSelect,
                                    }),
                                );
                            },
                        },
                        window.contextMenu.template.divider(),
                    ];
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && mainRef.current?.contains(selection.anchorNode)) {
                        items.push({
                            label: t("contextMenu.addNote"),
                            action() {
                                handleAddNote();
                            },
                        });
                    }
                    items.push(
                        ...[
                            {
                                label: t("contextMenu.bookmark"),
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
                    if (readerRef.current && epubReaderSettings.loadOneChapter) {
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
                    if (!epubReaderSettings.textSelect) {
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
                        // loadOneChapter={epubReaderSettings.loadOneChapter}
                        key={`epub${currentChapter.index}`}
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
