import {
    countCaseInsensitiveMatches,
    type EpubPackage,
    findSpineIndexByHref,
    formatPublicationPercent,
    isExternalEpubReference,
    publicationFraction,
    publicationPercent,
    spineIndexFromPublicationFraction,
} from "@common/epub";
import type { BookProgress } from "@common/types/db";
import { useAppContext } from "@renderer/App";
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
import {
    captureEpubReadingPlace,
    clearEpubFindHighlights,
    type EpubReadingPlace,
    epubChapterRootId,
    highlightNthFindMatch,
    inChapterFractionFromSpineRow,
    originSpineIndexFromClick,
    queryEpubPosition,
    readEpubChapter,
    readEpubFile,
    spineFileWeights,
    spineIndexFromSpineRow,
    spineRowAtReaderTop,
} from "@utils/epub";
import { DEFAULT_HIGHLIGHT_COLORS, highlightUtils } from "@utils/highlight";
import { keyFormatter, mouseEventFormatter } from "@utils/keybindings";
import { syncBookLibraryOnReaderOpen } from "@utils/libraryMissingPath";
import { createRendererLogger } from "@utils/logger";
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";
import FootNodeModal from "./components/FootNodeModal";
import EPUBReaderSettings from "./EPubReaderSettings";
import EPubReaderSideList from "./EPubReaderSideList";
import HTMLPart from "./HTMLPart";
import StyleSheets from "./StyleSheets";
import { type EpubScrollTarget, useContinuousEpubScroll } from "./useContinuousEpubScroll";

const log = createRendererLogger("epub/EPubReader");

/** Limits persistence/selector work during continuous scrolling while displays update each frame. */
const CONTINUOUS_PROGRESS_CAPTURE_MS = 150;

// todo: planning major refactor similar to manga Reader.tsx

