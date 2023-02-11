import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import ReaderSideList from "./ReaderSideList";
import { MainContext } from "./Main";
import ReaderSettings from "./ReaderSettings";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";

const Reader = () => {
    const {
        appSettings,
        shortcuts,
        setAppSettings,
        isReaderOpen,
        setReaderOpen,
        pageNumberInputRef,
        linkInReader,
        setLinkInReader,
        mangaInReader,
        setMangaInReader,
        isLoadingManga,
        setLoadingManga,
        setHistory,
        prevNextChapter,
        bookmarks,
        setLoadingMangaPercent,
        pageNumChangeDisabled,
        checkValidFolder,
    } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
    const [images, setImages] = useState<string[]>([]);
    const [imageWidthContainer, setImageWidthContainer] = useState<{ index: number; isWide: boolean }[]>([]);
    const [imageElements, setImageElements] = useState<JSX.Element[][]>([]);
    const [wideImageContMap, setWideImageContMap] = useState<number[]>([]);
    const [imageRowCount, setImageRowCount] = useState(0);
    const [imagesLength, setImagesLength] = useState(0);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [isSideListPinned, setSideListPinned] = useState(false);
    const [sideListWidth, setSideListWidth] = useState(appSettings.readerSettings.sideListWidth || 450);
    const [isBookmarked, setBookmarked] = useState(false);
    const [scrollPosPercent, setScrollPosPercent] = useState(0);
    const [zenMode, setZenMode] = useState(false);
    // used to be in app.tsx then sent to topBar.tsx by context provider but caused performance issue, now using window.currentPageNumber
    const [currentPageNumber, setCurrentPageNumber] = useState(1);
    const [currentImageRow, setCurrentImageRow] = useState(1);
    const [chapterChangerDisplay, setChapterChangerDisplay] = useState(false);

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

    const scrollReader = (intensity: number) => {
        if (readerRef.current) {
            let startTime: number, prevTime: number;
            const anim = (timeStamp: number) => {
                if (startTime === undefined) startTime = timeStamp;
                const elapsed = timeStamp - startTime;
                if (prevTime !== timeStamp && readerRef.current) {
                    if (isSideListPinned && imgContRef.current) {
                        imgContRef.current.scrollBy(0, intensity);
                    } else {
                        readerRef.current.scrollBy(0, intensity);
                    }
                }
                if (elapsed < window.app.clickDelay) {
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
                    "#reader .imgCont img[data-pagenumber='" + pageNumber + "']"
                );
                if (appSettings.readerSettings.readerTypeSelected === 1) {
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
        scrollToPage(currentPageNumber, "auto");
        if (zenMode) {
            setSideListPinned(false);
            document.body.classList.add("zenMode");
            document.body.requestFullscreen();
        } else {
            document.body.classList.remove("zenMode");
            if (document.fullscreenElement) document.exitFullscreen();
        }
    }, [zenMode]);
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
        } else if (appSettings.readerSettings.readerTypeSelected === 1) return 3;
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
        window.addEventListener("wheel", wheelFunction);

        const shortcutkey: { [e in ShortcutCommands]?: { key1: string; key2: string } } = {};
        shortcuts.forEach((e) => {
            shortcutkey[e.command] = { key1: e.key1, key2: e.key2 };
        });
        const registerShortcuts = (e: KeyboardEvent) => {
            // /&& document.activeElement!.tagName === "BODY"
            window.app.keyRepeated = e.repeat;
            if (window.app.isReaderOpen && !isLoadingManga) {
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
                        if (!e.repeat) openNextChapterRef.current?.click();
                        break;
                    case shortcutkey.prevChapter?.key1:
                    case shortcutkey.prevChapter?.key2:
                        if (!e.repeat) openPrevChapterRef.current?.click();
                        break;
                    case shortcutkey.bookmark?.key1:
                    case shortcutkey.bookmark?.key2:
                        if (!e.repeat) addToBookmarkRef.current?.click();
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
                if (document.activeElement!.tagName === "BODY" || document.activeElement === readerRef.current) {
                    window.app.keydown = true;
                    if (
                        e.shiftKey &&
                        (e.key === shortcutkey.largeScroll?.key1 || e.key === shortcutkey.largeScroll?.key2)
                    ) {
                        e.preventDefault();
                        scrollReader(0 - appSettings.readerSettings.largeScrollMultiplier);
                        return;
                    }
                    switch (e.key) {
                        case shortcutkey.largeScroll?.key1:
                        case shortcutkey.largeScroll?.key2:
                            e.preventDefault();
                            scrollReader(appSettings.readerSettings.largeScrollMultiplier);
                            break;
                        case shortcutkey.nextPage?.key1:
                        case shortcutkey.nextPage?.key2: {
                            const abc = prevNextDeciderLogic();
                            if (abc === 1) openNextChapterRef.current?.click();
                            else if (abc === 2) openNextChapterRef.current?.click();
                            else if (abc === 3) openNextPageRef.current?.click();
                            break;
                        }
                        case shortcutkey.scrollDown?.key1:
                        case shortcutkey.scrollDown?.key2:
                            scrollReader(appSettings.readerSettings.scrollSpeed);
                            break;
                        case shortcutkey.prevPage?.key1:
                        case shortcutkey.prevPage?.key2: {
                            const abc = prevNextDeciderLogic();
                            if (abc === 1) openPrevChapterRef.current?.click();
                            else if (abc === 2) openPrevChapterRef.current?.click();
                            else if (abc === 3) openPrevPageRef.current?.click();
                            break;
                        }
                        case shortcutkey.scrollUp?.key1:
                        case shortcutkey.scrollUp?.key2:
                            scrollReader(0 - appSettings.readerSettings.scrollSpeed);
                            break;
                        case shortcutkey.showHidePageNumberInZen?.key1:
                        case shortcutkey.showHidePageNumberInZen?.key2:
                            setAppSettings((init) => {
                                init.readerSettings.showPageNumberInZenMode =
                                    !init.readerSettings.showPageNumberInZenMode;
                                return { ...init };
                            });
                            break;
                        case shortcutkey.toggleFitVertically?.key1:
                        case shortcutkey.toggleFitVertically?.key2:
                            setAppSettings((init) => {
                                init.readerSettings.fitVertically = !init.readerSettings.fitVertically;
                                return { ...init };
                            });
                            break;
                        case shortcutkey.selectReaderMode0?.key1:
                        case shortcutkey.selectReaderMode0?.key2:
                            setAppSettings((init) => {
                                init.readerSettings.readerTypeSelected = 0;
                                return { ...init };
                            });
                            break;
                        case shortcutkey.selectReaderMode1?.key1:
                        case shortcutkey.selectReaderMode1?.key2:
                            setAppSettings((init) => {
                                init.readerSettings.readerTypeSelected = 1;
                                return { ...init };
                            });
                            break;
                        case shortcutkey.selectPagePerRow1?.key1:
                        case shortcutkey.selectPagePerRow1?.key2:
                            if (appSettings.readerSettings.pagesPerRowSelected !== 0) {
                                setAppSettings((init) => {
                                    init.readerSettings.pagesPerRowSelected = 0;

                                    init.readerSettings.readerWidth /= 2;
                                    if (
                                        init.readerSettings.readerWidth >
                                        (appSettings.readerSettings.widthClamped ? 100 : 500)
                                    )
                                        init.readerSettings.readerWidth = appSettings.readerSettings.widthClamped
                                            ? 100
                                            : 500;
                                    if (init.readerSettings.readerWidth < 1) init.readerSettings.readerWidth = 1;

                                    return { ...init };
                                });
                            }
                            break;
                        case shortcutkey.selectPagePerRow2?.key1:
                        case shortcutkey.selectPagePerRow2?.key2:
                            setAppSettings((init) => {
                                if (init.readerSettings.pagesPerRowSelected === 0) {
                                    init.readerSettings.readerWidth *= 2;
                                    if (
                                        init.readerSettings.readerWidth >
                                        (appSettings.readerSettings.widthClamped ? 100 : 500)
                                    )
                                        init.readerSettings.readerWidth = appSettings.readerSettings.widthClamped
                                            ? 100
                                            : 500;
                                    if (init.readerSettings.readerWidth < 1) init.readerSettings.readerWidth = 1;
                                }

                                init.readerSettings.pagesPerRowSelected = 1;

                                return { ...init };
                            });
                            break;
                        case shortcutkey.selectPagePerRow2odd?.key1:
                        case shortcutkey.selectPagePerRow2odd?.key2:
                            setAppSettings((init) => {
                                if (init.readerSettings.pagesPerRowSelected === 0) {
                                    init.readerSettings.readerWidth *= 2;
                                    if (
                                        init.readerSettings.readerWidth >
                                        (appSettings.readerSettings.widthClamped ? 100 : 500)
                                    )
                                        init.readerSettings.readerWidth = appSettings.readerSettings.widthClamped
                                            ? 100
                                            : 500;
                                    if (init.readerSettings.readerWidth < 1) init.readerSettings.readerWidth = 1;
                                }

                                init.readerSettings.pagesPerRowSelected = 2;

                                return { ...init };
                            });
                            break;
                        default:
                            break;
                    }
                }
            }
        };
        window.addEventListener("keydown", registerShortcuts);
        window.addEventListener("keyup", () => {
            window.app.keydown = false;
        });
        return () => {
            window.removeEventListener("wheel", wheelFunction);
            window.removeEventListener("keydown", registerShortcuts);
            window.removeEventListener("keyup", () => {
                window.app.keydown = false;
            });
        };
    }, [isSideListPinned, appSettings, shortcuts, isLoadingManga]);
    const makeScrollPos = () => {
        if (isSideListPinned && imgContRef.current)
            return setScrollPosPercent(imgContRef.current.scrollTop / imgContRef.current.scrollHeight);
        if (readerRef.current) setScrollPosPercent(readerRef.current.scrollTop / readerRef.current.scrollHeight);
    };
    const changePageNumber = () => {
        if (!pageNumChangeDisabled) {
            const elem = document.elementFromPoint(
                imgContRef.current!.clientWidth / 2 + imgContRef.current!.offsetLeft,
                window.innerHeight / (appSettings.readerSettings.readerTypeSelected === 0 ? 4 : 2)
            );
            if (elem && elem.tagName === "IMG") {
                const pageNumber = parseInt(elem.getAttribute("data-pagenumber") || "1");
                setCurrentPageNumber(pageNumber);
                const rowNumber = parseInt(elem.parentElement?.getAttribute("data-imagerow") || "1");
                setCurrentImageRow(rowNumber);
            }
        }
    };

    const openPrevPage = () => {
        if (currentImageRow <= 1) {
            if (prevNextChapter.next === "~") return;
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
            if (prevNextChapter.next === "~") return;
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
            loadImg(readerStuff.link, window.cachedImageList.images);

            setCurrentPageNumber(readerStuff.page || 1);
            window.cachedImageList = { link: "", images: [] };
            return;
        }
        checkValidFolder(
            readerStuff.link,
            (isValid, imgs) => {
                if (isValid && imgs) {
                    setCurrentPageNumber(readerStuff.page || 1);
                    return loadImg(readerStuff.link, imgs);
                }
                setLinkInReader({ link: mangaInReader?.link || "", page: 1 });
            },
            true
        );
    };
    const loadImg = (link: string, imgs: string[]) => {
        link = window.path.normalize(link);
        setImages([]);
        setWideImageContMap([]);
        setCurrentPageNumber(1);
        setCurrentImageRow(1);
        setImagesLength(0);
        setImagesLoaded(0);
        setImageWidthContainer([]);
        setImageElements([]);
        setImageRowCount(0);
        setBookmarked(bookmarks.map((e) => e.link).includes(link));
        setChapterChangerDisplay(false);
        const linksplitted = link.split(window.path.sep);
        const mangaOpened: ListItem = {
            mangaName: linksplitted[linksplitted.length - 2],
            chapterName: linksplitted[linksplitted.length - 1],
            link,
            date: new Date().toLocaleString("en-UK", { hour12: true }),
            pages: imgs.length,
        };
        setMangaInReader(mangaOpened);
        setHistory((init) => {
            if (init.length > 0 && init[0].link === mangaOpened.link) {
                init.shift();
            }
            init.unshift({ ...mangaOpened, page: linkInReader.page });
            if (init.length >= appSettings.historyLimit) {
                init.length = appSettings.historyLimit;
            }
            return [...init];
        });
        setImagesLength(imgs.length);
        setImages(imgs);
        setReaderOpen(true);
    };
    //!! check if below code is really needed or not
    useLayoutEffect(() => {
        window.electron.webFrame.clearCache();
        images.forEach((e, i) => {
            const img = document.createElement("img");
            img.src = e;

            img.onload = () => {
                setImageWidthContainer((init) => [...init, { index: i, isWide: img.height / img.width <= 1.2 }]);
                setImagesLoaded((init) => init + 1);
            };
            img.onerror = () => {
                setImageWidthContainer((init) => [...init, { index: i, isWide: false }]);
                setImagesLoaded((init) => init + 1);
            };
            img.onabort = () => {
                setImageWidthContainer((init) => [...init, { index: i, isWide: false }]);
                setImagesLoaded((init) => init + 1);
            };
        });
    }, [images]);
    useLayoutEffect(() => {
        if (images.length > 0 && images.length === imageWidthContainer.length) {
            imageWidthContainer.sort((a, b) => a.index - b.index);
            const tempImageElements = [];
            const tempWideImageContMap: number[] = [];
            const Image = ({ imgLink, index }: { imgLink: string; index: number }) => (
                <img
                    src={imgLink}
                    onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.decode().catch((e) => console.error(e));
                    }}
                    draggable={false}
                    data-pagenumber={index + 1}
                    onContextMenu={(ev) => {
                        showContextMenu({
                            isImg: true,
                            e: ev.nativeEvent,
                            link: imgLink,
                        });
                    }}
                    // title={name}
                    // key={name}
                ></img>
            );
            const wideImageEnabled =
                appSettings.readerSettings.pagesPerRowSelected !== 0 ||
                appSettings.readerSettings.variableImageSize;
            // if(appSettings.readerSettings.pagesPerRowSelected === 0)
            for (let index = 0; index < images.length; index++) {
                if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                    tempImageElements.push([<Image imgLink={images[index]} index={index} key={images[index]} />]);
                    if (wideImageEnabled && imageWidthContainer[index].isWide)
                        tempWideImageContMap.push(tempImageElements.length - 1);
                    continue;
                }
                if (wideImageEnabled && imageWidthContainer[index].isWide) {
                    tempImageElements.push([<Image imgLink={images[index]} index={index} key={images[index]} />]);
                    tempWideImageContMap.push(tempImageElements.length - 1);
                    continue;
                }
                if (appSettings.readerSettings.pagesPerRowSelected === 2 && index === 0) {
                    tempImageElements.push([<Image imgLink={images[index]} index={index} key={images[index]} />]);
                    continue;
                }
                if (index === images.length - 1) {
                    tempImageElements.push([<Image imgLink={images[index]} index={index} key={images[index]} />]);
                    continue;
                }
                if (wideImageEnabled && imageWidthContainer[index + 1].isWide) {
                    tempImageElements.push([<Image imgLink={images[index]} index={index} key={images[index]} />]);
                    continue;
                }
                tempImageElements.push([
                    <Image imgLink={images[index]} index={index} key={images[index]} />,
                    <Image imgLink={images[index + 1]} index={index + 1} key={images[index + 1]} />,
                ]);
                index++;
            }
            setImageElements(tempImageElements);
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
        appSettings.readerSettings.fitVertically,
        appSettings.readerSettings.pagesPerRowSelected,
    ]);
    useEffect(() => {
        if (imagesLoaded !== 0 && imagesLength !== 0) {
            setLoadingMangaPercent((100 * imagesLoaded) / imagesLength);
            if (imagesLength === imagesLoaded) {
                setLoadingManga(false);
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
        setAppSettings((init) => {
            init.readerSettings.sideListWidth = sideListWidth;
            return { ...init };
        });
    }, [sideListWidth]);
    useLayoutEffect(() => {
        changePageNumber();
    }, [currentImageRow]);
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
                    if (clickPos <= 20) openPrevChapterRef.current?.click();
                    if (clickPos > 80) openNextChapterRef.current?.click();
                } else if (abc === 2) {
                    const clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                    if (clickPos <= 20) openPrevChapterRef.current?.click();
                    if (clickPos > 80) openNextChapterRef.current?.click();
                } else if (abc === 3) {
                    const clickPos =
                        ((e.clientX - (isSideListPinned ? sideListWidth : 0)) / e.currentTarget.offsetWidth) * 100;
                    if (clickPos <= 40) openPrevPageRef.current?.click();
                    if (clickPos > 60) openNextPageRef.current?.click();
                }

                const clickPos =
                    ((e.clientX - (isSideListPinned ? sideListWidth : 0)) / e.currentTarget.offsetWidth) * 100;
                if (appSettings.readerSettings.readerTypeSelected === 0) {
                    if (clickPos <= 40) openPrevChapterRef.current?.click();
                    if (clickPos > 60) openNextChapterRef.current?.click();
                } else {
                    if (clickPos <= 40) openPrevPageRef.current?.click();
                    if (clickPos > 60) openNextPageRef.current?.click();
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
                            `press "${shortcuts.find((e) => e.command === "prevPage")?.key1}"` +
                            `${
                                shortcuts.find((e) => e.command === "prevPage")?.key2 === ""
                                    ? ""
                                    : ` or "${shortcuts.find((e) => e.command === "prevPage")?.key2}"`
                            }` +
                            ` or click left side of screen`
                        }
                    >
                        Previous
                        <FontAwesomeIcon icon={faQuestionCircle} />:
                    </span>
                    <span className="b">{prevNextChapter.prev.split("\\").pop()}</span>
                </div>
                <div className="c">
                    <span className="a">Current :</span>
                    <span className="b">{mangaInReader?.chapterName || ""}</span>
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
                        Next
                        <FontAwesomeIcon icon={faQuestionCircle} />:
                    </span>
                    <span className="b">{prevNextChapter.next.split("\\").pop()}</span>
                </div>
            </div>
        </div>
    );
    return (
        <div
            ref={readerRef}
            id="reader"
            className={isSideListPinned ? "sideListPinned" : ""}
            style={{
                gridTemplateColumns: sideListWidth + "px auto",

                display: isReaderOpen ? (isSideListPinned ? "grid" : "block") : "none",
                "--mangaListWidth": sideListWidth + "px",
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
            />
            <ReaderSideList
                openNextChapterRef={openNextChapterRef}
                openPrevChapterRef={openPrevChapterRef}
                addToBookmarkRef={addToBookmarkRef}
                isBookmarked={isBookmarked}
                setBookmarked={setBookmarked}
                isSideListPinned={isSideListPinned}
                setSideListPinned={setSideListPinned}
                setSideListWidth={setSideListWidth}
                makeScrollPos={makeScrollPos}
            />
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
            <div
                className={
                    "zenModePageNumber " + (appSettings.readerSettings.showPageNumberInZenMode ? "show" : "")
                }
            >
                {currentPageNumber}/{mangaInReader?.pages}
            </div>
            <ChapterChanger />
            <section
                ref={imgContRef}
                className={
                    "imgCont " +
                    (appSettings.readerSettings.gapBetweenRows ? "gap " : "") +
                    (appSettings.readerSettings.readerTypeSelected === 1 ? "readerMode1 " : "") +
                    (appSettings.readerSettings.fitVertically ? "fitVertically " : "")
                }
                style={{
                    "--varWidth": appSettings.readerSettings.readerWidth + "%",
                    "--gapSize": appSettings.readerSettings.gapSize + "px",
                    display:
                        !chapterChangerDisplay || appSettings.readerSettings.readerTypeSelected === 0
                            ? "flex"
                            : "none",
                }}
                onScroll={() => {
                    if (appSettings.readerSettings.readerTypeSelected === 0 && isSideListPinned)
                        changePageNumber();
                }}
                onClick={(e) => {
                    // && (e.target as HTMLElement).tagName === "IMG"
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
                        if (clickPos <= 40) openPrevPageRef.current?.click();
                        if (clickPos > 60) openNextPageRef.current?.click();
                    }
                }}
            >
                {imageElements.map((e, i) => (
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
                            display:
                                appSettings.readerSettings.readerTypeSelected === 1
                                    ? currentImageRow === i + 1
                                        ? "flex"
                                        : "none"
                                    : "flex",
                        }}
                        key={i}
                    >
                        {e}
                    </div>
                ))}
            </section>
            {appSettings.readerSettings.readerTypeSelected === 0 ? <ChapterChanger /> : ""}
        </div>
    );
};

export default Reader;
