import {
    faArrowLeft,
    faArrowRight,
    faBars,
    faBookmark,
    faFile,
    faMinus,
    faPlus,
    faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
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
        setBookmarks,
        addNewBookmark,
        setLoadingMangaPercent,
        currentPageNumber,
        setCurrentPageNumber,
        pageNumChangeDisabled,
        closeReader,
        prevNextChapter,
        scrollToPage,
    } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
    const [images, setImages] = useState<string[]>([]);
    const [wideimages, setWideImages] = useState<string[]>([]);
    const [imagesLength, setImagesLength] = useState(0);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [isCtrlsOpen, setctrlOpen] = useState(true);
    const [isBookmarked, setBookmarked] = useState(false);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const openPrevRef = useRef<HTMLButtonElement>(null);
    const openNextRef = useRef<HTMLButtonElement>(null);
    const navToPageRef = useRef<HTMLButtonElement>(null);
    const addToBookmarRef = useRef<HTMLButtonElement>(null);
    const readerRef = useRef<HTMLDivElement>(null);
    const scrollReader = (intensity: -2 | -1 | 1 | 2) => {
        if (readerRef.current && window.app.lastClick <= Date.now() - window.app.clickDelay) {
            window.app.lastClick = Date.now();
            let startTime: number, prevTime: number;
            readerRef.current.style.scrollBehavior = "auto";
            const anim = (timeStamp: DOMTimeStamp) => {
                if (startTime === undefined) startTime = timeStamp;
                const elapsed = timeStamp - startTime;
                if (prevTime !== timeStamp && readerRef.current) {
                    readerRef.current.scrollBy(0, intensity * 30);
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
        window.addEventListener("keypress", (e) => {
            if (window.app.isReaderOpen && document.activeElement!.tagName === "BODY") {
                if (e.shiftKey && e.key === " ") {
                    e.preventDefault();
                    scrollReader(-2);
                    return;
                }
                switch (e.key) {
                    case "h":
                        closeReader();
                        break;
                    case "f":
                        navToPageRef.current?.click();
                        break;
                    case "]":
                        openNextRef.current?.click();
                        break;
                    case "[":
                        openPrevRef.current?.click();
                        break;
                    case "b":
                        addToBookmarRef.current?.click();
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
                        scrollReader(2);
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
        window.addEventListener("keyup", () => {
            if (window.app.isReaderOpen && document.activeElement!.tagName === "BODY") {
                document.body.style.scrollBehavior = "smooth";
            }
        });
    }, []);
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
        setLoadingManga(true);
        setLoadingMangaPercent(0);
        window.fs.readdir(link, (err, files) => {
            if (err) return console.error(err);
            if (files.length <= 0) {
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    type: "error",
                    title: "No images found",
                    message: "Folder is empty.",
                    detail: link,
                });
                setLinkInReader(mangaInReader?.link || "");
                return setLoadingManga(false);
            }
            const supportedFormat = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", "avif"];
            const binFiles: string[] = [];
            const imgs = files
                .filter((e) => {
                    if (window.path.extname(e) === ".bin") {
                        binFiles.push(e);
                        return true;
                    }
                    return supportedFormat.includes(window.path.extname(e));
                })
                .sort(window.app.betterSortOrder);
            if (imgs.length <= 0) {
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    type: "error",
                    title: "No images found",
                    message: "Folder doesn't contain any supported image format.",
                });
                setLinkInReader(mangaInReader?.link || "");
                return setLoadingManga(false);
            }
            if (binFiles.length > 0) {
                let errMsg = "";
                binFiles.forEach((e) => {
                    errMsg += e + "\n";
                });
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    title: "Warning",
                    type: "warning",
                    message: "Unable to load following files.",
                    detail: errMsg + "from folder\n" + link,
                });
            }
            loadImg(link, imgs);
        });
    };
    const loadImg = (link: string, imgs: string[]) => {
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
                newData.push(mangaOpened, ...initial);
                if (initial.length >= appSettings.historyLimit) {
                    newData.length = appSettings.historyLimit;
                }
                return newData;
            }
            newData.push(mangaOpened, ...initial);
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
    useEffect(() => {
        scrollToPage(currentPageNumber);
    }, [appSettings.readerWidth]);
    useEffect(() => {
        if (linkInReader && linkInReader !== "") {
            if (linkInReader === "first") {
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    title: "Error",
                    type: "error",
                    message: "First Chapter in List",
                });
                setLinkInReader(mangaInReader?.link || "");
                return;
            }
            if (linkInReader === "last") {
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    title: "Error",
                    type: "error",
                    message: "Last Chapter in List",
                });
                setLinkInReader(mangaInReader?.link || "");
                return;
            }
            if (mangaInReader && mangaInReader.link === linkInReader) return;
            checkForImgsAndLoad(linkInReader);
        }
    }, [linkInReader]);
    return (
        <div
            ref={readerRef}
            id="reader"
            style={{ display: isReaderOpen ? "block" : "none" }}
            onScroll={() => changePageNumber()}
        >
            <div className="ctrl-bar">
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
                        setctrlOpen((init) => !init);
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
                            setAppSettings((init) => {
                                init.readerWidth =
                                    init.readerWidth + 5 > 100
                                        ? 100
                                        : init.readerWidth + 5 < 20
                                        ? 20
                                        : init.readerWidth + 5;
                                return { ...init };
                            });
                        }}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </Button>
                    <Button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        tooltip="Size -"
                        btnRef={sizeMinusRef}
                        clickAction={() => {
                            setAppSettings((init) => {
                                init.readerWidth =
                                    init.readerWidth - 5 > 100
                                        ? 100
                                        : init.readerWidth - 5 < 20
                                        ? 20
                                        : init.readerWidth - 5;
                                return { ...init };
                            });
                        }}
                    >
                        <FontAwesomeIcon icon={faMinus} />
                    </Button>
                    <Button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        btnRef={openPrevRef}
                        tooltip="Open Previous"
                        clickAction={() => {
                            setLinkInReader(prevNextChapter.prev);
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </Button>
                    <Button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        btnRef={openNextRef}
                        tooltip="Open Next"
                        clickAction={() => {
                            setLinkInReader(prevNextChapter.next);
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </Button>
                    <Button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        tooltip="Bookmark"
                        btnRef={addToBookmarRef}
                        clickAction={() => {
                            if (isBookmarked) {
                                return window.electron.dialog
                                    .showMessageBox(window.electron.getCurrentWindow(), {
                                        title: "Warning",
                                        type: "warning",
                                        message: "Remove Bookmark?",
                                        buttons: ["Yes", "No"],
                                    })
                                    .then((res) => {
                                        if (res.response === 0) {
                                            setBookmarks((init) => [
                                                ...init.filter((e) => e.link !== linkInReader),
                                            ]);
                                            setBookmarked(false);
                                        }
                                    });
                            }
                            if (mangaInReader) {
                                addNewBookmark(mangaInReader);
                                setBookmarked(true);
                            }
                        }}
                    >
                        <FontAwesomeIcon icon={isBookmarked ? faBookmark : farBookmark} />
                    </Button>
                    <Button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        btnRef={navToPageRef}
                        tooltip="Navigate To Page"
                        clickAction={() => pageNumberInputRef.current?.focus()}
                    >
                        <FontAwesomeIcon icon={faFile} />
                    </Button>
                </div>
            </div>
            <ReaderSideList />
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
                                (wideimages.includes(e)
                                    ? appSettings.readerWidth * 1.8
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
                            if (ev.currentTarget.offsetHeight / ev.currentTarget.offsetWidth <= 1.2) {
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
            onFocus={(e) => e.currentTarget.blur()}
        >
            {props.children}
        </button>
    );
};

export default Reader;