/** Renders the active book and keeps chapter-at-a-time behavior separate from continuous navigation. */
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
    const isContinuousScroll = epubReaderSettings.continuousChapters;
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
    const [spineWeights, setSpineWeights] = useState<number[]>([]);
    const currentChapterIndexRef = useRef(0);
    const pendingRestoreRef = useRef<EpubReadingPlace | null>(null);
    const didInitialSpineScrollRef = useRef(false);
    const scrollFrameRef = useRef<number | null>(null);
    const loadGenerationRef = useRef(0);
    const captureProgressRef = useRef<() => void>(() => undefined);
    const updateProgressRef = useRef<() => void>(() => undefined);
    const progressCaptureTimerRef = useRef<number | null>(null);
    const zenProgressRef = useRef<HTMLDivElement>(null);
    const findSessionRef = useRef<{
        query: string;
        chapterId: string;
        matchIndex: number;
    } | null>(null);

    const continuous = useContinuousEpubScroll({
        enabled: isContinuousScroll,
        epubData,
        weights: spineWeights,
        readerRef,
    });
    const spineVirtualizer = continuous.virtualizer;
    /**
     * Sets the current spine index (and optional fragment) and keeps the scroll hot-path ref in sync.
     */
    const setSpineChapter = useCallback((spineIndex: number, fragment = "") => {
        currentChapterIndexRef.current = spineIndex;
        setCurrentChapter({ index: spineIndex, fragment });
    }, []);

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
        const generation = ++loadGenerationRef.current;
        if (readerState.link) void loadEPub(readerState.link, generation);
        return () => {
            loadGenerationRef.current += 1;
        };
    }, [readerState.link]);
    useLayoutEffect(() => {
        if (!isContinuousScroll && readerRef.current) readerRef.current.scrollTop = 0;
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
                    const spineItemId = epubData.spine[currentChapter.index]?.id ?? "";
                    if (!isContinuousScroll) {
                        dispatch(
                            updateReaderBookProgress({
                                chapterId: spineItemId,
                                chapterName: epubData.manifest.get(id)?.title || "~",
                            }),
                        );
                        dispatch(updateCurrentItemProgress());
                    }
                    setCurrentChapterFake(id);
                }
            }
        })();
        return () => {
            abortController.abort();
        };
    }, [currentChapter.index, epubData, isContinuousScroll]);

    const scrollReader = (intensity: number) => {
        if (isContinuousScroll) continuous.cancelNavigation();
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
    /** Finishes one continuous destination before publishing its visible chapter and locator. */
    const navigateContinuous = useCallback(
        async (target: EpubScrollTarget, callback?: () => void) => {
            const targetIndex = epubData?.spine.findIndex((chapter) => chapter.id === target.chapterId) ?? -1;
            if (targetIndex >= 0) currentChapterIndexRef.current = targetIndex;
            const arrived = await continuous.navigate(target);
            if (!arrived) return;
            pendingRestoreRef.current = null;
            updateProgressRef.current();
            captureProgressRef.current();
            callback?.();
        },
        [epubData, continuous.navigate],
    );

    useEffect(() => {
        if (!isContinuousScroll || !epubData || didInitialSpineScrollRef.current) return;
        const target = pendingRestoreRef.current;
        if (!target) return;
        didInitialSpineScrollRef.current = true;
        void navigateContinuous(target);
    }, [epubData, isContinuousScroll, navigateContinuous]);

    /** Advances to the next spine item, keeping continuous jumps under one navigation owner. */
    const openNextChapter = useCallback(() => {
        if (!epubData) return;
        const nextIndex = currentChapterIndexRef.current + 1;
        const chapter = epubData.spine[nextIndex];
        if (!chapter) return;
        if (isContinuousScroll) void navigateContinuous({ chapterId: chapter.id, position: "" });
        else setSpineChapter(nextIndex);
    }, [epubData, isContinuousScroll, navigateContinuous, setSpineChapter]);

    /** Opens the preceding spine item using the same destination path as TOC navigation. */
    const openPrevChapter = useCallback(() => {
        if (!epubData) return;
        const prevIndex = currentChapterIndexRef.current - 1;
        const chapter = epubData.spine[prevIndex];
        if (!chapter) return;
        if (isContinuousScroll) void navigateContinuous({ chapterId: chapter.id, position: "" });
        else setSpineChapter(prevIndex);
    }, [epubData, isContinuousScroll, navigateContinuous, setSpineChapter]);

    /** Opens an OPF spine id and optionally a stored bookmark/note selector within that chapter. */
    const openChapterById = useCallback(
        (chapterId: string, position = "") => {
            if (!epubData) return;
            const index = epubData.spine.findIndex((chapter) => chapter.id === chapterId);
            if (index < 0) {
                dialogUtils.customError({ message: t("errors.chapterIdNotFound") });
                return;
            }
            if (isContinuousScroll) {
                void navigateContinuous({ chapterId, position });
                return;
            }
            setSpineChapter(index);
            if (position) {
                setProgressPosition(position);
                const chapterRoot = document.getElementById(epubChapterRootId(chapterId));
                if (chapterRoot) queryEpubPosition(chapterRoot, position)?.scrollIntoView({ block: "start" });
            }
        },
        [epubData, t, isContinuousScroll, setProgressPosition, navigateContinuous, setSpineChapter],
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
            if (!href) return;
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
                return;
            }
            const fragment = href.split("#")[1] || "";
            const hrefSpineIndex = findSpineIndexByHref(epubData.spine, href);
            const originIndex = originSpineIndexFromClick(
                ev.currentTarget,
                epubData.spine,
                currentChapterIndexRef.current,
            );
            const targetIndex = hrefSpineIndex < 0 ? originIndex : hrefSpineIndex;
            const targetSpine = epubData.spine[targetIndex];
            if (!targetSpine) {
                dialogUtils.customError({
                    message: t("errors.chapterLinkNotFound"),
                });
                return;
            }
            const isNoteLink =
                ev.currentTarget instanceof HTMLElement &&
                ev.currentTarget.getAttribute("epub:type")?.includes("note");
            if (isNoteLink && fragment) {
                const showFootnote = async () => {
                    const inDom = document
                        .getElementById(epubChapterRootId(targetSpine.id))
                        ?.querySelector(`[data-epub-id="${CSS.escape(fragment)}"]`)?.innerHTML;
                    if (inDom) {
                        setFootnoteModalData({
                            title: (ev.currentTarget as HTMLElement).innerText,
                            content: inDom,
                        });
                        return;
                    }
                    const html = await readEpubChapter(targetSpine.href);
                    const holder = document.createElement("div");
                    holder.innerHTML = html;
                    const content =
                        holder.querySelector(`[data-epub-id="${CSS.escape(fragment)}"]`)?.innerHTML || "";
                    setFootnoteModalData({
                        title: (ev.currentTarget as HTMLElement).innerText,
                        content,
                    });
                };
                void showFootnote();
                return;
            }
            if (isContinuousScroll) {
                void navigateContinuous({
                    chapterId: targetSpine.id,
                    position: fragment ? `[data-epub-id="${CSS.escape(fragment)}"]` : "",
                });
                return;
            }
            setProgressPosition("");
            if (targetIndex !== currentChapterIndexRef.current) {
                setSpineChapter(targetIndex, fragment);
            } else if (fragment) {
                document
                    .getElementById(epubChapterRootId(targetSpine.id))
                    ?.querySelector(`[data-epub-id="${CSS.escape(fragment)}"]`)
                    ?.scrollIntoView({ block: "start" });
            }
        },
        [epubData, t, isContinuousScroll, setProgressPosition, navigateContinuous, setSpineChapter],
    );

    /** Opens the package from a complete live, requested, or stored chapter/locator pair. */
    const loadEPub = async (link: string, generation: number) => {
        if (window.fs.existsSync(window.app.deleteDirOnClose))
            await window.fs
                .rm(window.app.deleteDirOnClose, {
                    recursive: true,
                })
                .catch((err) => log.error("temp extract dir delete failed", err));
        if (generation !== loadGenerationRef.current) return;

        link = window.path.normalize(link);
        await readEpubFile(link, appSettings.keepExtractedFiles)
            .then(async (ed) => {
                if (generation !== loadGenerationRef.current) return;
                // todo : When current chapter is not top level(level=0), make BookItem.chapter concat of all parent chapters.
                let currentChapterIndex = 0;
                const readerSnap = store.getState().reader;
                const liveBook = readerSnap.type === "book" ? readerSnap.content : null;
                // keep each chapter and selector together, including an intentional empty chapter-start selector
                const openingPlace =
                    liveBook?.link === link && liveBook.progress
                        ? liveBook.progress
                        : readerSnap.type === "book" && readerSnap.epubChapterId
                          ? {
                                chapterId: readerSnap.epubChapterId,
                                position: readerSnap.epubElementQueryString || "",
                            }
                          : libraryItem?.type === "book"
                            ? libraryItem.progress
                            : null;
                const chapterIdForOpen = openingPlace?.chapterId;
                const positionForOpen = openingPlace?.position || "";
                if (chapterIdForOpen) currentChapterIndex = ed.spine.findIndex((e) => e.id === chapterIdForOpen);
                if (currentChapterIndex < 0) currentChapterIndex = 0;

                const progress: BookProgress = {
                    chapterId: ed.spine[currentChapterIndex].id,
                    chapterName: ed.manifest.get(ed.spine[currentChapterIndex].id)?.title || "~",
                    position: positionForOpen,
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
                if (generation !== loadGenerationRef.current) return;
                pendingRestoreRef.current = { chapterId: progress.chapterId, position: progress.position };
                didInitialSpineScrollRef.current = false;
                setSpineChapter(currentChapterIndex, "");
                // finish weights before mounting so late IO cannot reset measurements during restoration
                if (isContinuousScroll)
                    setSpineWeights(await spineFileWeights(ed.spine.map((spineItem) => spineItem.href)));
                if (generation !== loadGenerationRef.current) return;
                setEpubData(ed);
                dispatch(setReaderLoading(null));
                dispatch(setReaderOpen());
            })
            .catch((error) => {
                log.error("EPUB opening failed", { itemLink: link }, error);
                if (generation === loadGenerationRef.current) dispatch(setReaderLoading(null));
            });
    };

    /** Captures a complete chapter/selector pair; intermediate navigation positions are never published. */
    const makeScrollPos = useCallback(
        (callback?: (progress: { chapterName: string; chapterId: string; position: string }) => void) => {
            const reader = readerRef.current;
            if (!reader || (isContinuousScroll && continuous.isPositioningRef.current)) return;
            const place = isContinuousScroll ? continuous.captureReadingPlace() : captureEpubReadingPlace(reader);
            if (!place) return;
            const spineIndex = epubData?.spine.findIndex((chapter) => chapter.id === place.chapterId) ?? -1;
            if (isContinuousScroll && spineIndex >= 0 && currentChapter.index !== spineIndex)
                setSpineChapter(spineIndex);
            const progress = {
                chapterId: place.chapterId,
                position: place.position,
                chapterName:
                    epubData?.manifest.get(place.chapterId)?.title ||
                    epubData?.manifest.get(currentChapterFake)?.title ||
                    "~",
            };
            callback?.(progress);
            dispatch(updateReaderBookProgress(progress));
        },
        [
            epubData,
            currentChapter.index,
            currentChapterFake,
            dispatch,
            isContinuousScroll,
            continuous.captureReadingPlace,
            continuous.isPositioningRef,
            setSpineChapter,
        ],
    );

    const holdReadingPlace = continuous.holdReadingPlace;
    const releaseReadingPlace = continuous.cancelNavigation;

    const findInPage = useCallback(
        (query: string, forward = true) => {
            if (!epubData) return;
            const spineItem = epubData.spine[currentChapterIndexRef.current];
            if (!spineItem) return;
            const root = document.getElementById(epubChapterRootId(spineItem.id));
            if (query === "") {
                if (root instanceof HTMLElement) clearEpubFindHighlights(root);
                findSessionRef.current = null;
                return;
            }
            if (!(root instanceof HTMLElement) || root.childNodes.length === 0) return;
            /* ponytail: current chapter only; upgrade is whole-book search over extracted spine text */
            let session = findSessionRef.current;
            if (!session || session.query !== query || session.chapterId !== spineItem.id) {
                session = { query, chapterId: spineItem.id, matchIndex: forward ? -1 : 0 };
            }
            const hitCount = countCaseInsensitiveMatches(root.innerText, query.trim());
            if (hitCount === 0) {
                clearEpubFindHighlights(root);
                log.warn("find-in-page: no matches in the current chapter");
                findSessionRef.current = session;
                return;
            }
            let nextIndex = session.matchIndex + (forward ? 1 : -1);
            if (nextIndex < 0) nextIndex = hitCount - 1;
            if (nextIndex >= hitCount) nextIndex = 0;
            session.matchIndex = nextIndex;
            findSessionRef.current = session;
            const currentMatch = highlightNthFindMatch(root, query, nextIndex);
            if (isContinuousScroll && currentMatch) {
                void navigateContinuous({ chapterId: spineItem.id, position: ".findInPage-highlight.current" });
            } else currentMatch?.scrollIntoView({ behavior: "auto", block: "start" });
        },
        [epubData, isContinuousScroll, navigateContinuous],
    );

    /** Updates display from live geometry and batches continuous locator capture outside the scroll frame. */
    const updateProgress = () => {
        const reader = readerRef.current;
        if (!reader || (isContinuousScroll && continuous.isPositioningRef.current)) return;
        let progress = 0;
        if (isContinuousScroll && epubData && spineWeights.length > 0) {
            const spineRow = spineRowAtReaderTop(reader);
            const spineIndex = spineRow ? spineIndexFromSpineRow(spineRow) : null;
            if (spineIndex === null || !spineRow) return;
            currentChapterIndexRef.current = spineIndex;
            const fraction = inChapterFractionFromSpineRow(reader, spineRow);
            const atBookEnd =
                reader.scrollHeight > reader.clientHeight &&
                reader.scrollTop + reader.clientHeight >= reader.scrollHeight - 2 &&
                spineVirtualizer.getVirtualItems().some((chapter) => chapter.index === epubData.spine.length - 1);
            progress = atBookEnd
                ? 100
                : publicationPercent(publicationFraction(spineWeights, spineIndex, fraction));
            if (progressCaptureTimerRef.current === null) {
                progressCaptureTimerRef.current = window.setTimeout(() => {
                    progressCaptureTimerRef.current = null;
                    captureProgressRef.current();
                }, CONTINUOUS_PROGRESS_CAPTURE_MS);
            }
        } else {
            progress = Math.round((reader.scrollTop / (reader.scrollHeight - reader.offsetHeight)) * 100) || 0;
        }
        const formatted = isContinuousScroll ? formatPublicationPercent(progress) : progress.toString();
        if (bookProgressRef.current) bookProgressRef.current.value = formatted;
        if (isContinuousScroll && zenProgressRef.current) zenProgressRef.current.textContent = `${formatted}%`;
        if (progress === flushedBookProgressRef.current) return;
        flushedBookProgressRef.current = progress;
        if (!isContinuousScroll) {
            setBookProgress(progress);
            makeScrollPos();
        }
    };
    captureProgressRef.current = makeScrollPos;
    updateProgressRef.current = updateProgress;

    useEffect(
        () => () => {
            if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
            if (progressCaptureTimerRef.current !== null) window.clearTimeout(progressCaptureTimerRef.current);
        },
        [],
    );

    useEffect(() => {
        window.app.flushEpubScrollPos = () => {
            makeScrollPos();
        };
        return () => {
            delete window.app.flushEpubScrollPos;
        };
    }, [makeScrollPos]);

    useEffect(() => {
        const input = bookProgressRef.current;
        if (!input) return;
        input.step = isContinuousScroll ? "0.01" : "1";
    }, [isContinuousScroll, bookProgressRef]);

    useEffect(() => {
        const reader = readerRef.current;
        if (!reader || !isContinuousScroll || !epubData) return;
        let width = reader.clientWidth;
        let height = reader.clientHeight;
        const observer = new ResizeObserver(() => {
            if (reader.clientWidth === width && reader.clientHeight === height) return;
            width = reader.clientWidth;
            height = reader.clientHeight;
            if (!continuous.isPositioningRef.current)
                void continuous.restoreReadingPlace().then(() => updateProgressRef.current());
        });
        observer.observe(reader);
        return () => observer.disconnect();
    }, [isContinuousScroll, epubData, continuous.restoreReadingPlace]);

    useEffect(() => {
        setUpdatedAnilistProgress(false);
        if (!isContinuousScroll) {
            flushedBookProgressRef.current = -1;
            setBookProgress(0);
        }
    }, [currentChapter.index, isContinuousScroll]);

    useLayoutEffect(() => {
        /* ponytail: AniList auto skipped in continuous; upgrade is a book-specific tracker rule */
        if (isContinuousScroll) return;
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
    }, [bookProgress, appSettings.readerSettings.autoUpdateAnilistProgress, isContinuousScroll]);

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

    /** Restores a captured continuous anchor after reader typography or chrome changes. */
    const restoreContinuousAfterLayout = useCallback(() => {
        void continuous.restoreReadingPlace().then(() => updateProgressRef.current());
    }, [continuous.restoreReadingPlace]);

    /** Seeks within the chapter in normal mode, or through file-weighted publication progress in continuous mode. */
    const scrollToPage = (percent: number, _behavior: ScrollBehavior = "smooth", callback?: () => void) => {
        const reader = readerRef.current;
        if (!reader || !Number.isFinite(percent)) return;
        if (isContinuousScroll && spineWeights.length > 0 && epubData) {
            const { spineIndex, inChapterFraction } = spineIndexFromPublicationFraction(
                spineWeights,
                percent / 100,
            );
            const chapterId = epubData.spine[spineIndex]?.id;
            if (chapterId) void navigateContinuous({ chapterId, position: "", inChapterFraction }, callback);
            return;
        }
        reader.scrollTo(0, (percent / 100) * (reader.scrollHeight - reader.offsetHeight));
        callback?.();
    };
    window.app.scrollToPage = scrollToPage;
    const toggleZenMode = () => {
        holdReadingPlace();
        if (!zenMode) setSideListPinned(false);
        setZenMode((prev) => !prev);
    };
    useEffect(() => {
        if (zenMode) {
            setWasMaximized(window.electron.currentWindow.isMaximized());
            document.body.classList.add("zenMode");
            window.electron.currentWindow.setFullScreen(true);
        } else {
            document.body.classList.remove("zenMode");
            setWasMaximized(false);
            if (window.electron.currentWindow.isFullScreen()) window.electron.currentWindow.setFullScreen(false);
        }
        if (isContinuousScroll) {
            return;
        }
        if (!((zenMode && !window.electron.currentWindow.isMaximized()) || (!zenMode && !wasMaximized))) return;
        const timeoutId = window.setTimeout(() => {
            if (bookInReader?.progress?.position)
                document.querySelector(bookInReader.progress.position)?.scrollIntoView({
                    behavior: "auto",
                    block: "start",
                });
        }, 100);
        return () => window.clearTimeout(timeoutId);
    }, [zenMode]);

    useLayoutEffect(() => {
        if (isSideListPinned) {
            if (isContinuousScroll) restoreContinuousAfterLayout();
            else {
                const position = bookInReader?.progress?.position;
                if (position)
                    document.querySelector(position)?.scrollIntoView({
                        behavior: "auto",
                        block: "start",
                    });
            }
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
            if (isContinuousScroll) releaseReadingPlace();
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
                    if (topBottomLogic && !isContinuousScroll) openNextChapter();
                    return true;
                case is(shortcutsMapped.prevPage):
                    if (!isReaderFocused) break;
                    if (topBottomLogic && !isContinuousScroll) openPrevChapter();
                    return true;
                case is(shortcutsMapped.readerSettings):
                    readerSettingExtender.current?.click();
                    readerSettingExtender.current?.focus();
                    return true;
                case is(shortcutsMapped.toggleZenMode):
                    toggleZenMode();
                    return true;
                case keyStr === "escape":
                    holdReadingPlace();
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
    }, [
        isSideListPinned,
        appSettings,
        isLoading,
        shortcutsMapped,
        isSettingOpen,
        epubData,
        readerState.active,
        isContinuousScroll,
    ]);

    useLayoutEffect(() => {
        if (!isContinuousScroll) return;
        restoreContinuousAfterLayout();
    }, [
        epubReaderSettings.readerWidth,
        isSideListPinned,
        epubReaderSettings.fontSize,
        epubReaderSettings.fontFamily,
        epubReaderSettings.fontWeight,
        epubReaderSettings.lineSpacing,
        epubReaderSettings.paragraphSpacing,
        epubReaderSettings.wordSpacing,
        epubReaderSettings.letterSpacing,
        epubReaderSettings.useDefault_fontFamily,
        epubReaderSettings.useDefault_fontWeight,
        epubReaderSettings.useDefault_lineSpacing,
        epubReaderSettings.useDefault_paragraphSpacing,
        epubReaderSettings.useDefault_wordSpacing,
        epubReaderSettings.useDefault_letterSpacing,
        epubReaderSettings.limitImgHeight,
        epubReaderSettings.noIndent,
        epubReaderSettings.hyphenation,
        epubReaderSettings.contentFrame.paddingInline,
        epubReaderSettings.contentFrame.border.enabled,
        epubReaderSettings.contentFrame.border.width,
        zenMode,
        restoreContinuousAfterLayout,
    ]);

    useLayoutEffect(() => {
        if (isContinuousScroll) return;
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
        epubReaderSettings.useDefault_lineSpacing,
        epubReaderSettings.useDefault_paragraphSpacing,
        isContinuousScroll,
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
                overflowAnchor: isContinuousScroll ? "none" : undefined,
            }}
            onScroll={() => {
                if (!isContinuousScroll) {
                    updateProgress();
                    return;
                }
                if (scrollFrameRef.current !== null) return;
                scrollFrameRef.current = requestAnimationFrame(() => {
                    scrollFrameRef.current = null;
                    updateProgressRef.current();
                });
            }}
            onPointerDown={() => {
                if (isContinuousScroll) releaseReadingPlace();
            }}
            tabIndex={-1}
        >
            <EPUBReaderSettings
                readerRef={readerRef}
                makeScrollPos={holdReadingPlace}
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
                    className="zenModePageNumber show"
                    ref={zenProgressRef}
                    style={{
                        backgroundColor: epubReaderSettings.useDefault_progressBackgroundColor
                            ? "var(--body-bg-color)"
                            : epubReaderSettings.progressBackgroundColor,
                        color: epubReaderSettings.useDefault_fontColor
                            ? "currentColor"
                            : epubReaderSettings.fontColor,
                    }}
                >
                    {isContinuousScroll
                        ? formatPublicationPercent(Math.max(0, flushedBookProgressRef.current))
                        : bookProgress}
                    %
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
                                toggleZenMode();
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
                    if (readerRef.current && !isContinuousScroll) {
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
                        if (clickPos > 5 && clickPos < 95) toggleZenMode();
                    }
                }}
            >
                <FootNodeModal
                    footnoteModalData={footnoteModalData}
                    close={() => setFootnoteModalData(null)}
                    onEpubLinkClick={onEpubLinkClick}
                />
                <StyleSheets sheets={epubData?.styleSheets || []} />
                {epubData && isContinuousScroll && currentChapter.index >= 0 && (
                    <div className="epubSpineVirtual" style={{ height: `${spineVirtualizer.getTotalSize()}px` }}>
                        {spineVirtualizer.getVirtualItems().map((virtualItem) => {
                            const spineItem = epubData.spine[virtualItem.index];
                            const chapterTitle = epubData.manifest.get(spineItem.id)?.title;
                            return (
                                <div
                                    key={String(virtualItem.key)}
                                    data-index={virtualItem.index}
                                    ref={spineVirtualizer.measureElement}
                                    className="epubSpineItem"
                                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                                >
                                    {virtualItem.index > 0 && (
                                        <div className="epubChapterBreak">
                                            {chapterTitle ? (
                                                <span className="epubChapterBreakTitle">{chapterTitle}</span>
                                            ) : null}
                                        </div>
                                    )}
                                    <HTMLPart
                                        onEpubLinkClick={onEpubLinkClick}
                                        onHtmlInjected={continuous.onHtmlInjected}
                                        currentChapter={{
                                            id: spineItem.id,
                                            fragment: "",
                                            elementQuery: "",
                                        }}
                                        epubManifest={epubData.manifest}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
                {epubData && !isContinuousScroll && currentChapter.index >= 0 && (
                    <HTMLPart
                        key={`epub${currentChapter.index}`}
                        onEpubLinkClick={onEpubLinkClick}
                        currentChapter={{
                            id: epubData.spine[currentChapter.index].id,
                            fragment: currentChapter.fragment,
                            elementQuery: bookInReader?.progress?.position || "",
                        }}
                        epubManifest={epubData.manifest}
                    />
                )}
            </section>
        </div>
    );
};

export default EPubReader;
