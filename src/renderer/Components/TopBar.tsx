import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useEffect, useLayoutEffect, useState } from "react";
import {
    faHome,
    faCog,
    faMinus,
    faWindowRestore,
    faWindowMaximize,
    faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { useAppContext } from "../App";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setSysBtnColor } from "@store/themes";
import { formatUtils } from "@utils/file";
import { setSettingsOpen, toggleSettingsOpen } from "@store/ui";
import { shallowEqual } from "react-redux";

const TopBar = (): ReactElement => {
    const [title, setTitle] = useState<string>("Yomikiru");
    const { pageNumberInputRef, bookProgressRef, closeReader } = useAppContext();
    const [isMaximized, setMaximized] = useState(window.electron.currentWindow.isMaximized() || false);
    const [pageNumberChangeDisabled, setPageNumberChangeDisabled] = useState(false);
    const readerContent = useAppSelector((store) => store.reader.content);
    // todo: move input to separate component
    const currentPageNumber = useAppSelector((store) => {
        if (store.reader.type === "manga" && store.reader.content?.progress) {
            return store.reader.content.progress.currentPage;
        }
        return 1;
    }, shallowEqual);
    const appSettings = useAppSelector((store) => store.appSettings);

    const [pageScrollTimeoutID, setTimeoutID] = useState<NodeJS.Timeout | null>(null);

    const dispatch = useAppDispatch();

    const setTitleWithSize = () => {
        if (!readerContent) {
            setTitle(window.electron.app.getName().concat(window.electron.app.isPackaged ? "" : " - dev"));
            document.title = window.electron.app.getName();
            return;
        }
        if (readerContent.type === "manga") {
            let mangaName = readerContent.title;
            let chapterName = formatUtils.files.getName(readerContent.progress?.chapterName || "");
            if (mangaName.length > 13) mangaName = mangaName.substring(0, 20) + "...";
            if (chapterName.length > 83) chapterName = chapterName.substring(0, 80) + "...";
            const title = `${window.electron.app.getName()} - ${mangaName} | ${chapterName}`;
            setTitle(chapterName.concat(window.electron.app.isPackaged ? "" : " - dev"));
            document.title = title;
            return;
        } else if (readerContent.type === "book") {
            let bookTitle = readerContent.title;
            let chapterName = "";
            if (
                appSettings.epubReaderSettings.loadOneChapter &&
                readerContent.progress &&
                readerContent.progress.chapterName !== "~"
            ) {
                chapterName = readerContent.progress.chapterName;
                if (chapterName.length > 83) chapterName = chapterName.substring(0, 80) + "...";
            }
            if (bookTitle.length > 83) bookTitle = bookTitle.substring(0, 80) + "...";
            const title = `${window.electron.app.getName()} - ${bookTitle} ${
                chapterName ? "| " + chapterName : ""
            }`;
            setTitle(
                (chapterName ? chapterName : bookTitle).concat(window.electron.app.isPackaged ? "" : " - dev"),
            );
            document.title = title;
            return;
        }
    };
    useLayoutEffect(() => {
        const onBlur = () => {
            setSysBtnColor(true);
        };
        const onFocus = () => {
            setSysBtnColor();
        };
        setMaximized(window.electron.currentWindow.isMaximized());
        window.electron.currentWindow.isFocused() ? onFocus() : onBlur();

        const listeners: (() => void)[] = [];
        // required in case of reloads and other events
        window.electron.currentWindow.clearEvents(["maximize", "unmaximize", "focus", "blur"]);
        listeners.push(window.electron.currentWindow.on("maximize", () => setMaximized(true)));
        listeners.push(window.electron.currentWindow.on("unmaximize", () => setMaximized(false)));
        listeners.push(window.electron.currentWindow.on("focus", onFocus));
        listeners.push(window.electron.currentWindow.on("blur", onBlur));
        return () => {
            listeners.forEach((e) => e());
        };
    }, []);
    useEffect(() => {
        if (!pageNumberChangeDisabled && currentPageNumber) {
            if (pageNumberInputRef.current) {
                pageNumberInputRef.current.value = currentPageNumber.toString();
            }
        }
    }, [currentPageNumber]);
    useEffect(() => {
        setTitleWithSize();
    }, [readerContent]);

    return (
        <div id="topBar">
            <div className="titleDragable"></div>
            <div className="homeBtns">
                <button
                    className="home"
                    onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => {
                        readerContent ? closeReader() : window.location.reload();
                        dispatch(setSettingsOpen(false));
                    }}
                    tabIndex={-1}
                    data-tooltip="Home"
                >
                    <FontAwesomeIcon icon={faHome} />
                </button>
                <button
                    className="settingsBtn"
                    onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => {
                        dispatch(toggleSettingsOpen());
                    }}
                    tabIndex={-1}
                    data-tooltip="Settings"
                >
                    <FontAwesomeIcon icon={faCog} />
                </button>
            </div>
            <div className="mainTitleCont">
                <div className="title">{title}</div>
            </div>
            <div className="windowBtnCont">
                {readerContent && readerContent.type === "manga" && (
                    <label
                        className="pageNumber noBG"
                        htmlFor="NavigateToPageInput"
                        data-tooltip="Navigate To Page Number"
                    >
                        <input
                            type="number"
                            id="NavigateToPageInput"
                            className="pageNumberInput"
                            defaultValue={1}
                            placeholder="Page Num."
                            ref={pageNumberInputRef}
                            min="1"
                            max={readerContent.progress?.totalPages || 0}
                            onFocus={(e) => {
                                e.currentTarget.select();
                            }}
                            onBlur={() => {
                                setPageNumberChangeDisabled(false);
                            }}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (pageScrollTimeoutID) clearTimeout(pageScrollTimeoutID);
                                if (
                                    !(
                                        /[0-9]/gi.test(e.key) ||
                                        e.key === "Backspace" ||
                                        e.key == "Enter" ||
                                        e.key == "Escape"
                                    )
                                )
                                    e.preventDefault();
                            }}
                            onKeyUp={(e) => {
                                if (pageScrollTimeoutID) clearTimeout(pageScrollTimeoutID);
                                if (e.key == "Enter" || e.key == "Escape") {
                                    e.currentTarget.blur();
                                }
                                if (e.key === "Enter") {
                                    let pagenumber = parseInt(e.currentTarget.value);
                                    if (pagenumber > (readerContent.progress?.totalPages || 0))
                                        pagenumber = readerContent.progress?.totalPages || 0;
                                    if (pageNumberInputRef.current && pageNumberInputRef.current) {
                                        pageNumberInputRef.current.value = pagenumber.toString();
                                    }
                                    if (!pagenumber) return;
                                    setPageNumberChangeDisabled(true);
                                    window.app.scrollToPage(pagenumber, "smooth", () => {
                                        setPageNumberChangeDisabled(false);
                                    });
                                    return;
                                }
                                if (/[0-9]/gi.test(e.key) || e.key === "Backspace") {
                                    let pagenumber = parseInt(e.currentTarget.value);
                                    if (pagenumber > (readerContent.progress?.totalPages || 0))
                                        pagenumber = readerContent.progress?.totalPages || 0;
                                    if (pageNumberInputRef.current && pageNumberInputRef.current) {
                                        pageNumberInputRef.current.value = pagenumber.toString();
                                    }
                                    if (!pagenumber) return;
                                    setTimeoutID(
                                        setTimeout(() => {
                                            setPageNumberChangeDisabled(true);
                                            window.app.scrollToPage(pagenumber);
                                        }, 1000),
                                    );
                                    return;
                                }
                                e.preventDefault();
                            }}
                            tabIndex={-1}
                        />
                        <span className="totalPage">/{readerContent.progress?.totalPages || 0}</span>
                    </label>
                )}
                {readerContent && readerContent.type === "book" && (
                    <label className="pageNumber noBG">
                        <input
                            className="pageNumberInput"
                            ref={bookProgressRef}
                            type="number"
                            defaultValue={0}
                            min={0}
                            max={100}
                            onFocus={(e) => {
                                e.currentTarget.select();
                            }}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (
                                    !(
                                        /[0-9]/gi.test(e.key) ||
                                        e.key === "Backspace" ||
                                        e.key == "Enter" ||
                                        e.key == "Escape"
                                    )
                                )
                                    e.preventDefault();
                            }}
                            onKeyUp={(e) => {
                                if (e.key == "Enter" || e.key == "Escape") {
                                    e.currentTarget.blur();
                                }
                                if (/[0-9]/gi.test(e.key) || e.key === "Backspace") {
                                    let percent = parseInt(e.currentTarget.value);
                                    if (percent > 100) percent = 100;
                                    if (bookProgressRef.current && bookProgressRef.current) {
                                        bookProgressRef.current.value = percent.toString();
                                    }
                                    // if (!percent) return;
                                    window.app.scrollToPage(percent, "auto");
                                    return;
                                }
                                e.preventDefault();
                            }}
                            tabIndex={-1}
                        />
                        <span className="totalPage">%</span>
                    </label>
                )}
                {window.process.platform !== "win32" ? (
                    <>
                        <button
                            tabIndex={-1}
                            id="minimizeBtn"
                            title="Minimize"
                            onFocus={(e) => e.currentTarget.blur()}
                            onClick={() => window.electron.currentWindow.minimize()}
                        >
                            <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button
                            tabIndex={-1}
                            id="maximizeRestoreBtn"
                            onFocus={(e) => e.currentTarget.blur()}
                            title={isMaximized ? "Restore" : "Maximize"}
                            onClick={() => {
                                if (isMaximized) return window.electron.currentWindow.restore();
                                window.electron.currentWindow.maximize();
                            }}
                        >
                            <FontAwesomeIcon icon={isMaximized ? faWindowRestore : faWindowMaximize} />
                        </button>
                        <button
                            tabIndex={-1}
                            id="closeBtn"
                            title="Close"
                            onFocus={(e) => e.currentTarget.blur()}
                            onClick={() => window.electron.currentWindow.close()}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </>
                ) : (
                    ""
                )}
            </div>
        </div>
    );
};

export default TopBar;
