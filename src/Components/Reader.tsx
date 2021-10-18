import {
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faFile,
    faMinus,
    faPlus,
    faSort,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useState } from "react";
import { AppContext } from "../App";

const Reader = () => {
    const {
        appSettings,
        isReaderOpen,
        setReaderOpen,
        pageNumberInputRef,
        linkInReader,
        setLinkInReader,
        setMangaInReader,
        setLoadingManga,
        setHistory,
    } = useContext(AppContext);
    const [images, setImages] = useState<string[]>([]);
    const loadImg = (link: string) => {
        // setLoadingManga(true);
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
                setLinkInReader("");
                return setLoadingManga(false);
            }
            const supportedFormat = [".jpg", ".jpeg", ".png", "webp", ".svg", ".apng", ".gif", "avif"];
            const binFiles: string[] = [];
            const imgs = files.filter(e => {
                if (window.path.extname(e) === ".bin") {
                    binFiles.push(e);
                    return true;
                }
                return supportedFormat.includes(window.path.extname(e));
            });
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
                setLinkInReader("");
                return setLoadingManga(false);
            }
            if (binFiles.length > 0) {
                let errMsg = "";
                binFiles.forEach(e => {
                    errMsg += e + "\n";
                });
                console.log(errMsg);
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
            const linksplitted = link.split(window.path.sep);
            const mangaOpened: ListItem = {
                mangaName: linksplitted[linksplitted.length - 2],
                chapterName: linksplitted[linksplitted.length - 1],
                link,
                date: new Date().toLocaleString(),
                pages: imgs.length,
            };
            setMangaInReader(mangaOpened);
            setHistory(initial => [mangaOpened, ...initial]);
            setImages(imgs);
            setLoadingManga(false);
            setReaderOpen(true);
        });
    };
    useEffect(() => {
        setImages([]);
        if (linkInReader && linkInReader !== "") {
            loadImg(linkInReader);
            console.log(appSettings.readerWidth);
        }
    }, [linkInReader]);
    return (
        <div id="reader" style={{ display: isReaderOpen ? "block" : "none" }}>
            <div className="ctrl-bar">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    // style="display: none"
                >
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
                    className="ctrl-menu-item ctrl-menu-extender nonFocusable"
                    tabIndex={-1}
                    id="ctrl-menu-extender"
                    data-tooltip="Tools">
                    <div className="cont">
                        <div className="bar"></div>
                        <div className="bar"></div>
                        <div className="bar"></div>
                    </div>
                </button>
                <div className="ctrl-menu">
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-plus"
                        data-tooltip="Size +">
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-minus"
                        data-tooltip="Size -">
                        <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-prev"
                        data-tooltip="Open Previous">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-next"
                        data-tooltip="Open Next">
                        <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-bookmark"
                        data-tooltip="Bookmark">
                        <FontAwesomeIcon icon={faBookmark} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-page"
                        data-tooltip="Navigate To Page"
                        onClick={() => pageNumberInputRef.current?.focus()}>
                        <FontAwesomeIcon icon={faFile} />
                    </button>
                </div>
            </div>
            <div className="currentMangaList">
                <div className="tool">
                    <input
                        type="text"
                        name=""
                        id="locationInput2"
                        spellCheck={false}
                        placeholder="Type to Search"
                        tabIndex={-1}
                        data-tooltip="Navigate To Page"
                    />
                    <button id="inverseSort2" tabIndex={-1} data-value="normal" data-tooltip="Sort">
                        <FontAwesomeIcon icon={faSort} />
                    </button>
                </div>
                <h1>
                    Manga: <span className="mangaName"></span>
                    <br />
                    Chapter: <span className="chapterName"></span>
                </h1>
                <div className="location-cont">
                    <ol></ol>
                </div>
            </div>
            <section className="imgCont">
                {images.map(e => (
                    <img
                        src={
                            window.electron.app.isPackaged
                                ? ""
                                : "http://localhost:5000/" +
                                  window.path.normalize(linkInReader + "\\" + e).replace("D:\\", "")
                        }
                        style={{ width: appSettings.readerWidth + "%" }}
                        onLoad={e => {
                            if (e.currentTarget.offsetHeight / e.currentTarget.offsetWidth <= 1.2) {
                                e.currentTarget.style.width = appSettings.readerWidth * 1.8 + "%";
                            }
                        }}
                        title={e}
                        key={e}></img>
                ))}
            </section>
        </div>
    );
};

export default Reader;
