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
import { useContext, useEffect, useState } from "react";
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
        setCurrentPageNumber,
        pageNumChangeDisabled,
        prevNextChapter,
    } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
    const [images, setImages] = useState<string[]>([]);
    const [wideimages, setWideImages] = useState<string[]>([]);
    const [imagesLength, setImagesLength] = useState(0);
    const [imagesLoaded, setImagesLoaded] = useState(0);
    const [isCtrlsOpen, setctrlOpen] = useState(false);
    const [isBookmarked, setBookmarked] = useState(bookmarks.map(e => e.link).includes(linkInReader));
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
                window.electron.dialog.showMessageBox(
                    window.electron.BrowserWindow.getFocusedWindow() ||
                        window.electron.BrowserWindow.getAllWindows()[0],
                    {
                        type: "error",
                        title: "No images found",
                        message: "Folder is empty.",
                        detail: link,
                    }
                );
                setLinkInReader(mangaInReader?.link || "");
                return setLoadingManga(false);
            }
            const supportedFormat = [".jpg", ".jpeg", ".png", "webp", ".svg", ".apng", ".gif", "avif"];
            const binFiles: string[] = [];
            const imgs = files
                .filter(e => {
                    if (window.path.extname(e) === ".bin") {
                        binFiles.push(e);
                        return true;
                    }
                    return supportedFormat.includes(window.path.extname(e));
                })
                .sort(window.betterSortOrder);
            if (imgs.length <= 0) {
                window.electron.dialog.showMessageBox(
                    window.electron.BrowserWindow.getFocusedWindow() ||
                        window.electron.BrowserWindow.getAllWindows()[0],
                    {
                        type: "error",
                        title: "No images found",
                        message: "Folder doesn't contain any supported image format.",
                    }
                );
                setLinkInReader(mangaInReader?.link || "");
                return setLoadingManga(false);
            }
            if (binFiles.length > 0) {
                let errMsg = "";
                binFiles.forEach(e => {
                    errMsg += e + "\n";
                });
                window.electron.dialog.showMessageBox(
                    window.electron.BrowserWindow.getFocusedWindow() ||
                        window.electron.BrowserWindow.getAllWindows()[0],
                    {
                        type: "warning",
                        title: "Warning",
                        message: "Unable to load following files.",
                        detail: errMsg + "from folder\n" + link,
                    }
                );
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
        const linksplitted = link.split(window.path.sep);
        const mangaOpened: ListItem = {
            mangaName: linksplitted[linksplitted.length - 2],
            chapterName: linksplitted[linksplitted.length - 1],
            link,
            date: new Date().toLocaleString(),
            pages: imgs.length,
        };
        setMangaInReader(mangaOpened);
        setHistory(initial => {
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
        if (linkInReader && linkInReader !== "") {
            if (linkInReader === "first") {
                window.electron.dialog.showMessageBox(
                    window.electron.BrowserWindow.getFocusedWindow() ||
                        window.electron.BrowserWindow.getAllWindows()[0],
                    {
                        title: "Error",
                        type: "error",
                        message: "First Chapter in List",
                    }
                );
                setLinkInReader(mangaInReader?.link || "");
                return;
            }
            if (linkInReader === "last") {
                window.electron.dialog.showMessageBox(
                    window.electron.BrowserWindow.getFocusedWindow() ||
                        window.electron.BrowserWindow.getAllWindows()[0],
                    {
                        title: "Error",
                        type: "error",
                        message: "Last Chapter in List",
                    }
                );
                setLinkInReader(mangaInReader?.link || "");
                return;
            }
            if (mangaInReader && mangaInReader.link === linkInReader) return;
            checkForImgsAndLoad(linkInReader);
        }
    }, [linkInReader]);
    return (
        <div id="reader" style={{ display: isReaderOpen ? "block" : "none" }} onScroll={() => changePageNumber()}>
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
                <button
                    className={`ctrl-menu-item ctrl-menu-extender ${isCtrlsOpen ? "open" : ""}`}
                    tabIndex={-1}
                    onClick={() => {
                        setctrlOpen(init => !init);
                    }}
                    data-tooltip="Tools"
                >
                    <FontAwesomeIcon icon={isCtrlsOpen ? faTimes : faBars} />
                </button>
                <div className="ctrl-menu">
                    <button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        data-tooltip="Size +"
                        onClick={() => {
                            setAppSettings(init => {
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
                    </button>
                    <button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        data-tooltip="Size -"
                        onClick={() => {
                            setAppSettings(init => {
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
                    </button>
                    <button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        data-tooltip="Open Previous"
                        onClick={() => {
                            setLinkInReader(prevNextChapter.prev);
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        data-tooltip="Open Next"
                        onClick={() => {
                            setLinkInReader(prevNextChapter.next);
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                    <button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        data-tooltip="Bookmark"
                        onClick={() => {
                            if (isBookmarked) {
                                return window.electron.dialog
                                    .showMessageBox(
                                        window.electron.BrowserWindow.getFocusedWindow() ||
                                            window.electron.BrowserWindow.getAllWindows()[0],
                                        {
                                            title: "Warning",
                                            type: "warning",
                                            message: "Remove Bookmark?",
                                            buttons: ["Yes", "No"],
                                        }
                                    )
                                    .then(res => {
                                        if (res.response === 0) {
                                            setBookmarks(init => [...init.filter(e => e.link !== linkInReader)]);
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
                    </button>
                    <button
                        className="ctrl-menu-item"
                        tabIndex={-1}
                        data-tooltip="Navigate To Page"
                        onClick={() => pageNumberInputRef.current?.focus()}
                    >
                        <FontAwesomeIcon icon={faFile} />
                    </button>
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
                        onContextMenu={ev => {
                            showContextMenu({
                                isImg: true,
                                e: ev.nativeEvent,
                                link: window.path.normalize(mangaInReader?.link + "\\" + e),
                            });
                        }}
                        onError={() => {
                            setImagesLoaded(init => init + 1);
                        }}
                        onAbort={() => {
                            setImagesLoaded(init => init + 1);
                        }}
                        onLoad={ev => {
                            setImagesLoaded(init => init + 1);
                            if (ev.currentTarget.offsetHeight / ev.currentTarget.offsetWidth <= 1.2) {
                                setWideImages(init => [...init, e]);
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

export default Reader;
