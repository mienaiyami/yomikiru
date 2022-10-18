import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import ReaderSideList from "./ReaderSideList";
import { MainContext } from "./Main";
import ReaderSettings from "./ReaderSettings";

const Reader = () => {
    const {
        appSettings,
        setAppSettings,
        isReaderOpen,
        setReaderOpen,
        pageNumberInputRef,
        linkInReader,
        setLinkInReader,
        mangaInReader,
        setMangaInReader,
        setLoadingManga,
        setHistory,
        prevNextChapter,
        bookmarks,
        setLoadingMangaPercent,
        // currentPageNumber,
        currentImageRow,
        setCurrentPageNumber,
        setCurrentImageRow,
        pageNumChangeDisabled,
        // scrollToPage,
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

    const scrollReader = (intensity: -4 | -1 | 1 | 4) => {
        // ! remove window.app.lastClick after next update if no problems
        // && window.app.lastClick <= Date.now() - window.app.clickDelay
        if (readerRef.current) {
            // window.app.lastClick = Date.now();
            let startTime: number, prevTime: number;
            const anim = (timeStamp: number) => {
                if (startTime === undefined) startTime = timeStamp;
                const elapsed = timeStamp - startTime;
                if (prevTime !== timeStamp && readerRef.current) {
                    readerRef.current.scrollBy(0, intensity * 10);
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
    useEffect(() => {
        if (zenMode) {
            document.body.classList.add("zenMode");
        } else {
            document.body.classList.remove("zenMode");
        }
    }, [zenMode]);
    useLayoutEffect(() => {
        window.app.clickDelay = 100;
        // window.app.lastClick = 0;
        window.addEventListener("wheel", (e) => {
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
        });
        // register shortcuts
        window.addEventListener("keydown", (e) => {
            // /&& document.activeElement!.tagName === "BODY"
            if (window.app.isReaderOpen) {
                switch (e.key) {
                    case "f":
                        navToPageButtonRef.current?.click();
                        break;
                    case "`":
                        setZenMode((prev) => !prev);
                        break;
                    case "Escape":
                        setZenMode(false);
                        break;
                    case "q":
                        readerSettingExtender.current?.click();
                        readerSettingExtender.current?.focus();
                        break;
                    case "]":
                        openNextChapterRef.current?.click();
                        break;
                    case "[":
                        openPrevChapterRef.current?.click();
                        break;
                    case "b":
                        addToBookmarkRef.current?.click();
                        break;
                    case "=":
                    case "+":
                        sizePlusRef.current?.click();
                        break;
                    case "-":
                        sizeMinusRef.current?.click();
                        break;
                    default:
                        break;
                }
                if (document.activeElement!.tagName === "BODY" || document.activeElement === readerRef.current) {
                    if (e.shiftKey && e.key === " ") {
                        e.preventDefault();
                        scrollReader(-4);
                        return;
                    }
                    window.app.keydown = true;
                    switch (e.key) {
                        case " ":
                            e.preventDefault();
                            scrollReader(4);
                            break;
                        case "d":
                        case "ArrowRight":
                            if (appSettings.readerSettings.readerTypeSelected === 1) {
                                openNextPageRef.current?.click();
                            }
                            break;
                        case "s":
                        case "ArrowDown":
                            scrollReader(1);
                            break;
                        case "a":
                        case "ArrowLeft":
                            if (appSettings.readerSettings.readerTypeSelected === 1) {
                                openPrevPageRef.current?.click();
                            }
                            break;
                        case "w":
                        case "ArrowUp":
                            scrollReader(-1);
                            break;
                        default:
                            break;
                    }
                }
            }
        });
        window.addEventListener("keyup", () => {
            window.app.keydown = false;
        });
    }, []);
    const makeScrollPos = () => {
        if (isSideListPinned && imgContRef.current)
            return setScrollPosPercent(imgContRef.current.scrollTop / imgContRef.current.scrollHeight);
        if (readerRef.current) setScrollPosPercent(readerRef.current.scrollTop / readerRef.current.scrollHeight);
    };
    const changePageNumber = () => {
        if (!pageNumChangeDisabled) {
            const elem = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 4);
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
            window.dialog
                .confirm({
                    title: "Confirm",
                    noOption: false,
                    message: "Open previous chapter? - " + prevNextChapter.prev,
                })
                .then((response) => {
                    if (response.response === 0) openPrevChapterRef.current?.click();
                });
            return;
        }
        setCurrentImageRow((init) => init - 1);
        if (readerRef.current) readerRef.current.scrollTop = 0;
    };
    const openNextPage = () => {
        if (currentImageRow >= imageRowCount) {
            window.dialog
                .confirm({
                    title: "Confirm",
                    noOption: false,
                    message: "Open Next chapter? - " + prevNextChapter.next,
                })
                .then((response) => {
                    if (response.response === 0) openNextChapterRef.current?.click();
                });
            return;
        }
        setCurrentImageRow((init) => init + 1);
        if (readerRef.current) readerRef.current.scrollTop = 0;
    };

    const checkForImgsAndLoad = (link: string) => {
        if (window.cachedImageList?.link === link && window.cachedImageList.images) {
            // console.log("using cached image list for " + link);
            loadImg(link, window.cachedImageList.images);
            window.cachedImageList = { link: "", images: [] };
            return;
        }
        checkValidFolder(
            link,
            (isValid, imgs) => {
                if (isValid && imgs) return loadImg(link, imgs);
                setLinkInReader(mangaInReader?.link || "");
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
        const linksplitted = link.split(window.path.sep);
        const mangaOpened: ListItem = {
            mangaName: linksplitted[linksplitted.length - 2],
            chapterName: linksplitted[linksplitted.length - 1],
            link,
            date: new Date().toLocaleString(),
            pages: imgs.length,
        };
        setMangaInReader(mangaOpened);
        setHistory((initial) => {
            const newData = [];
            if (initial.length > 0 && initial[0].link === mangaOpened.link) {
                initial.shift();
            }
            newData.push(mangaOpened, ...initial);
            if (newData.length >= appSettings.historyLimit) {
                newData.length = appSettings.historyLimit;
            }
            return newData;
        });
        setImagesLength(imgs.length);
        setImages(imgs);
        setReaderOpen(true);
    };
    useLayoutEffect(() => {
        images.forEach((e, i) => {
            const img = document.createElement("img");
            img.src = window.electron.app.isPackaged
                ? window.path.normalize(mangaInReader?.link + "\\" + e)
                : "http://localhost:5000/" +
                  window.path.normalize(mangaInReader?.link + "\\" + e).replace("D:\\", "");

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
            const Image = ({ name, index }: { name: string; index: number }) => (
                <img
                    src={
                        window.electron.app.isPackaged
                            ? window.path.normalize(mangaInReader?.link + "\\" + name)
                            : "http://localhost:5000/" +
                              window.path.normalize(mangaInReader?.link + "\\" + name).replace("D:\\", "")
                    }
                    data-pagenumber={index + 1}
                    onContextMenu={(ev) => {
                        showContextMenu({
                            isImg: true,
                            e: ev.nativeEvent,
                            link: window.path.normalize(mangaInReader?.link + "\\" + name),
                        });
                    }}
                    title={name}
                    // key={name}
                ></img>
            );
            const wideImageEnabled =
                appSettings.readerSettings.pagesPerRowSelected !== 0 ||
                appSettings.readerSettings.variableImageSize;
            // if(appSettings.readerSettings.pagesPerRowSelected === 0)
            for (let index = 0; index < images.length; index++) {
                if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                    tempImageElements.push([<Image name={images[index]} index={index} key={images[index]} />]);
                    if (wideImageEnabled && imageWidthContainer[index].isWide)
                        tempWideImageContMap.push(tempImageElements.length - 1);
                    continue;
                }
                if (wideImageEnabled && imageWidthContainer[index].isWide) {
                    tempImageElements.push([<Image name={images[index]} index={index} key={images[index]} />]);
                    tempWideImageContMap.push(tempImageElements.length - 1);
                    continue;
                }
                if (appSettings.readerSettings.pagesPerRowSelected === 2 && index === 0) {
                    tempImageElements.push([<Image name={images[index]} index={index} key={images[index]} />]);
                    continue;
                }
                if (index === images.length - 1) {
                    tempImageElements.push([<Image name={images[index]} index={index} key={images[index]} />]);
                    continue;
                }
                if (wideImageEnabled && imageWidthContainer[index + 1].isWide) {
                    tempImageElements.push([<Image name={images[index]} index={index} key={images[index]} />]);
                    continue;
                }
                tempImageElements.push([
                    <Image name={images[index]} index={index} key={images[index]} />,
                    <Image name={images[index + 1]} index={index + 1} key={images[index + 1]} />,
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
        if (imagesLoaded !== 0 && imagesLength !== 0) {
            setLoadingMangaPercent((100 * imagesLoaded) / imagesLength);
            if (imagesLength === imagesLoaded) {
                setLoadingManga(false);
            }
        }
    }, [imagesLoaded]);
    useLayoutEffect(() => {
        readerRef.current?.scrollTo(0, scrollPosPercent * readerRef.current.scrollHeight);
        imgContRef.current?.scrollTo(0, scrollPosPercent * imgContRef.current.scrollHeight);
    }, [appSettings.readerSettings.readerWidth, isSideListPinned]);
    useEffect(() => {
        if (linkInReader && linkInReader !== "") {
            if (mangaInReader && mangaInReader.link === linkInReader) return;
            checkForImgsAndLoad(linkInReader);
        }
    }, [linkInReader]);
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
                changePageNumber();
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
            <section
                ref={imgContRef}
                className={
                    "imgCont " +
                    (appSettings.readerSettings.gapBetweenRows ? "gap " : "") +
                    (appSettings.readerSettings.readerTypeSelected === 1 ? "readerMode1" : "")
                }
                onClick={(e) => {
                    if (
                        appSettings.readerSettings.readerTypeSelected === 1 &&
                        (e.target as HTMLElement).tagName === "IMG"
                    ) {
                        const clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                        if (clickPos <= 50) openPrevPageRef.current?.click();
                        if (clickPos > 50) openNextPageRef.current?.click();
                    }
                    if (
                        appSettings.readerSettings.readerTypeSelected === 0 &&
                        readerRef.current &&
                        imgContRef.current
                    ) {
                        if (isSideListPinned) {
                            if (
                                imgContRef.current.scrollTop <= 100 ||
                                imgContRef.current.scrollTop >=
                                    imgContRef.current.scrollHeight - window.innerHeight - 200
                            ) {
                                const clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                                if (clickPos <= 50) openPrevChapterRef.current?.click();
                                if (clickPos > 50) openNextChapterRef.current?.click();
                            }
                        } else if (
                            readerRef.current.scrollTop <= 100 ||
                            readerRef.current.scrollTop >=
                                readerRef.current.scrollHeight - window.innerHeight - 200
                        ) {
                            const clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                            if (clickPos <= 50) openPrevChapterRef.current?.click();
                            if (clickPos > 50) openNextChapterRef.current?.click();
                        }
                    }
                }}
                style={{
                    "--varWidth": appSettings.readerSettings.readerWidth + "%",
                }}
            >
                {imageElements.map((e, i) => (
                    <div
                        className={
                            "row " +
                            (wideImageContMap.includes(i) ? "wide " : "") +
                            (appSettings.readerSettings.pagesPerRowSelected !== 0 ? "twoPagePerRow " : "")
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
        </div>
    );
};

export default Reader;
