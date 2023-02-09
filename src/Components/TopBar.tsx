import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useLayoutEffect, useState } from "react";
import { faHome, faCog } from "@fortawesome/free-solid-svg-icons";
import { AppContext } from "../App";

const TopBar = (): ReactElement => {
    const [title, setTitle] = useState<string>("Manga Reader");
    const {
        setSettingOpen,
        mangaInReader,
        isReaderOpen,
        setPageNumChangeDisabled,
        pageNumberInputRef,
        closeReader,
    } = useContext(AppContext);
    const setTitleWithSize = () => {
        if (mangaInReader) {
            let mangaName = mangaInReader.mangaName;
            let chapterName = mangaInReader.chapterName;
            if (mangaName.length > 13) mangaName = mangaName.substring(0, 20) + "...";
            if (chapterName.length > 83) chapterName = chapterName.substring(0, 80) + "...";
            const title = mangaName + " | " + chapterName;
            setTitle(chapterName.concat(window.electron.app.isPackaged ? "" : " - dev"));
            document.title = title;
            return;
        }
        setTitle(window.electron.app.name.concat(window.electron.app.isPackaged ? "" : " - dev"));
        document.title = window.electron.app.name;
    };
    useLayoutEffect(() => {
        window.addEventListener("pageNumberChange", () => {
            (document.querySelector("#NavigateToPageInput") as HTMLInputElement).value =
                window.app.currentPageNumber.toString();
        });
    }, []);
    useEffect(() => {
        setTitleWithSize();
    }, [mangaInReader]);

    return (
        <div id="topBar">
            <div className="titleDragable"></div>
            <div className="homeBtns">
                <button
                    className="home"
                    onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => {
                        isReaderOpen ? closeReader() : window.location.reload();
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
                        setSettingOpen((state) => !state);
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
                <label
                    id="pageNumbers"
                    htmlFor="NavigateToPageInput"
                    data-tooltip="Navigate To Page Number"
                    style={{ visibility: isReaderOpen ? "visible" : "hidden" }}
                >
                    <input
                        type="number"
                        id="NavigateToPageInput"
                        defaultValue={1}
                        placeholder="Page Num."
                        ref={pageNumberInputRef}
                        min="1"
                        max={mangaInReader?.pages || 0}
                        onFocus={(e) => {
                            e.currentTarget.select();
                        }}
                        onBlur={() => {
                            setPageNumChangeDisabled(false);
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
                            if (e.key === "Enter") {
                                let pagenumber = parseInt(e.currentTarget.value);
                                if (pagenumber > (mangaInReader?.pages || 0))
                                    pagenumber = mangaInReader?.pages || 0;
                                if (pageNumberInputRef.current && pageNumberInputRef.current) {
                                    pageNumberInputRef.current.value = pagenumber.toString();
                                }
                                if (!pagenumber) return;
                                setPageNumChangeDisabled(true);
                                window.app.scrollToPage(pagenumber, "smooth", () => {
                                    setPageNumChangeDisabled(false);
                                });
                                return;
                            }
                            if (/[0-9]/gi.test(e.key) || e.key === "Backspace") {
                                let pagenumber = parseInt(e.currentTarget.value);
                                if (pagenumber > (mangaInReader?.pages || 0))
                                    pagenumber = mangaInReader?.pages || 0;
                                if (pageNumberInputRef.current && pageNumberInputRef.current) {
                                    pageNumberInputRef.current.value = pagenumber.toString();
                                }
                                if (!pagenumber) return;
                                setPageNumChangeDisabled(true);
                                window.app.scrollToPage(pagenumber);
                                return;
                            }
                            e.preventDefault();
                        }}
                        tabIndex={-1}
                    />
                    <span className="totalPage">/{mangaInReader?.pages || 0}</span>
                </label>
            </div>
        </div>
    );
};

export default TopBar;
