import { faBars, faMinus, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import ReaderSideList from "./ReaderSideList";
import { MainContext } from "./Main";

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
        bookmarks,
        setLoadingMangaPercent,
        // currentPageNumber,
        setCurrentPageNumber,
        pageNumChangeDisabled,
        // scrollToPage,
        checkValidFolder,
    } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
    const [images, setImages] = useState<string[]>([]);
    const [wideImages, setWideImages] = useState<string[]>([]);
    const [imagesLength, setImagesLength] = useState(0);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [isCtrlsOpen, setCtrlOpen] = useState(true);
    const [isBookmarked, setBookmarked] = useState(false);
    const [scrollPosPercent, setScrollPosPercent] = useState(0);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const openPrevRef = useRef<HTMLButtonElement>(null);
    const openNextRef = useRef<HTMLButtonElement>(null);
    const addToBookmarkRef = useRef<HTMLButtonElement>(null);
    const readerRef = useRef<HTMLDivElement>(null);
    const scrollReader = (intensity: -4 | -1 | 1 | 4) => {
        if (readerRef.current && window.app.lastClick <= Date.now() - window.app.clickDelay) {
            window.app.lastClick = Date.now();
            let startTime: number, prevTime: number;
            const anim = (timeStamp: DOMTimeStamp) => {
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
    useLayoutEffect(() => {
        window.app.clickDelay = 100;
        window.app.lastClick = 0;
        window.addEventListener("keydown", (e) => {
            if (window.app.isReaderOpen && document.activeElement!.tagName === "BODY") {
                if (e.shiftKey && e.key === " ") {
                    e.preventDefault();
                    scrollReader(-4);
                    return;
                }
                switch (e.key) {
                    case "f":
                        pageNumberInputRef.current?.focus();
                        break;
                    case "]":
                        openNextRef.current?.click();
                        break;
                    case "[":
                        openPrevRef.current?.click();
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
                    case " ":
                        e.preventDefault();
                        scrollReader(4);
                        break;
                    case "s":
                    case "d":
                    case "ArrowRight":
                    case "ArrowDown":
                        scrollReader(1);
                        break;
                    case "w":
                    case "a":
                    case "ArrowLeft":
                    case "ArrowUp":
                        scrollReader(-1);
                        break;
                    default:
                        break;
                }
            }
        });
    }, []);
    const makeScrollPos = () => {
        if (readerRef.current) setScrollPosPercent(readerRef.current.scrollTop / readerRef.current.scrollHeight);
    };
    const changePageNumber = () => {
        if (!pageNumChangeDisabled) {
            const elem = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 4);
            if (elem && elem.tagName === "IMG") {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const pageNumber = parseInt(elem.getAttribute("data-pagenumber")!);
                if (pageNumber) setCurrentPageNumber(pageNumber);
            }
        }
    };
    const checkForImgsAndLoad = (link: string) => {
        if (window.cachedImageList?.link === link && window.cachedImageList.images) {
            console.log("using cached image list for " + link);
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
        setWideImages([]);
        setCurrentPageNumber(1);
        setImagesLength(0);
        setImagesLoaded(0);
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
    }, [appSettings.readerWidth]);
    useEffect(() => {
        if (linkInReader && linkInReader !== "") {
            if (mangaInReader && mangaInReader.link === linkInReader) return;
            checkForImgsAndLoad(linkInReader);
        }
    }, [linkInReader]);
    return (
        <div
            ref={readerRef}
            id="reader"
            style={{ display: isReaderOpen ? "block" : "none" }}
            onScroll={() => {
                changePageNumber();
            }}
        >
            <div id="readerSettings">
                <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }}>
                    <defs>
                        <filter id="goo">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                            <feColorMatrix
                                in="blur"
                                type="matrix"
                                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                                result="goo"
                            />
                            <feBlend in="SourceGraphic" in2="goo" />
                        </filter>
                    </defs>
                </svg>
                <Button
                    className={`ctrl-menu-item ctrl-menu-extender ${isCtrlsOpen ? "open" : ""}`}
                    clickAction={() => {
                        setCtrlOpen((init) => !init);
                    }}
                    tooltip="Tools"
                >
                    <FontAwesomeIcon icon={isCtrlsOpen ? faTimes : faBars} />
                </Button>
                <div className="ctrl-menu">
                    <Button
                        className="ctrl-menu-item"
                        tooltip="Size +"
                        btnRef={sizePlusRef}
                        clickAction={() => {
                            makeScrollPos();
                            setAppSettings((init) => {
                                const steps = Math.max(1, Math.min(5, 1 + Math.log10(init.readerWidth)));
                                init.readerWidth =
                                    init.readerWidth + steps > 100
                                        ? 100
                                        : init.readerWidth + steps < 0
                                        ? 0
                                        : init.readerWidth + steps;
                                return { ...init };
                            });
                        }}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </Button>
                    <Button
                        className="ctrl-menu-item"
                        tooltip="Size -"
                        btnRef={sizeMinusRef}
                        clickAction={() => {
                            makeScrollPos();
                            setAppSettings((init) => {
                                const steps = Math.max(1, Math.min(5, 1 + Math.log10(init.readerWidth)));
                                init.readerWidth =
                                    init.readerWidth - steps > 100
                                        ? 100
                                        : init.readerWidth - steps < 0
                                        ? 0
                                        : init.readerWidth - steps;
                                return { ...init };
                            });
                        }}
                    >
                        <FontAwesomeIcon icon={faMinus} />
                    </Button>
                </div>
            </div>
            <ReaderSideList
                openNextRef={openNextRef}
                openPrevRef={openPrevRef}
                addToBookmarkRef={addToBookmarkRef}
                isBookmarked={isBookmarked}
                setBookmarked={setBookmarked}
            />
            <section className="imgCont">
                {images.map((e, i) => (
                    <img
                        src={
                            window.electron.app.isPackaged
                                ? window.path.normalize(mangaInReader?.link + "\\" + e)
                                : "http://localhost:5000/" +
                                  window.path.normalize(mangaInReader?.link + "\\" + e).replace("D:\\", "")
                        }
                        style={{
                            width:
                                (wideImages.includes(e)
                                    ? appSettings.readerWidth * 2.0
                                    : appSettings.readerWidth) + "%",
                        }}
                        data-pagenumber={i + 1}
                        onContextMenu={(ev) => {
                            showContextMenu({
                                isImg: true,
                                e: ev.nativeEvent,
                                link: window.path.normalize(mangaInReader?.link + "\\" + e),
                            });
                        }}
                        onError={() => {
                            setImagesLoaded((init) => init + 1);
                        }}
                        onAbort={() => {
                            setImagesLoaded((init) => init + 1);
                        }}
                        onLoad={(ev) => {
                            setImagesLoaded((init) => init + 1);
                            if (
                                appSettings.variableImageSize &&
                                ev.currentTarget.offsetHeight / ev.currentTarget.offsetWidth <= 1.2
                            ) {
                                setWideImages((init) => [...init, e]);
                            }
                        }}
                        title={e}
                        key={e}
                    ></img>
                ))}
            </section>
        </div>
    );
};

const Button = (props: any) => {
    return (
        <button
            className={props.className}
            data-tooltip={props.tooltip}
            ref={props.btnRef}
            onClick={props.clickAction}
            tabIndex={-1}
            disabled={props.disabled}
            onFocus={(e) => e.currentTarget.blur()}
        >
            {props.children}
        </button>
    );
};

export default Reader;
