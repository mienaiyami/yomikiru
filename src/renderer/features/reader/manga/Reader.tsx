import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppContext } from "../../../App";
import ReaderSideList from "./ReaderSideList";
import ReaderSettings from "./ReaderSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAppSettings, setReaderSettings } from "@store/appSettings";
import AnilistSearch from "../../anilist/AnilistSearch";
import AnilistEdit from "../../anilist/AnilistEdit";
import { InView } from "react-intersection-observer";

import { addLibraryItem, selectLibraryItem, updateChaptersRead, updateMangaProgress } from "@store/library";
import { formatUtils } from "@utils/file";
import { keyFormatter } from "@utils/keybindings";
import AniList from "@utils/anilist";
import { setAnilistCurrentManga } from "@store/anilist";
import {
    getReaderMangaState,
    setReaderLoading,
    setReaderOpen,
    updateReaderContent,
    updateReaderMangaCurrentPage,
} from "@store/reader";
import { MangaProgress } from "@common/types/db";

const processChapterNumber = (chapterName: string): number | undefined => {
    /*
    possible chapter name formats
    chapter 1123.33as
    chapter 123 asd
    ch. 1
    ch1
    c 1
    c1
    part 1
    pt. 1
    pt1
    episode 1
    ep 1
    ep1
    uploader_ch.1

    support float chapter number
    /(^| |\.|_)((chapter|(c(h)?)|(p(t)?(art)?)|(ep(isode)?))((\s)?(-|_|\.)?(\s)?)?(?<main>\d+(\.\d+)?))/gi;
     */
    const regex = /(^| |\.|_)((chapter|(c(h)?)|(p(t)?(art)?)|(ep(isode)?))((\s)?(-|_|\.)?(\s)?)?(?<main>\d+))/gi;
    const results = [...chapterName.matchAll(regex)];
    if (results.length === 0) return;
    const result = results[0].groups?.main;
    if (!result) return;
    const chapterNumber = parseInt(result);
    if (isNaN(chapterNumber)) return;
    return chapterNumber;
};

