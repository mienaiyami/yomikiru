import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import ReaderSideList from "./ReaderSideList";
import ReaderSettings from "./ReaderSettings";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setReaderSettings } from "../store/appSettings";
import { setMangaInReader } from "../store/mangaInReader";
import { setReaderOpen } from "../store/isReaderOpen";
import { setLoadingMangaPercent } from "../store/loadingMangaPercent";
import { setLoadingManga } from "../store/isLoadingManga";
import { setLinkInReader } from "../store/linkInReader";
import { newHistory } from "../store/history";
import AnilistSearch from "./anilist/AnilistSearch";
import AnilistEdit from "./anilist/AnilistEdit";

const Reader = () => {
    const { pageNumberInputRef, checkValidFolder, setContextMenuData } = useContext(AppContext);

    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const isReaderOpen = useAppSelector((store) => store.isReaderOpen);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);
    const isLoadingManga = useAppSelector((store) => store.isLoadingManga);
    const isSettingOpen = useAppSelector((store) => store.isSettingOpen);
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const pageNumChangeDisabled = useAppSelector((store) => store.pageNumChangeDisabled);
    const prevNextChapter = useAppSelector((store) => store.prevNextChapter);
    const isAniSearchOpen = useAppSelector((store) => store.isAniSearchOpen);
    const isAniEditOpen = useAppSelector((store) => store.isAniEditOpen);

    const dispatch = useAppDispatch();

    const [images, setImages] = useState<string[]>([]);
    const [imageWidthContainer, setImageWidthContainer] = useState<
        { index: number; isWide: boolean; img: HTMLCanvasElement | HTMLImageElement }[]
    >([]);
    // take element from `imageWidthContainer` using index
    const [imageElementsIndex, setImageElementsIndex] = useState<number[][]>([]);
    const [wideImageContMap, setWideImageContMap] = useState<number[]>([]);
    const [imageRowCount, setImageRowCount] = useState(0);
    const [imagesLength, setImagesLength] = useState(0);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [isSideListPinned, setSideListPinned] = useState(false);
    const [sideListWidth, setSideListWidth] = useState(appSettings.readerSettings.sideListWidth || 450);
    const [isBookmarked, setBookmarked] = useState(false);
    const [scrollPosPercent, setScrollPosPercent] = useState(0);
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
    const pageChangeEvent = new Event("pageNumberChange");

    const scrollToPage = (pageNumber: number, behavior: ScrollBehavior = "smooth", callback?: () => void) => {
        const reader = document.querySelector("#reader");
        if (reader) {
            if (pageNumber >= 1 && pageNumber <= (mangaInReader?.pages || 1)) {
                //! pageNumber no longer in use
                const imgElem = document.querySelector(
                    "#reader .imgCont .readerImg[data-pagenumber='" + pageNumber + "']"
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
                .then((e) => {
                    setCurrentlyDecoding(false);
                })
                .catch((err) => console.error(err));
        }
    }, [currentlyDecoding, imageDecodeQueue]);

    useLayoutEffect(() => {
        window.app.currentPageNumber = currentPageNumber;
        // too heavy
        // setHistory((init) => {
        //     if (init[0].link === linkInReader.link) {
        //         init[0].page = currentPageNumber;
        //         return [...init];
        //     }
        //     return init;
        // });
        window.dispatchEvent(pageChangeEvent);
    }, [currentPageNumber]);
    useEffect(() => {
        readerRef.current?.focus();
    }, [isReaderOpen]);
    useEffect(() => {
        if ((zenMode && !window.electron.getCurrentWindow().isMaximized()) || (!zenMode && !wasMaximized)) {
            setTimeout(() => {
                scrollToPage(currentPageNumber, "auto");
            }, 100);
        }
        if (zenMode) {
            setSideListPinned(false);
            setWasMaximized(window.electron.getCurrentWindow().isMaximized());
            document.body.classList.add("zenMode");
            window.electron.getCurrentWindow().setFullScreen(true);
        } else {
            document.body.classList.remove("zenMode");
            setWasMaximized(false);
            if (window.electron.getCurrentWindow().isFullScreen())
                window.electron.getCurrentWindow().setFullScreen(false);
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

        const shortcutkey: { [e in ShortcutCommands]?: { key1: string; key2: string } } = {};
        shortcuts.forEach((e) => {
            shortcutkey[e.command] = { key1: e.key1, key2: e.key2 };
        });
        const registerShortcuts = (e: KeyboardEvent) => {
            // /&& document.activeElement!.tagName === "BODY"
            window.app.keyRepeated = e.repeat;
            if (
                [" ", "Enter"].includes(e.key) &&
                document.activeElement &&
                document.activeElement.tagName === "BUTTON"
            )
                return;
            if ((e.ctrlKey && e.key === "/") || (e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
                e.stopPropagation();
                e.preventDefault();
                if (imgContRef.current)
                    imgContRef.current.dispatchEvent(
                        window.contextMenu.fakeEvent(
                            { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                            readerRef.current
                        )
                    );
                return;
            }
            if (e.ctrlKey) {
                if (parseInt(e.key) >= 1 && parseInt(e.key) <= 5) makeScrollPos();
                if (e.key === "1") {
                    dispatch(setReaderSettings({ fitOption: 0 }));
                    setshortcutText(50 + "%");
                    dispatch(setReaderSettings({ readerWidth: 50 }));
                    return;
                } else if (e.key === "2") {
                    dispatch(setReaderSettings({ fitOption: 0 }));
                    setshortcutText(100 + "%");
                    dispatch(setReaderSettings({ readerWidth: 100 }));
                    return;
                } else if (e.key === "3") {
                    dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                    setshortcutText(150 + "%");
                    dispatch(setReaderSettings({ readerWidth: 150 }));
                    return;
                } else if (e.key === "4") {
                    dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                    setshortcutText(200 + "%");
                    dispatch(setReaderSettings({ readerWidth: 200 }));
                    return;
                } else if (e.key === "5") {
                    dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                    setshortcutText(250 + "%");
                    dispatch(setReaderSettings({ readerWidth: 250 }));
                    return;
                }
            }
            if (!isSettingOpen && window.app.isReaderOpen && !isLoadingManga && !e.ctrlKey) {
                if ([" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                if (document.activeElement!.tagName === "BODY" || document.activeElement === readerRef.current)
                    switch (e.key) {
                        case shortcutkey.nextPage?.key1:
                        case shortcutkey.nextPage?.key2: {
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

                        case shortcutkey.prevPage?.key1:
                        case shortcutkey.prevPage?.key2: {
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
                    switch (e.key) {
                        case shortcutkey.navToPage?.key1:
                        case shortcutkey.navToPage?.key2:
                            navToPageButtonRef.current?.click();
                            break;
                        case shortcutkey.toggleZenMode?.key1:
                        case shortcutkey.toggleZenMode?.key2:
                            setZenMode((prev) => !prev);
                            break;
                        case "Escape":
                            setZenMode(false);
                            break;
                        case shortcutkey.readerSettings?.key1:
                        case shortcutkey.readerSettings?.key2:
                            readerSettingExtender.current?.click();
                            readerSettingExtender.current?.focus();
                            break;
                        case shortcutkey.nextChapter?.key1:
                        case shortcutkey.nextChapter?.key2:
                            openNextChapterRef.current?.click();
                            break;
                        case shortcutkey.prevChapter?.key1:
                        case shortcutkey.prevChapter?.key2:
                            openPrevChapterRef.current?.click();
                            break;
                        case shortcutkey.bookmark?.key1:
                        case shortcutkey.bookmark?.key2:
                            addToBookmarkRef.current?.click();
                            break;
                        case shortcutkey.sizePlus?.key1:
                        case shortcutkey.sizePlus?.key2:
                            sizePlusRef.current?.click();
                            break;
                        case shortcutkey.sizeMinus?.key1:
                        case shortcutkey.sizeMinus?.key2:
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
                        if (
                            e.shiftKey &&
                            (e.key === shortcutkey.largeScroll?.key1 || e.key === shortcutkey.largeScroll?.key2)
                        ) {
                            scrollReader(0 - appSettings.readerSettings.scrollSpeedB);
                            return;
                        }
                        switch (e.key) {
                            case shortcutkey.largeScroll?.key1:
                            case shortcutkey.largeScroll?.key2:
                                scrollReader(appSettings.readerSettings.scrollSpeedB);

                                break;
                            case shortcutkey.scrollDown?.key1:
                            case shortcutkey.scrollDown?.key2:
                                scrollReader(appSettings.readerSettings.scrollSpeedA);
                                break;
                            case shortcutkey.scrollUp?.key1:
                            case shortcutkey.scrollUp?.key2:
                                scrollReader(0 - appSettings.readerSettings.scrollSpeedA);
                                break;
                            case shortcutkey.showHidePageNumberInZen?.key1:
                            case shortcutkey.showHidePageNumberInZen?.key2:
                                setshortcutText(
                                    (!appSettings.readerSettings.showPageNumberInZenMode ? "Show" : "Hide") +
                                        " page-number in Zen Mode"
                                );
                                dispatch(
                                    setReaderSettings({
                                        showPageNumberInZenMode:
                                            !appSettings.readerSettings.showPageNumberInZenMode,
                                    })
                                );
                                break;
                            case shortcutkey.cycleFitOptions?.key1:
                            case shortcutkey.cycleFitOptions?.key2: {
                                const fitOption = (
                                    appSettings.readerSettings.fitOption + 1 === 4
                                        ? 0
                                        : appSettings.readerSettings.fitOption + 1
                                ) as 0 | 2 | 1 | 3 | undefined;
                                if (fitOption === 0) setshortcutText("Free");
                                if (fitOption === 1) setshortcutText("Fit Vertically");
                                if (fitOption === 2) setshortcutText("Fit Horizontally");
                                if (fitOption === 3) setshortcutText("1:1");
                                dispatch(
                                    setReaderSettings({
                                        fitOption,
                                    })
                                );
                                // todo: display current mode in middle of screen and fade

                                // dispatch(
                                //     setAppSettings((init) => {
                                //         init.readerSettings.fitOption += 1;
                                //         if (init.readerSettings.fitOption === 4) init.readerSettings.fitOption = 0;
                                //         return { ...init };
                                //     })
                                // );
                                break;
                            }
                            case shortcutkey.selectReaderMode0?.key1:
                            case shortcutkey.selectReaderMode0?.key2:
                                setshortcutText("Reading Mode - Vertical Scroll");
                                dispatch(setReaderSettings({ readerTypeSelected: 0 }));
                                break;
                            case shortcutkey.selectReaderMode1?.key1:
                            case shortcutkey.selectReaderMode1?.key2:
                                setshortcutText("Reading Mode - Left to Right");
                                dispatch(setReaderSettings({ readerTypeSelected: 1 }));
                                break;
                            case shortcutkey.selectReaderMode2?.key1:
                            case shortcutkey.selectReaderMode2?.key2:
                                setshortcutText("Reading Mode - Right to Left");
                                dispatch(setReaderSettings({ readerTypeSelected: 2 }));
                                break;
                            case shortcutkey.selectPagePerRow1?.key1:
                            case shortcutkey.selectPagePerRow1?.key2:
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
                            case shortcutkey.selectPagePerRow2?.key1:
                            case shortcutkey.selectPagePerRow2?.key2: {
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
                            case shortcutkey.selectPagePerRow2odd?.key1:
                            case shortcutkey.selectPagePerRow2odd?.key2: {
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
    }, [isSideListPinned, appSettings, shortcuts, isLoadingManga, isSettingOpen]);
    const makeScrollPos = useCallback(() => {
        if (isSideListPinned && imgContRef.current)
            return setScrollPosPercent(imgContRef.current.scrollTop / imgContRef.current.scrollHeight);
        if (readerRef.current) setScrollPosPercent(readerRef.current.scrollTop / readerRef.current.scrollHeight);
    }, [isSideListPinned, imgContRef.current, readerRef.current]);
    const changePageNumber = () => {
        if (!pageNumChangeDisabled) {
            const elem = document.elementFromPoint(
                imgContRef.current!.clientWidth / 2 + imgContRef.current!.offsetLeft,
                window.innerHeight / (appSettings.readerSettings.readerTypeSelected === 0 ? 4 : 2)
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
        if (currentImageRow >= imageRowCount) {
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
    const checkForImgsAndLoad = (readerStuff: { link: string; page: number }) => {
        if (window.cachedImageList?.link === readerStuff.link && window.cachedImageList.images) {
            // console.log("using cached image list for " + link);
            loadImgs(readerStuff.link, window.cachedImageList.images);

            setCurrentPageNumber(readerStuff.page || 1);
            window.cachedImageList = { link: "", images: [] };
            return;
        }
        checkValidFolder(
            readerStuff.link,
            (isValid, imgs) => {
                if (isValid && imgs) {
                    setCurrentPageNumber(readerStuff.page || 1);
                    return loadImgs(readerStuff.link, imgs);
                }
                dispatch(
                    setLinkInReader({ type: "image", link: mangaInReader?.link || "", page: 1, chapter: "" })
                );
            },
            true
        );
    };
    const loadImgs = (link: string, imgs: string[]) => {
        link = window.path.normalize(link);
        if (link[link.length - 1] === window.path.sep) link = link.substring(0, link.length - 1);
        setImages([]);
        setWideImageContMap([]);
        setCurrentPageNumber(1);
        if (pageNumberInputRef.current) pageNumberInputRef.current.value = "1";
        setCurrentImageRow(1);
        setImagesLength(0);
        setImagesLoaded(0);
        setImageWidthContainer([]);
        setImageElementsIndex([]);
        setImageRowCount(0);
        setImageDecodeQueue([]);
        setCurrentlyDecoding(false);
        setBookmarked(bookmarks.map((e) => e.data.link).includes(link));
        setChapterChangerDisplay(false);
        const linksplitted = link.split(window.path.sep).filter((e) => e !== "");
        const mangaOpened: MangaItem = {
            mangaName: linksplitted[linksplitted.length - 2],
            chapterName: linksplitted[linksplitted.length - 1],
            link,
            date: new Date().toLocaleString("en-UK", { hour12: true }),
            pages: imgs.length,
        };
        dispatch(setMangaInReader(mangaOpened));
        dispatch(
            newHistory({
                type: "image",
                data: {
                    mangaOpened,
                    page: linkInReader.page,
                    recordChapter: appSettings.recordChapterRead,
                },
            })
        );
        setImagesLength(imgs.length);
        setImages(imgs);
        dispatch(setReaderOpen(true));
    };
    useLayoutEffect(() => {
        // window.electron.webFrame.clearCache();
        images.forEach((e, i) => {
            const img = document.createElement("img");

            const dynamic = true;

            const loaded = (success = false) => {
                setImagesLoaded((init) => init + 1);
                setImageWidthContainer((init) => [
                    ...init,
                    { img, index: i, isWide: success ? img.height / img.width <= 1.2 : false },
                ]);
            };
            if (appSettings.useCanvasBasedReader) {
                const canvas = document.createElement("canvas");
                canvas.setAttribute("draggable", "false");
                canvas.setAttribute("data-pagenumber", JSON.stringify(i + 1));
                canvas.classList.add("readerImg");
                canvas.oncontextmenu = (ev) => {
                    ev.stopPropagation();
                    setContextMenuData({
                        clickX: ev.clientX,
                        clickY: ev.clientY,
                        items: [
                            {
                                label: "Toggle Zen Mode",
                                disabled: false,
                                action() {
                                    setZenMode((init) => !init);
                                },
                            },
                            {
                                label: "Bookmark",
                                disabled: false,
                                action() {
                                    addToBookmarkRef.current?.click();
                                },
                            },
                            window.contextMenu.template.copyImage(e),
                            window.contextMenu.template.showInExplorer(e),
                            window.contextMenu.template.copyPath(e),
                        ],
                    });
                    // showContextMenu({
                    //     isImg: true,
                    //     e: ev,
                    //     link: e,
                    // });
                };
                const ctx = canvas.getContext("2d");

                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx?.drawImage(img, 0, 0);
                    setImagesLoaded((init) => init + 1);
                    setImageWidthContainer((init) => [
                        ...init,
                        {
                            img: canvas,
                            index: i,
                            isWide: img.height / img.width <= 1.2,
                        },
                    ]);
                };
                img.onerror = () => {
                    canvas.width = 500;
                    canvas.height = 100;
                    ctx?.fillText("Error occured while loading image.", 10, 10);
                    setImagesLoaded((init) => init + 1);
                    setImageWidthContainer((init) => [...init, { img: canvas, index: i, isWide: false }]);
                };
                img.onabort = () => {
                    canvas.width = 500;
                    canvas.height = 100;
                    ctx?.fillText("Loading of image aborted.", 10, 10);
                    setImagesLoaded((init) => init + 1);
                    setImageWidthContainer((init) => [...init, { img: canvas, index: i, isWide: false }]);
                };
            } else {
                img.setAttribute("draggable", "false");
                img.setAttribute("data-pagenumber", JSON.stringify(i + 1));
                if (dynamic) {
                    img.loading = "lazy";
                    img.height = window.innerHeight;
                    img.width = window.innerHeight / 1.5;
                }
                img.classList.add("readerImg");
                img.oncontextmenu = (ev) => {
                    ev.stopPropagation();
                    setContextMenuData({
                        clickX: ev.clientX,
                        clickY: ev.clientY,
                        items: [
                            {
                                label: "Toggle Zen Mode",
                                disabled: false,
                                action() {
                                    setZenMode((init) => !init);
                                },
                            },
                            {
                                label: "Bookmark",
                                disabled: false,
                                action() {
                                    addToBookmarkRef.current?.click();
                                },
                            },
                            window.contextMenu.template.copyImage(e),
                            window.contextMenu.template.showInExplorer(e),
                            window.contextMenu.template.copyPath(e),
                        ],
                    });
                    // showContextMenu({
                    //     isImg: true,
                    //     e: ev,
                    //     link: e,
                    // });
                };

                img.onload = (e) => {
                    if (dynamic) {
                        (e.target as HTMLImageElement).removeAttribute("height");
                        (e.target as HTMLImageElement).removeAttribute("width");
                    } else {
                        setImageDecodeQueue((init) => {
                            init.push(img);
                            return [...init];
                        });
                        loaded(true);
                    }
                };
                img.onerror = () => {
                    !dynamic && loaded();
                };
                img.onabort = () => {
                    !dynamic && loaded();
                };
            }
            if (dynamic) {
                img.setAttribute("data-src", "file://" + e.replaceAll("#", "%23"));
                dynamic && loaded(true);
            } else {
                img.src = "file://" + e.replaceAll("#", "%23");
            }
        });
    }, [images]);
    useEffect(() => {
        [...document.querySelector("section.imgCont")!.children].forEach((e, i) => {
            imageElementsIndex[i].forEach((canvasIndex) => {
                const elem = imageWidthContainer[canvasIndex].img;
                if (elem instanceof HTMLCanvasElement) e.appendChild(elem as HTMLElement);
                else {
                    const src = elem.getAttribute("data-src");
                    e.appendChild(elem);
                    if (src) elem.src = src;
                }
            });
        });
    }, [imageElementsIndex]);
    useLayoutEffect(() => {
        if (imagesLength > 0 && imagesLength === imageWidthContainer.length) {
            imageWidthContainer.sort((a, b) => a.index - b.index);
            const tempImageElements: number[][] = [];
            const tempWideImageContMap: number[] = [];
            const wideImageEnabled =
                appSettings.readerSettings.pagesPerRowSelected !== 0 ||
                appSettings.readerSettings.variableImageSize;
            // if(appSettings.readerSettings.pagesPerRowSelected === 0)
            for (let index = 0; index < imageWidthContainer.length; index++) {
                //! is there any meaning to this bs
                if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                    tempImageElements.push([index]);
                    if (wideImageEnabled && imageWidthContainer[index].isWide)
                        // todo : can `.length` be replace with `index`
                        tempWideImageContMap.push(tempImageElements.length - 1);
                    continue;
                }
                if (wideImageEnabled && imageWidthContainer[index].isWide) {
                    tempImageElements.push([index]);
                    tempWideImageContMap.push(tempImageElements.length - 1);
                    continue;
                }
                if (appSettings.readerSettings.pagesPerRowSelected === 2 && index === 0) {
                    tempImageElements.push([index]);
                    continue;
                }
                if (index === images.length - 1) {
                    tempImageElements.push([index]);
                    continue;
                }
                if (wideImageEnabled && imageWidthContainer[index + 1].isWide) {
                    tempImageElements.push([index]);
                    continue;
                }
                tempImageElements.push([index, index + 1]);
                index++;
            }
            setImageElementsIndex(tempImageElements);
            setImageRowCount(tempImageElements.length);
            setWideImageContMap(tempWideImageContMap);
        }
    }, [
        imageWidthContainer,
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
        if (imagesLoaded !== 0 && imagesLength !== 0) {
            dispatch(setLoadingMangaPercent((100 * imagesLoaded) / imagesLength));
            if (imagesLength === imagesLoaded) {
                dispatch(setLoadingManga(false));
                // console.log(currentPageNumber);
                // setFirstScrolled(true);
                // scrollToPage(currentPageNumber, "auto");
                // setTimeout(() => {
                //     scrollToPage(currentPageNumber, "auto");
                // }, 3000);
            }
        }
    }, [imagesLoaded]);
    useLayoutEffect(() => {
        readerRef.current?.scrollTo(0, scrollPosPercent * readerRef.current.scrollHeight);
        imgContRef.current?.scrollTo(0, scrollPosPercent * imgContRef.current.scrollHeight);
    }, [appSettings.readerSettings.readerWidth, isSideListPinned]);
    useEffect(() => {
        window.app.linkInReader = linkInReader;
        if (linkInReader && linkInReader.link !== "") {
            if (mangaInReader && mangaInReader.link === linkInReader.link) return;
            checkForImgsAndLoad(linkInReader);
        }
    }, [linkInReader]);
    useEffect(() => {
        if (!isLoadingManga) {
            setTimeout(() => {
                scrollToPage(currentPageNumber, "auto");
            }, 50);
        }
    }, [isLoadingManga]);
    useLayoutEffect(() => {
        if (isSideListPinned) {
            readerRef.current?.scrollTo(0, scrollPosPercent * readerRef.current.scrollHeight);
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
            className="chapterChangerScreen"
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

                // const clickPos =
                //     ((e.clientX - (isSideListPinned ? sideListWidth : 0)) / e.currentTarget.offsetWidth) * 100;
                // if (appSettings.readerSettings.readerTypeSelected === 0) {
                //     if (clickPos <= 40) openPrevChapterRef.current?.click();
                //     if (clickPos > 60) openNextChapterRef.current?.click();
                // } else {
                //     if (clickPos <= 40) openPrevPageRef.current?.click();
                //     if (clickPos > 60) openNextPageRef.current?.click();
                // }
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
                            `press "${shortcuts.find((e) => e.command === "prevPage")?.key1}"` +
                            `${
                                shortcuts.find((e) => e.command === "prevPage")?.key2 === ""
                                    ? ""
                                    : ` or "${shortcuts.find((e) => e.command === "prevPage")?.key2}"`
                            }` +
                            ` or click left side of screen`
                        }
                    >
                        Previous :{/* <FontAwesomeIcon icon={faQuestionCircle} />: */}
                    </span>
                    <span className="b">
                        {
                            window.app
                                .replaceExtension(prevNextChapter.prev.split(window.path.sep).pop() || "")
                                .split(" $")[0]
                        }
                        {window.app.isSupportedFormat(
                            window.app.replaceExtension(prevNextChapter.prev.split(window.path.sep).pop() || "")
                        ) && (
                            <code>
                                {
                                    window.app
                                        .replaceExtension(prevNextChapter.prev.split(window.path.sep).pop() || "")
                                        .split(" $")[1]
                                }
                            </code>
                        )}
                    </span>
                </div>
                <div className="c">
                    <span className="a">Current :</span>
                    <span className="b">
                        {window.app.replaceExtension(mangaInReader?.chapterName || "").split(" $")[0]}
                        {window.app.isSupportedFormat(
                            window.app.replaceExtension(mangaInReader?.chapterName || "")
                        ) && (
                            <code>
                                {window.app.replaceExtension(mangaInReader?.chapterName || "").split(" $")[1]}
                            </code>
                        )}
                    </span>
                </div>
                <div
                    className="b"
                    style={{
                        display:
                            currentImageRow >= imageRowCount || appSettings.readerSettings.readerTypeSelected === 0
                                ? "flex"
                                : "none",
                    }}
                >
                    <span
                        className="a"
                        data-tooltip={
                            `press "${shortcuts.find((e) => e.command === "nextPage")?.key1}"` +
                            `${
                                shortcuts.find((e) => e.command === "nextPage")?.key2 === ""
                                    ? ""
                                    : ` or "${shortcuts.find((e) => e.command === "nextPage")?.key2}"`
                            }` +
                            ` or click right side of screen`
                        }
                    >
                        Next :{/* <FontAwesomeIcon icon={faQuestionCircle} />: */}
                    </span>
                    <span className="b">
                        {
                            window.app
                                .replaceExtension(prevNextChapter.next.split(window.path.sep).pop() || "")
                                .split(" $")[0]
                        }
                        {window.app.isSupportedFormat(
                            window.app.replaceExtension(prevNextChapter.next.split(window.path.sep).pop() || "")
                        ) && (
                            <code>
                                {
                                    window.app
                                        .replaceExtension(prevNextChapter.next.split(window.path.sep).pop() || "")
                                        .split(" $")[1]
                                }
                            </code>
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
                    {currentPageNumber}/{mangaInReader?.pages}
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
                        appSettings.readerSettings.fitOption
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
                }}
                onWheel={(e) => {
                    if (e.ctrlKey) return;
                    if ([1, 2].includes(appSettings.readerSettings.readerTypeSelected))
                        if (isSideListPinned && imgContRef.current)
                            if (imgContRef.current.offsetHeight === imgContRef.current.scrollHeight) {
                                if (e.nativeEvent.deltaY > 0 && currentImageRow !== imageRowCount) openNextPage();
                                if (e.nativeEvent.deltaY < 0 && currentImageRow !== 1) openPrevPage();
                            }
                    if (!isSideListPinned && readerRef.current)
                        if (readerRef.current.offsetHeight === readerRef.current.scrollHeight) {
                            if (e.nativeEvent.deltaY > 0 && currentImageRow !== imageRowCount) openNextPage();
                            if (e.nativeEvent.deltaY < 0 && currentImageRow !== 1) openPrevPage();
                        }
                }}
                onScroll={() => {
                    if (appSettings.readerSettings.readerTypeSelected === 0 && isSideListPinned)
                        changePageNumber();
                }}
                onContextMenu={(e) => {
                    e.stopPropagation();
                    const items = [
                        {
                            label: "Toggle Zen Mode",
                            disabled: false,
                            action() {
                                setZenMode((init) => !init);
                            },
                        },
                        {
                            label: "Bookmark",
                            disabled: false,
                            action() {
                                addToBookmarkRef.current?.click();
                            },
                        },
                        window.contextMenu.template.openInNewWindow(linkInReader.link),
                        window.contextMenu.template.showInExplorer(linkInReader.link),
                        window.contextMenu.template.copyPath(linkInReader.link),
                    ];
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        items,
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
                            elem.scrollLeft = mouseDown.left - (e.clientX - mouseDown.x);
                            elem.scrollTop = mouseDown.top - (e.clientY - mouseDown.y);
                        }
                    }
                }}
            >
                {imageElementsIndex.map((e, i) => (
                    <div
                        className={
                            "row " +
                            (appSettings.readerSettings.readingSide === 1 ? "rtl " : "ltr ") +
                            (wideImageContMap.includes(i) ? "wide " : "") +
                            (appSettings.readerSettings.pagesPerRowSelected !== 0 ? "twoPagePerRow " : "") +
                            (appSettings.readerSettings.widthClamped ? "widthClamped " : "")
                        }
                        data-imagerow={i + 1}
                        style={{
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
                        }}
                        key={i}
                    ></div>
                ))}
            </section>
            {appSettings.readerSettings.readerTypeSelected === 0 ? <ChapterChanger /> : ""}
        </div>
    );
};

export default Reader;
