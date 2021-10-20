import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { forwardRef, ReactElement, useContext, useEffect, useState } from "react";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faHome, faCog, faMinus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { faWindowMaximize, faWindowRestore } from "@fortawesome/free-regular-svg-icons";
import { AppContext } from "../App";

const TopBar = forwardRef((props, forwaredRef: React.ForwardedRef<HTMLInputElement>): ReactElement => {
    const [isMaximized, setMaximized] = useState(true);
    useEffect(() => {
        window.electron.ipcRenderer.on("isMaximized", () => {
            setMaximized(true);
        });
        window.electron.ipcRenderer.on("isRestored", () => {
            setMaximized(false);
        });
    }, []);
    const [title, setTitle] = useState<string>("Manga Reader");
    const {
        setSettingOpen,
        mangaInReader,
        isReaderOpen,
        currentPageNumber,
        scrollToPage,
        setPageNumChangeDisabled,
        pageNumberInputRef,
        closeReader,
    } = useContext(AppContext);
    const setTitleWithSize = () => {
        if (mangaInReader) {
            let mangaName = mangaInReader.mangaName;
            let chapterName = mangaInReader.chapterName;
            if (mangaName.length > 13) mangaName = mangaName.substr(0, 10) + "...";
            if (chapterName.length > 83) chapterName = chapterName.substr(0, 80) + "...";
            const title = mangaName + " | " + chapterName;
            setTitle(title);
            document.title = title;
        }
    };
    useEffect(() => {
        setTitleWithSize();
    }, [mangaInReader]);

    useEffect(() => {
        if (pageNumberInputRef.current && pageNumberInputRef.current) {
            pageNumberInputRef.current.value = currentPageNumber.toString();
        }
    }, [currentPageNumber]);
    return (
        <div id="topBar">
            <div className="titleDragable"></div>
            <div className="homeBtns">
                <button
                    className="home"
                    onClick={() => {
                        closeReader();
                        // window.location.reload();
                    }}
                    tabIndex={-1}
                    data-tooltip="Home"
                >
                    <FontAwesomeIcon icon={faHome} />
                </button>
                <button
                    className="settingsBtn"
                    onClick={() => {
                        setSettingOpen(state => !state);
                    }}
                    tabIndex={-1}
                    data-tooltip="Settings"
                >
                    <FontAwesomeIcon icon={faCog} />
                </button>
                <button
                    className="githubbtn"
                    onClick={() =>
                        window.electron.shell.openExternal("https://github.com/mienaiYami/offline-manga-reader")
                    }
                    tabIndex={-1}
                    data-tooltip="Github"
                >
                    <FontAwesomeIcon icon={faGithub} />
                </button>
            </div>
            <div className="mainTitleCont">
                <div className="title">{title}</div>
            </div>
            <div className="windowBtnCont">
                <label
                    id="pageNumbers"
                    title="Nagivate To Page Number"
                    htmlFor="NavigateToPageInput"
                    data-tooltip="Navigate To Page Number"
                    style={{ visibility: isReaderOpen ? "visible" : "hidden" }}
                >
                    <input
                        type="number"
                        title="Nagivate To Page Number"
                        id="NavigateToPageInput"
                        defaultValue={1}
                        placeholder="Page Num."
                        ref={forwaredRef}
                        onFocus={e => {
                            e.currentTarget.select();
                        }}
                        onBlur={() => {
                            setPageNumChangeDisabled(false);
                        }}
                        onKeyUp={e => {
                            if (/[0-9]/gi.test(e.key) || e.key === "Backspace") {
                                const pagenumber = parseInt(e.currentTarget.value);
                                if (!pagenumber) return;
                                setPageNumChangeDisabled(true);
                                scrollToPage(pagenumber);
                            }
                            if (e.key == "Enter" || e.key == "Escape") {
                                e.currentTarget.blur();
                            }
                            if (e.key === "Enter") {
                                const pagenumber = parseInt(e.currentTarget.value);
                                if (!pagenumber) return;
                                setPageNumChangeDisabled(true);
                                scrollToPage(pagenumber);
                            }
                        }}
                        tabIndex={-1}
                        min="1"
                    />
                    <span className="totalPage">/{mangaInReader?.pages || 0}</span>
                </label>
                <button
                    tabIndex={-1}
                    id="minimizeBtn"
                    title="Minimize"
                    onClick={() => {
                        window.electron.ipcRenderer.send("minimizeApp");
                    }}
                >
                    <FontAwesomeIcon icon={faMinus} />
                </button>
                <button
                    tabIndex={-1}
                    id="maximizeRestoreBtn"
                    title={isMaximized ? "Restore" : "Maximize"}
                    onClick={() => {
                        window.electron.ipcRenderer.send("maximizeRestoreApp");
                    }}
                >
                    <FontAwesomeIcon icon={isMaximized ? faWindowRestore : faWindowMaximize} />
                </button>
                <button
                    tabIndex={-1}
                    id="closeBtn"
                    title="Close"
                    onClick={() => {
                        window.electron.ipcRenderer.send("closeApp");
                    }}
                >
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>
        </div>
    );
});

export default TopBar;