const Reader = () => {
    const { pageNumberInputRef, validateDirectory, setContextMenuData } = useAppContext();

    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const isReaderOpen = useAppSelector((store) => store.reader.active);
    const isSettingOpen = useAppSelector((store) => store.ui.isOpen.settings);
    const linkInReader = useAppSelector((store) => store.reader.link);
    const readerState = useAppSelector(getReaderMangaState);
    const anilistCurrentManga = useAppSelector((store) => store.anilist.currentManga);
    const isLoadingManga = useAppSelector((store) => store.reader.loading !== null);
    const bookmarks = useAppSelector((store) => store.bookmarks);

    // todo: extract to hook
    const libraryItem = useAppSelector((store) => selectLibraryItem(store, linkInReader));
    const pageNumChangeDisabled = useAppSelector((store) => store.pageNumChangeDisabled);
    const prevNextChapter = useAppSelector((store) => store.prevNextChapter);
    const isAniSearchOpen = useAppSelector((store) => store.ui.isOpen.anilist.search);
    const isAniEditOpen = useAppSelector((store) => store.ui.isOpen.anilist.edit);

    const dispatch = useAppDispatch();

    const [images, setImages] = useState<string[]>([]);
    const [imageData, setImageData] = useState<
        { index: number; isWide: boolean; img: HTMLCanvasElement | HTMLImageElement | string }[]
    >([]);
    // take element from `imageData` using index
    const [imageRow, setImageRow] = useState<
        {
            wide: boolean;
            /** `i` is index of image from `imageData` */
            i: number[];
        }[]
    >([]);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [isSideListPinned, setSideListPinned] = useState(false);
    const [sideListWidth, setSideListWidth] = useState(appSettings.readerSettings.sideListWidth || 450);
    const [isBookmarked, setBookmarked] = useState(false);
    //not called on scroll but manually
    const [scrollPosPercent, setScrollPosPercent] = useState({ x: 0, y: 0 });
    const [zenMode, setZenMode] = useState(appSettings.openInZenMode || false);
    // used to be in app.tsx then sent to topBar.tsx by context provider but caused performance issue, now using window.currentPageNumber
    const [currentPageNumber, setCurrentPageNumber] = useState(1);
    const [currentImageRow, setCurrentImageRow] = useState(1);

    const [chapterChangerDisplay, setChapterChangerDisplay] = useState(false);
    const [wasMaximized, setWasMaximized] = useState(false);
    // display this text then shortcuts clicked
    const [shortcutText, setshortcutText] = useState("");
    // for grab to scroll
    const [mouseDown, setMouseDown] = useState<null | { top: number; left: number; x: number; y: number }>(null);
    const [updatedAnilistProgress, setUpdatedAnilistProgress] = useState(false);

    const readerSettingExtender = useRef<HTMLButtonElement>(null);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const openPrevChapterRef = useRef<HTMLButtonElement>(null);
    const openNextChapterRef = useRef<HTMLButtonElement>(null);
    const openPrevPageRef = useRef<HTMLButtonElement>(null);
    const openNextPageRef = useRef<HTMLButtonElement>(null);
    const navToPageButtonRef = useRef<HTMLButtonElement>(null);
    const addToBookmarkRef = useRef<HTMLButtonElement>(null);
    const readerRef = useRef<HTMLDivElement>(null);
    const imgContRef = useRef<HTMLDivElement>(null);
    const shortcutTextRef = useRef<HTMLDivElement>(null);

    const scrollReader = (intensity: number) => {
        if (readerRef.current) {
            // let startTime: number
            let prevTime: number;
            const anim = (timeStamp: number) => {
                // if (startTime === undefined) startTime = timeStamp;
                // const elapsed = timeStamp - startTime;
                if (prevTime !== timeStamp && readerRef.current) {
                    if (isSideListPinned && imgContRef.current) {
                        imgContRef.current.scrollBy(0, intensity);
                    } else {
                        readerRef.current.scrollBy(0, intensity);
                    }
                }
                // if (elapsed < window.app.clickDelay) {
                if (window.app.keydown) {
                    prevTime = timeStamp;
                    window.requestAnimationFrame(anim);
                }
            };
            window.requestAnimationFrame(anim);
            return;
        }
    };
    //! check if really needed
    // const pageChangeEvent = new Event("pageNumberChange");

    const scrollToPage = (pageNumber: number, behavior: ScrollBehavior = "smooth", callback?: () => void) => {
        const reader = document.querySelector("#reader");
        if (reader) {
            if (pageNumber >= 1 && pageNumber <= (readerState?.content?.progress?.totalPages || 1)) {
                //! pageNumber no longer in use
                const imgElem = document.querySelector(
                    "#reader .imgCont .readerImg[data-pagenumber='" + pageNumber + "']",
                );
                if ([1, 2].includes(appSettings.readerSettings.readerTypeSelected)) {
                    const rowNumber = parseInt(imgElem?.parentElement?.getAttribute("data-imagerow") || "1");
                    setCurrentImageRow(rowNumber);
                    if (callback) setTimeout(callback, 1500);
                } else {
                    if (imgElem) {
                        imgElem.scrollIntoView({ behavior, block: "start" });
                        if (callback) setTimeout(callback, 1500);
                    }
                }
            }
        }
    };
    window.app.scrollToPage = scrollToPage;
    const [imageDecodeQueue, setImageDecodeQueue] = useState<HTMLImageElement[]>([]);
    const [currentlyDecoding, setCurrentlyDecoding] = useState(false);
    useLayoutEffect(() => {
        if (!currentlyDecoding && imageDecodeQueue.length > 0) {
            setCurrentlyDecoding(true);
            imageDecodeQueue
                .shift()
                ?.decode()
                .then(() => {
                    setCurrentlyDecoding(false);
                })
                .catch((err) => console.error(err));
        }
    }, [currentlyDecoding, imageDecodeQueue]);

    useEffect(() => {
        dispatch(updateReaderMangaCurrentPage(currentPageNumber));
    }, [currentPageNumber]);
    useEffect(() => {
        readerRef.current?.focus();
    }, [isReaderOpen]);
    useEffect(() => {
        if ((zenMode && !window.electron.currentWindow.isMaximized()) || (!zenMode && !wasMaximized)) {
            setTimeout(() => {
                scrollToPage(currentPageNumber, "auto");
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
    /**
     * * readerType === 0 and on first/last page
     * * * sideListPinned => `1`
     * * * not pinned     => `2`
     * * readerType [1,2] => 3
     */
    const prevNextDeciderLogic = () => {
        if (appSettings.readerSettings.readerTypeSelected === 0 && imgContRef.current && readerRef.current) {
            if (isSideListPinned) {
                if (
                    imgContRef.current.scrollTop <= window.innerHeight / 2 ||
                    imgContRef.current.scrollTop >= imgContRef.current.scrollHeight - window.innerHeight * 1.5
                )
                    return 1;
            } else if (
                readerRef.current.scrollTop <= window.innerHeight / 2 ||
                readerRef.current.scrollTop >= readerRef.current.scrollHeight - window.innerHeight * 1.5
            )
                return 2;
        } else if ([1, 2].includes(appSettings.readerSettings.readerTypeSelected)) return 3;
    };
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
        const shortcutsMapped = Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<
            ShortcutCommands,
            string[]
        >;
        const registerShortcuts = (e: KeyboardEvent) => {
            // /&& document.activeElement!.tagName === "BODY"
            window.app.keyRepeated = e.repeat;

            //todo check consequences of using false
            // needed for `escape`
            const keyStr = keyFormatter(e, false);
            if (keyStr === "") return;

            if (
                [" ", "Enter"].includes(e.key) &&
                document.activeElement &&
                document.activeElement.tagName === "BUTTON"
            )
                return;
            const is = (keys: string[]) => {
                return keys.includes(keyStr);
            };
            if (is(shortcutsMapped["contextMenu"])) {
                e.stopPropagation();
                e.preventDefault();
                if (imgContRef.current)
                    imgContRef.current.dispatchEvent(
                        window.contextMenu.fakeEvent(
                            { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                            readerRef.current,
                        ),
                    );
                return;
            }
            if (is(shortcutsMapped["readerSize_50"])) {
                makeScrollPos();
                dispatch(setReaderSettings({ fitOption: 0 }));
                setshortcutText(50 + "%");
                dispatch(setReaderSettings({ readerWidth: 50 }));
                return;
            } else if (is(shortcutsMapped["readerSize_100"])) {
                makeScrollPos();
                dispatch(setReaderSettings({ fitOption: 0 }));
                setshortcutText(100 + "%");
                dispatch(setReaderSettings({ readerWidth: 100 }));
                return;
            } else if (is(shortcutsMapped["readerSize_150"])) {
                makeScrollPos();
                dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                setshortcutText(150 + "%");
                dispatch(setReaderSettings({ readerWidth: 150 }));
                return;
            } else if (is(shortcutsMapped["readerSize_200"])) {
                makeScrollPos();
                dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                setshortcutText(200 + "%");
                dispatch(setReaderSettings({ readerWidth: 200 }));
                return;
            } else if (is(shortcutsMapped["readerSize_250"])) {
                makeScrollPos();
                dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                setshortcutText(250 + "%");
                dispatch(setReaderSettings({ readerWidth: 250 }));
                return;
            }
            // todo, check need to isLoadingManga
            if (!isSettingOpen && isReaderOpen && !isLoadingManga) {
                if ([" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                if (document.activeElement!.tagName === "BODY" || document.activeElement === readerRef.current)
                    switch (true) {
                        case is(shortcutsMapped["nextPage"]): {
                            const abc = prevNextDeciderLogic();
                            if (abc === 1) openNextChapterRef.current?.click();
                            else if (abc === 2) openNextChapterRef.current?.click();
                            else if (abc === 3) {
                                if (appSettings.readerSettings.readerTypeSelected === 1)
                                    openNextPageRef.current?.click();
                                if (appSettings.readerSettings.readerTypeSelected === 2)
                                    openPrevPageRef.current?.click();
                            }
                            break;
                        }

                        case is(shortcutsMapped["prevPage"]): {
                            const abc = prevNextDeciderLogic();
                            if (abc === 1) openPrevChapterRef.current?.click();
                            else if (abc === 2) openPrevChapterRef.current?.click();
                            else if (abc === 3) {
                                if (appSettings.readerSettings.readerTypeSelected === 2)
                                    openNextPageRef.current?.click();
                                if (appSettings.readerSettings.readerTypeSelected === 1)
                                    openPrevPageRef.current?.click();
                            }
                            break;
                        }
                    }
                if (!e.repeat) {
                    switch (true) {
                        case is(shortcutsMapped["navToPage"]):
                            navToPageButtonRef.current?.click();
                            break;
                        case is(shortcutsMapped["toggleZenMode"]):
                            setZenMode((prev) => !prev);
                            break;
                        case e.key === "Escape":
                            setZenMode(false);
                            break;
                        case is(shortcutsMapped["readerSettings"]):
                            readerSettingExtender.current?.click();
                            readerSettingExtender.current?.focus();
                            break;
                        case is(shortcutsMapped["nextChapter"]):
                            openNextChapterRef.current?.click();
                            break;
                        case is(shortcutsMapped["prevChapter"]):
                            openPrevChapterRef.current?.click();
                            break;
                        case is(shortcutsMapped["bookmark"]):
                            addToBookmarkRef.current?.click();
                            break;
                        case is(shortcutsMapped["sizePlus"]):
                            sizePlusRef.current?.click();
                            break;
                        case is(shortcutsMapped["sizeMinus"]):
                            sizeMinusRef.current?.click();
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
                                scrollReader(-appSettings.readerSettings.scrollSpeedB);
                                break;
                            case is(shortcutsMapped["largeScroll"]):
                                scrollReader(appSettings.readerSettings.scrollSpeedB);
                                break;
                            case is(shortcutsMapped["scrollDown"]):
                                scrollReader(appSettings.readerSettings.scrollSpeedA);
                                break;
                            case is(shortcutsMapped["scrollUp"]):
                                scrollReader(0 - appSettings.readerSettings.scrollSpeedA);
                                break;
                            case is(shortcutsMapped["showHidePageNumberInZen"]):
                                setshortcutText(
                                    (!appSettings.readerSettings.showPageNumberInZenMode ? "Show" : "Hide") +
                                        " page-number in Zen Mode",
                                );
                                dispatch(
                                    setReaderSettings({
                                        showPageNumberInZenMode:
                                            !appSettings.readerSettings.showPageNumberInZenMode,
                                    }),
                                );
                                break;
                            case is(shortcutsMapped["cycleFitOptions"]): {
                                let fitOption = appSettings.readerSettings.fitOption + (e.shiftKey ? -1 : 1);
                                if (fitOption < 0) fitOption = 3;
                                fitOption %= 4;
                                if (fitOption === 0) setshortcutText("Free");
                                if (fitOption === 1) setshortcutText("Fit Vertically");
                                if (fitOption === 2) setshortcutText("Fit Horizontally");
                                if (fitOption === 3) setshortcutText("1:1");
                                dispatch(
                                    setReaderSettings({
                                        fitOption: fitOption as 0 | 1 | 2 | 3,
                                    }),
                                );
                                break;
                            }
                            case is(shortcutsMapped["selectReaderMode0"]):
                                setshortcutText("Reading Mode - Vertical Scroll");
                                dispatch(setReaderSettings({ readerTypeSelected: 0 }));
                                break;
                            case is(shortcutsMapped["selectReaderMode1"]):
                                setshortcutText("Reading Mode - Left to Right");
                                dispatch(setReaderSettings({ readerTypeSelected: 1 }));
                                break;
                            case is(shortcutsMapped["selectReaderMode2"]):
                                setshortcutText("Reading Mode - Right to Left");
                                dispatch(setReaderSettings({ readerTypeSelected: 2 }));
                                break;
                            case is(shortcutsMapped["selectPagePerRow1"]):
                                if (appSettings.readerSettings.pagesPerRowSelected !== 0) {
                                    const pagesPerRowSelected = 0;
                                    let readerWidth = appSettings.readerSettings.readerWidth / 2;

                                    if (readerWidth > (appSettings.readerSettings.widthClamped ? 100 : 500))
                                        readerWidth = appSettings.readerSettings.widthClamped ? 100 : 500;
                                    if (readerWidth < 1) readerWidth = 1;
                                    setshortcutText("Page per Row - 1");
                                    dispatch(setReaderSettings({ pagesPerRowSelected, readerWidth }));
                                }
                                break;
                            case is(shortcutsMapped["selectPagePerRow2"]): {
                                const pagesPerRowSelected = 1;
                                let readerWidth = appSettings.readerSettings.readerWidth;
                                if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                                    readerWidth *= 2;
                                    if (readerWidth > (appSettings.readerSettings.widthClamped ? 100 : 500))
                                        readerWidth = appSettings.readerSettings.widthClamped ? 100 : 500;
                                    if (readerWidth < 1) readerWidth = 1;
                                }
                                setshortcutText("Page per Row - 2");
                                dispatch(setReaderSettings({ pagesPerRowSelected, readerWidth }));
                                break;
                            }
                            case is(shortcutsMapped["selectPagePerRow2odd"]): {
                                const pagesPerRowSelected = 2;
                                let readerWidth = appSettings.readerSettings.readerWidth;
                                if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                                    readerWidth *= 2;
                                    if (readerWidth > (appSettings.readerSettings.widthClamped ? 100 : 500))
                                        readerWidth = appSettings.readerSettings.widthClamped ? 100 : 500;
                                    if (readerWidth < 1) readerWidth = 1;
                                }
                                setshortcutText("Page per Row - 2odd");
                                dispatch(setReaderSettings({ pagesPerRowSelected, readerWidth }));
                                break;
                            }
                            default:
                                break;
                        }
                    }
                }
            }
        };
        window.addEventListener("wheel", wheelFunction);
        window.addEventListener("keydown", registerShortcuts);
        const onKeyUp = () => {
            window.app.keydown = false;
        };
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("wheel", wheelFunction);
            window.removeEventListener("keydown", registerShortcuts);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [isSideListPinned, appSettings, shortcuts, isLoadingManga, isSettingOpen, isReaderOpen]);

    const makeScrollPos = useCallback(() => {
        if (isSideListPinned && imgContRef.current)
            return setScrollPosPercent({
                x: imgContRef.current.scrollLeft / imgContRef.current.scrollWidth,
                y: imgContRef.current.scrollTop / imgContRef.current.scrollHeight,
            });
        if (readerRef.current)
            setScrollPosPercent({
                x: readerRef.current.scrollLeft / readerRef.current.scrollWidth,
                y: readerRef.current.scrollTop / readerRef.current.scrollHeight,
            });
    }, [isSideListPinned, imgContRef.current, readerRef.current]);

    const changePageNumber = () => {
        if (!pageNumChangeDisabled && imgContRef.current) {
            const elem = document.elementFromPoint(
                imgContRef.current.clientWidth / 2 + imgContRef.current.offsetLeft,
                window.innerHeight / (appSettings.readerSettings.readerTypeSelected === 0 ? 4 : 2),
            );
            if (elem && (elem.tagName === "IMG" || elem.tagName === "CANVAS")) {
                const pageNumber = parseInt(elem.getAttribute("data-pagenumber") || "1");
                setCurrentPageNumber(pageNumber);
                const rowNumber = parseInt(elem.parentElement?.getAttribute("data-imagerow") || "1");
                setCurrentImageRow(rowNumber);
            }
        }
    };

    const openPrevPage = () => {
        if (currentImageRow <= 1) {
            // if (prevNextChapter.prev === "~") return;
            if (
                chapterChangerDisplay &&
                (!window.app.keydown || (window.app.keydown && !window.app.keyRepeated))
            ) {
                return openPrevChapterRef.current?.click();
            }
            setChapterChangerDisplay(true);
            return;
        }
        if (chapterChangerDisplay) return setChapterChangerDisplay(false);
        setCurrentImageRow((init) => init - 1);
        if (readerRef.current) readerRef.current.scrollTop = 0;
    };
    const openNextPage = () => {
        if (currentImageRow >= imageRow.length) {
            // if (prevNextChapter.next === "~") return;
            if (
                chapterChangerDisplay &&
                (!window.app.keydown || (window.app.keydown && !window.app.keyRepeated))
            ) {
                return openNextChapterRef.current?.click();
            }
            setChapterChangerDisplay(true);
            return;
        }
        if (chapterChangerDisplay) return setChapterChangerDisplay(false);
        setCurrentImageRow((init) => init + 1);
        if (readerRef.current) readerRef.current.scrollTop = 0;
    };
    /**
     * Check if directory `link` have images or not.
     * If any image is found then load images otherwise keep linkInReader same as before.
     * @param link Local link of folder containing images.
     * @example
     * "D://manga/chapter/"
     */
    const checkForImgsAndLoad = (options: { link: string; page: number }) => {
        if (window.cachedImageList?.link === options.link && window.cachedImageList.images) {
            // console.log("using cached image list for " + link);
            loadImgs(options.link, window.cachedImageList.images);

            setCurrentPageNumber(options.page || 1);
            window.cachedImageList = { link: "", images: [] };
            return;
        }
        validateDirectory(options.link).then((result) => {
            if (result.isValid && result.images) {
                loadImgs(options.link, result.images);
            }
        });
    };
    const loadImgs = async (link: string, imgs: string[]) => {
        link = window.path.normalize(link);
        if (link[link.length - 1] === window.path.sep) link = link.substring(0, link.length - 1);
        //mark, reset
        setImages([]);
        setCurrentPageNumber(1);
        if (pageNumberInputRef.current) pageNumberInputRef.current.value = "1";
        setCurrentImageRow(1);
        setImagesLoaded(0);
        setImageData([]);
        setImageRow([]);
        setImageDecodeQueue([]);
        setUpdatedAnilistProgress(false);
        setCurrentlyDecoding(false);
        setChapterChangerDisplay(false);
        const linkSplitted = link.split(window.path.sep).filter((e) => e !== "");

        //todo test
        const progress: MangaProgress = {
            chapterLink: link,
            currentPage: readerState?.mangaPageNumber || 1,
            lastReadAt: new Date(),
            chapterName: linkSplitted.at(-1) || "",
            itemLink: window.path.dirname(link),
            totalPages: imgs.length,
            chaptersRead: [],
        };
        if (libraryItem && libraryItem.type === "manga") {
            dispatch(
                updateReaderContent({
                    ...libraryItem,
                    progress,
                }),
            );
            dispatch(updateMangaProgress(progress));
        } else {
            const mangaOpened = {
                title: linkSplitted[linkSplitted.length - 2],
                type: "manga",
                author: null,
                cover: imgs[0],
                createdAt: new Date(),
                updatedAt: new Date(),
                link: window.path.dirname(link),
            } as const;
            dispatch(
                addLibraryItem({
                    type: "manga",
                    data: mangaOpened,
                    progress: {
                        chapterLink: link,
                        currentPage: 1,
                        totalPages: imgs.length,
                        chapterName: linkSplitted.at(-1) || "",
                    },
                }),
            );
        }
        setImages(imgs);
        dispatch(setReaderOpen());
    };
    useLayoutEffect(() => {
        // window.electron.webFrame.clearCache();
        const dynamic = appSettings.readerSettings.dynamicLoading;
        images.forEach((imgURL, i) => {
            const img = document.createElement("img");
            let imageSafeURL = "file://" + imgURL.replaceAll("#", "%23");
            const loaded = (success = false) => {
                setImagesLoaded((init) => init + 1);
                setImageData((init) => [
                    ...init,
                    {
                        img: imageSafeURL,
                        index: i,
                        isWide: success ? img.height / img.width <= 1.2 : false,
                    },
                ]);
            };
            if (appSettings.useCanvasBasedReader) {
                const canvas = document.createElement("canvas");
                canvas.setAttribute("draggable", "false");
                canvas.setAttribute("src", imgURL);
                canvas.setAttribute("data-pagenumber", JSON.stringify(i + 1));
                canvas.classList.add("readerImg");
                const ctx = canvas.getContext("2d");

                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx?.drawImage(img, 0, 0);
                    setImagesLoaded((init) => init + 1);
                    setImageData((init) => [
                        ...init,
                        {
                            img: canvas,
                            index: i,
                            isWide: img.height / img.width <= 1.2,
                        },
                    ]);
                };
                const onError = () => {
                    if (!ctx) return;
                    canvas.width = 500;
                    canvas.height = 100;
                    ctx.fillStyle = window.getComputedStyle(document.body).color || "black";
                    ctx.fillText("Error occurred while loading image.", 10, 10);
                    setImagesLoaded((init) => init + 1);
                    setImageData((init) => [...init, { img: canvas, index: i, isWide: false }]);
                };
                img.onerror = () => {
                    onError();
                };
                img.onabort = () => {
                    onError();
                };
            } else if (!dynamic) {
                img.setAttribute("draggable", "false");
                img.setAttribute("data-pagenumber", JSON.stringify(i + 1));
                img.classList.add("readerImg");

                img.onload = (e) => {
                    setImageDecodeQueue((init) => {
                        return [...init, img];
                    });
                    loaded(true);
                };
                img.onerror = () => {
                    loaded();
                };
                img.onabort = () => {
                    loaded();
                };
            }
            const load = () => {
                if (dynamic) {
                    loaded(true);
                } else {
                    // todo check if its better to convert to base64 here instead of in loadImgs
                    img.src = imageSafeURL;
                }
            };
            if (imgURL.length < 256) {
                load();
            } else {
                window.fs
                    .readFile(imgURL, "base64")
                    .then((data) => {
                        imageSafeURL = `data:image/${window.path.extname(imgURL).substring(1)};base64,${data}`;
                        load();
                    })
                    .catch(console.error);
            }
        });
    }, [images]);
    useEffect(() => {
        //todo use just src for image and canvas, add canvas using element outside
        appSettings.useCanvasBasedReader &&
            [...document.querySelector("section.imgCont")!.children].forEach((e, i) => {
                imageRow[i].i.forEach((canvasIndex) => {
                    const elem = imageData[canvasIndex].img;
                    if (elem instanceof HTMLElement) e.appendChild(elem);
                });
            });
    }, [imageRow]);
    useLayoutEffect(() => {
        if (images.length > 0 && images.length === imageData.length) {
            imageData.sort((a, b) => a.index - b.index);
            const tempImageRow: typeof imageRow = [];
            const wideImageEnabled =
                appSettings.readerSettings.pagesPerRowSelected !== 0 ||
                appSettings.readerSettings.variableImageSize;
            for (let index = 0; index < imageData.length; index++) {
                if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                    tempImageRow.push({
                        i: [index],
                        wide: wideImageEnabled && imageData[index].isWide,
                    });
                    continue;
                }
                if (wideImageEnabled && imageData[index].isWide) {
                    tempImageRow.push({
                        i: [index],
                        wide: true,
                    });
                    continue;
                }
                if (
                    (appSettings.readerSettings.pagesPerRowSelected === 2 && index === 0) ||
                    index === images.length - 1 ||
                    (wideImageEnabled && imageData[index + 1].isWide)
                ) {
                    tempImageRow.push({
                        i: [index],
                        wide: false,
                    });
                    continue;
                }
                tempImageRow.push({ wide: false, i: [index, index + 1] });
                index++;
            }
            setImageRow(tempImageRow);
        }
    }, [
        imageData,
        appSettings.readerSettings.pagesPerRowSelected,
        appSettings.readerSettings.readerTypeSelected,
        appSettings.readerSettings.variableImageSize,
    ]);
    useEffect(() => {
        // if (appSettings.readerSettings.readerTypeSelected === 0)
        setTimeout(() => scrollToPage(currentPageNumber, "auto"), 100);
        // scrollToPage(currentPageNumber, "auto");
    }, [
        appSettings.readerSettings.readerTypeSelected,
        appSettings.readerSettings.fitOption,
        appSettings.readerSettings.pagesPerRowSelected,
    ]);
    useEffect(() => {
        if (imagesLoaded !== 0 && images.length !== 0) {
            dispatch(setReaderLoading({ percent: (100 * imagesLoaded) / images.length }));
            if (images.length === imagesLoaded) dispatch(setReaderLoading(null));
        }
    }, [imagesLoaded]);
    useLayoutEffect(() => {
        readerRef.current?.scrollTo(
            scrollPosPercent.x * readerRef.current.scrollWidth,
            scrollPosPercent.y * readerRef.current.scrollHeight,
        );
        imgContRef.current?.scrollTo(
            scrollPosPercent.x * imgContRef.current.scrollWidth,
            scrollPosPercent.y * imgContRef.current.scrollHeight,
        );
    }, [appSettings.readerSettings.readerWidth, isSideListPinned]);
    useEffect(() => {
        if (!readerState?.link) return;
        checkForImgsAndLoad({
            link: readerState.link,
            page: readerState.mangaPageNumber || 1,
        });
    }, [readerState?.link]);
    useEffect(() => {
        if (!isLoadingManga) {
            setTimeout(() => {
                scrollToPage(currentPageNumber, "auto");
            }, 50);
        }
    }, [isLoadingManga]);
    useLayoutEffect(() => {
        if (isSideListPinned) {
            readerRef.current?.scrollTo(
                scrollPosPercent.x * readerRef.current.scrollWidth,
                scrollPosPercent.y * readerRef.current.scrollHeight,
            );
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
        // anilist auto update progress
        if (updatedAnilistProgress || !appSettings.readerSettings.autoUpdateAnilistProgress) return;
        if (currentPageNumber / images.length > (images.length <= 4 ? 0.5 : 0.7)) {
            if (!anilistCurrentManga || !readerState?.content?.progress) {
                // console.error("anilistCurrentManga is null, this should not happen");
                return;
            }
            const chapterNumber = processChapterNumber(readerState?.content?.progress?.chapterName);
            if (!chapterNumber) {
                console.log("Anilist::autoUpdateAnilistProgress: Could not get chapter number from the title.");
                return;
            }
            dispatch(
                updateChaptersRead({
                    itemLink: readerState?.content?.progress?.itemLink,
                    chapterName: readerState?.content?.progress?.chapterName,
                    read: true,
                }),
            );
            setUpdatedAnilistProgress(true);
            if (chapterNumber > anilistCurrentManga.progress)
                AniList.setCurrentMangaProgress(chapterNumber).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentManga(e));
                        console.log("Anilist::autoUpdateAnilistProgress: updated progress", chapterNumber);
                    } else {
                        console.error("Anilist::autoUpdateAnilistProgress: Failed to sync AniList progress.");
                        // dialogUtils.customError({ message: "Failed to sync AniList progress.", log: false });
                    }
                });
        }
    }, [currentPageNumber, appSettings.readerSettings.autoUpdateAnilistProgress]);
    useLayoutEffect(() => {
        changePageNumber();
    }, [currentImageRow]);

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

    const ChapterChanger = () => (
        <div
            className={
                "chapterChangerScreen " +
                ([1, 2].includes(appSettings.readerSettings.readerTypeSelected) ? "readerMode1n2 " : "")
            }
            style={{
                display:
                    (appSettings.readerSettings.readerTypeSelected === 0 &&
                        !isSideListPinned &&
                        !appSettings.readerSettings.disableChapterTransitionScreen) ||
                    (appSettings.readerSettings.readerTypeSelected !== 0 && chapterChangerDisplay)
                        ? "grid"
                        : "none",
            }}
            onClick={(e) => {
                const abc = prevNextDeciderLogic();
                if (abc === 1) {
                    const clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                    if (clickPos <= 40) openPrevChapterRef.current?.click();
                    if (clickPos > 60) openNextChapterRef.current?.click();
                } else if (abc === 2) {
                    const clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                    if (clickPos <= 40) openPrevChapterRef.current?.click();
                    if (clickPos > 60) openNextChapterRef.current?.click();
                } else if (abc === 3) {
                    const clickPos =
                        ((e.clientX - (isSideListPinned ? sideListWidth : 0)) / e.currentTarget.offsetWidth) * 100;

                    if (appSettings.readerSettings.readerTypeSelected === 1) {
                        if (clickPos <= 40) openPrevPageRef.current?.click();
                        if (clickPos > 60) openNextPageRef.current?.click();
                    }
                    if (appSettings.readerSettings.readerTypeSelected === 2) {
                        if (clickPos <= 40) openNextPageRef.current?.click();
                        if (clickPos > 60) openPrevPageRef.current?.click();
                    }
                }
            }}
        >
            <div className="wrapper">
                <div
                    className="a"
                    style={{
                        display:
                            currentImageRow <= 1 || appSettings.readerSettings.readerTypeSelected === 0
                                ? "flex"
                                : "none",
                    }}
                >
                    <span
                        className="a"
                        data-tooltip={
                            `press "${shortcuts.find((e) => e.command === "prevPage")?.keys}"` +
                            ` or click left side of screen`
                        }
                    >
                        Previous :{/* <FontAwesomeIcon icon={faQuestionCircle} />: */}
                    </span>
                    <span className="b">
                        {window.path.basename(
                            prevNextChapter.prev,
                            formatUtils.files.getExt(prevNextChapter.prev),
                        )}
                        {formatUtils.files.test(prevNextChapter.prev) && (
                            <code>{formatUtils.files.getExt(prevNextChapter.prev)}</code>
                        )}
                    </span>
                </div>
                <div className="c">
                    <span className="a">Current :</span>
                    <span className="b">
                        {window.path.basename(readerState?.content?.progress?.chapterName || "")}
                        {formatUtils.files.test(readerState?.content?.progress?.chapterName || "") && (
                            <code>
                                {formatUtils.files.getExt(readerState?.content?.progress?.chapterName || "")}
                            </code>
                        )}
                    </span>
                </div>
                <div
                    className="b"
                    style={{
                        display:
                            currentImageRow >= imageRow.length ||
                            appSettings.readerSettings.readerTypeSelected === 0
                                ? "flex"
                                : "none",
                    }}
                >
                    <span
                        className="a"
                        data-tooltip={
                            `press "${shortcuts.find((e) => e.command === "nextPage")?.keys}"` +
                            ` or click right side of screen`
                        }
                    >
                        Next :{/* <FontAwesomeIcon icon={faQuestionCircle} />: */}
                    </span>
                    <span className="b">
                        {window.path.basename(
                            prevNextChapter.next,
                            formatUtils.files.getExt(prevNextChapter.next),
                        )}
                        {formatUtils.files.test(prevNextChapter.next) && (
                            <code>{formatUtils.files.getExt(prevNextChapter.next)}</code>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
    return (
        <div
            ref={readerRef}
            id="reader"
            className={
                (isSideListPinned ? "sideListPinned " : "") +
                "reader " +
                (zenMode && appSettings.hideCursorInZenMode ? "noCursor " : mouseDown ? "grabCursor" : "") +
                ((readerRef.current?.offsetHeight || 0) >= (imgContRef.current?.scrollHeight || 0)
                    ? "noOverflow "
                    : "")
            }
            style={{
                gridTemplateColumns: sideListWidth + "px auto",

                display: isReaderOpen ? (isSideListPinned ? "grid" : "block") : "none",
                "--sideListWidth": sideListWidth + "px",
            }}
            onScroll={() => {
                if (appSettings.readerSettings.readerTypeSelected === 0 && !isSideListPinned) changePageNumber();
            }}
            tabIndex={-1}
        >
            <ReaderSettings
                readerRef={readerRef}
                makeScrollPos={makeScrollPos}
                readerSettingExtender={readerSettingExtender}
                sizePlusRef={sizePlusRef}
                sizeMinusRef={sizeMinusRef}
                setshortcutText={setshortcutText}
            />
            <ReaderSideList
                openNextChapterRef={openNextChapterRef}
                openPrevChapterRef={openPrevChapterRef}
                addToBookmarkRef={addToBookmarkRef}
                setshortcutText={setshortcutText}
                isBookmarked={isBookmarked}
                setBookmarked={setBookmarked}
                isSideListPinned={isSideListPinned}
                setSideListPinned={setSideListPinned}
                setSideListWidth={setSideListWidth}
                makeScrollPos={makeScrollPos}
            />

            {isAniSearchOpen && <AnilistSearch />}
            {isAniEditOpen && <AnilistEdit />}
            <div className="hiddenPageMover" style={{ display: "none" }}>
                <button ref={openPrevPageRef} onClick={openPrevPage}>
                    Prev
                </button>
                <button ref={openNextPageRef} onClick={openNextPage}>
                    Next
                </button>
                <button ref={navToPageButtonRef} onClick={() => pageNumberInputRef.current?.focus()}>
                    Nav to page number
                </button>
            </div>
            {appSettings.readerSettings.showPageNumberInZenMode && (
                <div className={"zenModePageNumber " + "show"}>
                    {currentPageNumber}/{readerState?.content?.progress?.totalPages}
                </div>
            )}
            <ChapterChanger />

            <div className="shortcutClicked faded" ref={shortcutTextRef}>
                {shortcutText}
            </div>
            {appSettings.readerSettings.forceLowBrightness.enabled && (
                <div
                    className="forcedLowBrightness"
                    style={{ "--neg-brightness": appSettings.readerSettings.forceLowBrightness.value }}
                ></div>
            )}
            <section
                ref={imgContRef}
                className={
                    "imgCont " +
                    (appSettings.readerSettings.gapBetweenRows ? "gap " : "") +
                    ([1, 2].includes(appSettings.readerSettings.readerTypeSelected) ? "readerMode1n2 " : "") +
                    (["", "fitVertically ", "fitHorizontally ", "original "].at(
                        appSettings.readerSettings.fitOption,
                    ) ?? "") +
                    (appSettings.readerSettings.customColorFilter.enabled ? "customColorFilter " : "") +
                    (appSettings.readerSettings.invertImage ? "invertImage " : "") +
                    (appSettings.readerSettings.grayscale ? "grayscale " : "")
                }
                style={{
                    "--varWidth": appSettings.readerSettings.readerWidth + "%",
                    "--gapSize": appSettings.readerSettings.gapSize + "px",
                    display:
                        !chapterChangerDisplay || appSettings.readerSettings.readerTypeSelected === 0
                            ? "flex"
                            : "none",
                    "--blend-bg": `rgba(${appSettings.readerSettings.customColorFilter.r},${appSettings.readerSettings.customColorFilter.g},${appSettings.readerSettings.customColorFilter.b},${appSettings.readerSettings.customColorFilter.a})`,
                    "--blend-mode": appSettings.readerSettings.customColorFilter.blendMode,
                    "--hue": appSettings.readerSettings.customColorFilter.hue,
                    "--saturation": appSettings.readerSettings.customColorFilter.saturation + 1,
                    "--brightness": appSettings.readerSettings.customColorFilter.brightness + 1,
                    "--contrast": appSettings.readerSettings.customColorFilter.contrast + 1,
                }}
                onWheel={(e) => {
                    if (e.ctrlKey) return;
                    if ([1, 2].includes(appSettings.readerSettings.readerTypeSelected))
                        if (isSideListPinned && imgContRef.current)
                            if (imgContRef.current.offsetHeight === imgContRef.current.scrollHeight) {
                                if (e.nativeEvent.deltaY > 0 && currentImageRow !== imageRow.length)
                                    openNextPage();
                                if (e.nativeEvent.deltaY < 0 && currentImageRow !== 1) openPrevPage();
                            }
                    if (!isSideListPinned && readerRef.current)
                        if (readerRef.current.offsetHeight === readerRef.current.scrollHeight) {
                            if (e.nativeEvent.deltaY > 0 && currentImageRow !== imageRow.length) openNextPage();
                            if (e.nativeEvent.deltaY < 0 && currentImageRow !== 1) openPrevPage();
                        }
                }}
                onScroll={() => {
                    if (appSettings.readerSettings.readerTypeSelected === 0 && isSideListPinned)
                        changePageNumber();
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
                        window.contextMenu.template.divider(),
                        {
                            label: "Bookmark",
                            disabled: false,
                            action() {
                                addToBookmarkRef.current?.click();
                            },
                        },
                        window.contextMenu.template.divider(),
                    ];
                    if (e.target instanceof HTMLElement) {
                        let src = e.target.getAttribute("src");
                        if (!src || src?.startsWith("data:") || src?.startsWith("file"))
                            src = e.target.getAttribute("data-src") || src;
                        if (src)
                            items.push(
                                window.contextMenu.template.copyImage(src),
                                window.contextMenu.template.copyPath(src),
                                window.contextMenu.template.showInExplorer(src),
                            );
                        else
                            items.push(
                                window.contextMenu.template.copyPath(linkInReader),
                                window.contextMenu.template.showInExplorer(linkInReader),
                                window.contextMenu.template.openInNewWindow(linkInReader),
                            );
                    }
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        items,
                        padLeft: true,
                    });
                }}
                onDoubleClick={(e) => {
                    const abc = prevNextDeciderLogic();
                    // first/last page
                    if (abc || appSettings.readerSettings.readerTypeSelected !== 0) {
                        const clickPos =
                            ((e.clientX - (isSideListPinned ? sideListWidth : 0)) / e.currentTarget.offsetWidth) *
                            100;
                        if ((abc === 1 || abc === 2) && clickPos > 20 && clickPos < 80)
                            setZenMode((prev) => !prev);
                        else if (clickPos > 40 && clickPos < 60) setZenMode((prev) => !prev);
                    } else {
                        // const clickPos =
                        //     ((e.clientX - (isSideListPinned ? sideListWidth : 0)) / e.currentTarget.offsetWidth) *
                        //     100;
                        // if (clickPos > 20 && clickPos < 80)
                        setZenMode((prev) => !prev);
                    }
                }}
                onClick={(e) => {
                    setMouseDown(null);
                    if (mouseDown && mouseDown.x !== e.clientX && mouseDown.y !== e.clientY) return;
                    const abc = prevNextDeciderLogic();
                    if (abc === 1) {
                        const clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                        if (clickPos <= 20) openPrevChapterRef.current?.click();
                        if (clickPos > 80) openNextChapterRef.current?.click();
                    } else if (abc === 2) {
                        const clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                        if (clickPos <= 20) openPrevChapterRef.current?.click();
                        if (clickPos > 80) openNextChapterRef.current?.click();
                    } else if (abc === 3) {
                        const clickPos =
                            ((e.clientX - (isSideListPinned ? sideListWidth : 0)) / e.currentTarget.offsetWidth) *
                            100;
                        if (appSettings.readerSettings.readerTypeSelected === 1) {
                            if (clickPos <= 40) openPrevPageRef.current?.click();
                            if (clickPos > 60) openNextPageRef.current?.click();
                        }
                        if (appSettings.readerSettings.readerTypeSelected === 2) {
                            if (clickPos <= 40) openNextPageRef.current?.click();
                            if (clickPos > 60) openPrevPageRef.current?.click();
                        }
                    }
                }}
                onMouseDown={(e) => {
                    if (e.button === 0 && readerRef.current && imgContRef.current)
                        setMouseDown({
                            left: (isSideListPinned ? imgContRef.current : readerRef.current).scrollLeft,
                            top: (isSideListPinned ? imgContRef.current : readerRef.current).scrollTop,
                            x: e.clientX,
                            y: e.clientY,
                        });
                }}
                // onMouseUp={() => {
                //     setMouseDown(null);
                // }}
                onMouseLeave={() => {
                    setMouseDown(null);
                }}
                onMouseMove={(e) => {
                    if (mouseDown) {
                        const elem = isSideListPinned ? imgContRef.current : readerRef.current;
                        if (elem) {
                            elem.scrollLeft =
                                mouseDown.left -
                                (e.clientX - mouseDown.x) * appSettings.readerSettings.touchScrollMultiplier;
                            elem.scrollTop =
                                mouseDown.top -
                                (e.clientY - mouseDown.y) * appSettings.readerSettings.touchScrollMultiplier;
                        }
                    }
                }}
            >
                {imageRow.map((e, i) => {
                    const props = {
                        className:
                            "row " +
                            (appSettings.readerSettings.readingSide === 1 ? "rtl " : "ltr ") +
                            (e.wide ? "wide " : "") +
                            (appSettings.readerSettings.pagesPerRowSelected !== 0 ? "twoPagePerRow " : "") +
                            (appSettings.readerSettings.widthClamped ? "widthClamped " : ""),
                        "data-imagerow": i + 1,
                        style: {
                            display: [1, 2].includes(appSettings.readerSettings.readerTypeSelected)
                                ? currentImageRow === i + 1
                                    ? "flex"
                                    : "none"
                                : "flex",
                            "--max-width":
                                appSettings.readerSettings.maxHeightWidthSelector === "width" &&
                                !appSettings.readerSettings.widthClamped
                                    ? appSettings.readerSettings.maxWidth + "px"
                                    : "500%",
                            "--max-height":
                                appSettings.readerSettings.maxHeightWidthSelector === "height" &&
                                !appSettings.readerSettings.widthClamped
                                    ? appSettings.readerSettings.maxHeight + "px"
                                    : "auto",
                        },
                        key: i,
                    };
                    if (appSettings.readerSettings.dynamicLoading)
                        return (
                            <InView
                                as="div"
                                initialInView={false}
                                onChange={(inView, entry) => {
                                    const load = () => {
                                        entry.target.querySelectorAll("img").forEach((e) => {
                                            (entry.target as HTMLElement).style.height = "auto";
                                            const src = e.getAttribute("data-load-src");
                                            if (src) e.src = src;
                                        });
                                        entry.target.setAttribute("data-rendered", "true");
                                    };
                                    const rendered = entry.target.getAttribute("data-rendered");
                                    if (rendered) return;
                                    if (inView) load();
                                    // unloading image does not free ram
                                }}
                                {...props}
                            >
                                {e.i.map(
                                    (e) =>
                                        typeof imageData[e]?.img === "string" && (
                                            <img
                                                className="readerImg"
                                                draggable={false}
                                                data-pagenumber={imageData[e]?.index + 1}
                                                loading="lazy"
                                                data-load-src={imageData[e].img}
                                                data-src={images[e]}
                                                key={imageData[e].img as string}
                                            />
                                        ),
                                )}
                            </InView>
                        );
                    return (
                        <div {...props}>
                            {e.i.map(
                                (e) =>
                                    typeof imageData[e]?.img === "string" && (
                                        <img
                                            className="readerImg"
                                            draggable={false}
                                            data-pagenumber={imageData[e].index + 1}
                                            src={imageData[e].img as string}
                                            // data-src is real file path
                                            data-src={images[e]}
                                            key={imageData[e].img as string}
                                        />
                                    ),
                            )}
                        </div>
                    );
                })}
            </section>
            {appSettings.readerSettings.readerTypeSelected === 0 ? <ChapterChanger /> : ""}
        </div>
    );
};

export default Reader;
