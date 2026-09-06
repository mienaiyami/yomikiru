import {
    faCog,
    faGrip,
    faHome,
    faList,
    faMinus,
    faTimes,
    faWindowMaximize,
    faWindowRestore,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectResolvedItemMetadata } from "@store/library";
import { selectLiveBookReaderSettings } from "@store/reader";
import { setSysBtnColor } from "@store/themes";
import { setSettingsOpen, toggleSettingsOpen } from "@store/ui";
import { formatUtils } from "@utils/file";
import { type ReactElement, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "./App";
import LibraryScanStatusButton from "./components/LibraryScanStatusButton";

const TopBar = (): ReactElement => {
    const { t } = useTranslation("common");
    const [title, setTitle] = useState<string>("Yomikiru");
    const { pageNumberInputRef, bookProgressRef, closeReader } = useAppContext();
    const [isMaximized, setMaximized] = useState(window.electron.currentWindow.isMaximized() || false);
    const [pageNumberChangeDisabled, setPageNumberChangeDisabled] = useState(false);
    const readerContentLink = useAppSelector((store) => store.reader.content?.link ?? "");
    const readerContentType = useAppSelector((store) => store.reader.content?.type ?? null);
    const readerContentTitle = useAppSelector((store) => store.reader.content?.title ?? "");
    const readerChapterName = useAppSelector((store) => store.reader.content?.progress?.chapterName ?? "");
    const readerTotalPages = useAppSelector((store) =>
        store.reader.type === "manga" ? (store.reader.content?.progress?.totalPages ?? 0) : 0,
    );
    const hasContinuousBookProgress = useAppSelector(
        (store) => store.reader.type === "book" && selectLiveBookReaderSettings(store).continuousChapters,
    );
    const readerDisplayTitle = useAppSelector((store) => {
        const contentLink = store.reader.content?.link;
        if (!contentLink) return "";
        // primary resolved title only; the muted original does not fit the title bar
        return selectResolvedItemMetadata(store, contentLink)?.title ?? store.reader.content?.title ?? "";
    });
    // todo: move input to separate component
    const currentPageNumber = useAppSelector((store) => {
        if (store.reader.type === "manga") {
            return store.reader.content?.progress?.currentPage ?? 1;
        }
        return 1;
    });
    const appSettings = useAppSelector((store) => store.appSettings);

    const [pageScrollTimeoutID, setTimeoutID] = useState<NodeJS.Timeout | null>(null);

    const dispatch = useAppDispatch();

    const setTitleWithSize = useCallback(() => {
        if (!readerContentLink) {
            setTitle(window.electron.app.getName().concat(window.electron.app.isPackaged ? "" : " - dev"));
            document.title = window.electron.app.getName();
            return;
        }
        if (readerContentType === "manga") {
            let mangaName = readerDisplayTitle || readerContentTitle;
            let chapterName = formatUtils.files.getName(readerChapterName);
            if (mangaName.length > 13) mangaName = `${mangaName.substring(0, 20)}...`;
            if (chapterName.length > 83) chapterName = `${chapterName.substring(0, 80)}...`;
            const title = `${window.electron.app.getName()} - ${mangaName} | ${chapterName}`;
            setTitle(chapterName.concat(window.electron.app.isPackaged ? "" : " - dev"));
            document.title = title;
            return;
        } else if (readerContentType === "book") {
            let bookTitle = readerDisplayTitle || readerContentTitle;
            let chapterName = "";
            if (readerChapterName !== "~") {
                chapterName = readerChapterName;
                if (chapterName.length > 83) chapterName = `${chapterName.substring(0, 80)}...`;
            }
            if (bookTitle.length > 83) bookTitle = `${bookTitle.substring(0, 80)}...`;
            const title = `${window.electron.app.getName()} - ${bookTitle} ${
                chapterName ? `| ${chapterName}` : ""
            }`;
            setTitle(
                (chapterName ? chapterName : bookTitle).concat(window.electron.app.isPackaged ? "" : " - dev"),
            );
            document.title = title;
            return;
        }
    }, [readerChapterName, readerContentLink, readerContentTitle, readerContentType, readerDisplayTitle]);
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
            listeners.forEach((e) => void e());
        };
    }, []);
    useEffect(() => {
        const pageNumberInput = pageNumberInputRef.current;
        if (!pageNumberChangeDisabled && currentPageNumber) {
            if (pageNumberInput) {
                pageNumberInput.value = currentPageNumber.toString();
            }
        }
    }, [currentPageNumber, pageNumberChangeDisabled, pageNumberInputRef]);
    useEffect(() => {
        setTitleWithSize();
    }, [setTitleWithSize]);

    const viewMode = useAppSelector((store) => store.appSettings.homeViewMode);
    const toggleViewMode = () => {
        dispatch(
            setAppSettings({
                homeViewMode: viewMode === "classic" ? "gallery" : "classic",
            }),
        );
    };

    return (
        <div id="topBar">
            <div className="titleDragable"></div>
            <div className="homeBtns">
                <button
                    className="home"
                    onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => {
                        readerContentLink ? closeReader() : window.location.reload();
                        dispatch(setSettingsOpen(false));
                    }}
                    tabIndex={-1}
                    data-tooltip={t("topBar.home")}
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
                    data-tooltip={t("topBar.settings")}
                >
                    <FontAwesomeIcon icon={faCog} />
                </button>
                <div className="viewToggle">
                    {viewMode === "gallery" ? (
                        <button
                            onClick={toggleViewMode}
                            tabIndex={-1}
                            onFocus={(e) => e.currentTarget.blur()}
                            data-tooltip={t("topBar.listView")}
                        >
                            <FontAwesomeIcon icon={faList} />
                        </button>
                    ) : (
                        <button
                            onClick={toggleViewMode}
                            tabIndex={-1}
                            onFocus={(e) => e.currentTarget.blur()}
                            data-tooltip={t("topBar.galleryView")}
                        >
                            <FontAwesomeIcon icon={faGrip} />
                        </button>
                    )}
                </div>
                <LibraryScanStatusButton />
            </div>
            <div className="mainTitleCont">
                <div className="title">{title}</div>
            </div>
            <div className="windowBtnCont">
                {readerContentType === "manga" && (
                    <label
                        className="pageNumber noBG"
                        htmlFor="NavigateToPageInput"
                        data-tooltip={t("topBar.navigateToPage")}
                    >
                        <input
                            type="number"
                            id="NavigateToPageInput"
                            className="pageNumberInput"
                            defaultValue={1}
                            placeholder={t("topBar.pageNumPlaceholder")}
                            ref={pageNumberInputRef}
                            min="1"
                            max={readerTotalPages}
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
                                        e.key === "Enter" ||
                                        e.key === "Escape"
                                    )
                                )
                                    e.preventDefault();
                            }}
                            onKeyUp={(e) => {
                                if (pageScrollTimeoutID) clearTimeout(pageScrollTimeoutID);
                                if (e.key === "Enter" || e.key === "Escape") {
                                    e.currentTarget.blur();
                                }
                                if (e.key === "Enter") {
                                    let pagenumber = parseInt(e.currentTarget.value);
                                    if (pagenumber > readerTotalPages) pagenumber = readerTotalPages;
                                    if (pageNumberInputRef.current) {
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
                                    if (pagenumber > readerTotalPages) pagenumber = readerTotalPages;
                                    if (pageNumberInputRef.current) {
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
                        <span className="totalPage">/{readerTotalPages}</span>
                    </label>
                )}
                {readerContentType === "book" && (
                    <label className="pageNumber noBG">
                        <input
                            className={`pageNumberInput${hasContinuousBookProgress ? " continuousChapterProgress" : ""}`}
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
                                        /[0-9.]/gi.test(e.key) ||
                                        e.key === "Backspace" ||
                                        e.key === "Enter" ||
                                        e.key === "Escape"
                                    )
                                )
                                    e.preventDefault();
                            }}
                            onKeyUp={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                    e.currentTarget.blur();
                                }
                                if (/[0-9.]/gi.test(e.key) || e.key === "Backspace") {
                                    let percent = Number.parseFloat(e.currentTarget.value);
                                    if (!Number.isFinite(percent)) return;
                                    if (percent > 100) percent = 100;
                                    if (percent < 0) percent = 0;
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
                            title={t("topBar.minimize")}
                            onFocus={(e) => e.currentTarget.blur()}
                            onClick={() => window.electron.currentWindow.minimize()}
                        >
                            <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button
                            tabIndex={-1}
                            id="maximizeRestoreBtn"
                            onFocus={(e) => e.currentTarget.blur()}
                            title={isMaximized ? t("topBar.restore") : t("topBar.maximize")}
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
                            title={t("topBar.close")}
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
