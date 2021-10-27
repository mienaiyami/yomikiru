/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, {
    createContext,
    ReactElement,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { AppContext } from "../App";
import BookmarkTab from "./BookmarkTab";
import ContextMenu from "./ContextMenu";
import HistoryTab from "./HistoryTab";
import InfoOnHover from "./InfoOnHover";
import LoadingScreen from "./LoadingScreen";
import LocationsTab from "./LocationsTab";
import Reader from "./Reader";
import Settings from "./Settings";

interface IhoverInfo {
    item: { chapterName: string; mangaName: string; pages: number; date: string };
    y: number;
    parent: string;
}

interface IMainContext {
    showContextMenu: (data: IContextMenuData) => void;
    isContextMenuOpen: boolean;
    setInfoOnHover: React.Dispatch<React.SetStateAction<IhoverInfo | null>>;
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const MainContext = createContext<IMainContext>();

const Main = ({ promptSetDefaultLocation }: { promptSetDefaultLocation: () => void }): ReactElement => {
    const { appSettings, isReaderOpen, linkInReader } = useContext(AppContext);
    const [currentLink, setCurrentLink] = useState(appSettings.baseDir);
    const [bookmarkTabDisplay, setBookmarkTabDisplay] = useState(true);
    const [historyTabDisplay, setHistoryTabDisplay] = useState(true);
    const [infoOnHover, setInfoOnHover] = useState<IhoverInfo | null>(null);
    const [isContextMenuOpen, setContextMenuOpen] = useState(false);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [contextMenuData, setContextMenuData] = useState<IContextMenuData | null>(null);
    const bookmarkTabRef = useRef<HTMLDivElement>(null);
    const historyTabRef = useRef<HTMLDivElement>(null);
    const locationTabRef = useRef<HTMLDivElement>(null);
    const tabContRef = useRef<HTMLDivElement>(null);
    // const [gridTemplate, setGridTemplate] = useState<string>("");
    const [dividerWidth, setDividerWidth] = useState<number>(0);
    const showContextMenu = (data: IContextMenuData) => {
        setContextMenuData(data);
        setContextMenuOpen(true);
    };
    const closeContextMenu = () => {
        setContextMenuData(null);
        setContextMenuOpen(false);
    };
    useLayoutEffect(() => {
        document.addEventListener("click", () => setInfoOnHover(null));
        document.addEventListener("resize", () => setInfoOnHover(null));
    }, []);
    useEffect(() => {
        setInfoOnHover(null);
    }, [linkInReader]);
    //! did i really wasted time on this
    //
    //
    // const toggleTab = (whichTab: "bookmark" | "history") => {
    //     const gridTemplate = window.getComputedStyle(tabContRef.current!).gridTemplateColumns;
    //     let init1 = parseFloat(gridTemplate.split(" ")[0]);
    //     let init2 = parseFloat(gridTemplate.split(" ")[2]);
    //     let init3 = parseFloat(gridTemplate.split(" ")[4]);
    //     const maxWidth =
    //         (tabContRef.current!.offsetWidth - 2 * dividerWidth) / (+!!bookmarkTabDisplay + +!!historyTabDisplay);
    //     const speed = 30 / (+!!bookmarkTabDisplay + +!!historyTabDisplay);
    //     let displayState;
    //     let elem: HTMLDivElement;
    //     let setDisplayState: (value: React.SetStateAction<boolean>) => void;
    //     let returnAfter = false;
    //     if (whichTab === "bookmark") displayState = bookmarkTabDisplay;
    //     if (whichTab === "history") displayState = historyTabDisplay;
    //     if (whichTab === "bookmark") setDisplayState = setBookmarkTabDisplay;
    //     if (whichTab === "history") setDisplayState = setHistoryTabDisplay;
    //     if (whichTab === "bookmark") elem = bookmarkTabRef.current!;
    //     if (whichTab === "history") elem = historyTabRef.current!;
    //     if (displayState) {
    //         const animate = () => {
    //             if (init1 < maxWidth) init1 = init1 + speed > maxWidth ? maxWidth : init1 + speed;
    //             if (whichTab === "bookmark") {
    //                 if (init2 > 0) init2 = init2 - speed < 0 ? 0 : init2 - speed;
    //                 if (historyTabDisplay) {
    //                     if (init3 < maxWidth) init3 = init3 + speed >= maxWidth ? maxWidth : init3 + speed;
    //                     if (init2 <= 0 && init1 >= maxWidth && init3 >= maxWidth) {
    //                         setDisplayState(false);
    //                         returnAfter = true;
    //                     }
    //                 } else {
    //                     if (init2 <= 0 && init1 >= maxWidth) {
    //                         setDisplayState(false);
    //                         returnAfter = true;
    //                     }
    //                 }
    //             }
    //             if (whichTab === "history") {
    //                 if (init3 > 0) init3 = init3 - speed < 0 ? 0 : init3 - speed;
    //                 if (bookmarkTabDisplay) {
    //                     if (init2 < maxWidth) init2 = init2 + speed >= maxWidth ? maxWidth : init2 + speed;
    //                     if (init3 <= 0 && init1 >= maxWidth && init2 >= maxWidth) {
    //                         setDisplayState(false);
    //                         returnAfter = true;
    //                     }
    //                 } else {
    //                     if (init1 <= 0 && init1 >= maxWidth) {
    //                         setDisplayState(false);
    //                         returnAfter = true;
    //                     }
    //                 }
    //             }
    //             const gridtemp = `${init1}px ${dividerWidth}px ${init2}px ${dividerWidth}px ${init3}px`;
    //             tabContRef.current!.style.gridTemplateColumns = gridtemp;
    //             if (returnAfter) return;
    //             requestAnimationFrame(animate);
    //         };
    //         requestAnimationFrame(animate);
    //     } else {
    //         const animate = () => {
    //             if (init1 < maxWidth) init1 = init1 + speed > maxWidth ? maxWidth : init1 + speed;
    //             if (whichTab === "bookmark") {
    //                 if (init2 > 0) init2 = init2 - speed < 0 ? 0 : init2 - speed;
    //                 if (historyTabDisplay) {
    //                     if (init3 < maxWidth) init3 = init3 + speed > maxWidth ? maxWidth : init3 + speed;
    //                     if (init2 <= 0 && init1 >= maxWidth && init3 >= maxWidth) {
    //                         setDisplayState(true);
    //                         return;
    //                     }
    //                 } else {
    //                     if (init2 <= 0 && init1 >= maxWidth) {
    //                         setDisplayState(true);
    //                         return;
    //                     }
    //                 }
    //             }
    //             if (whichTab === "history") {
    //                 if (init3 > 0) init3 = init3 - speed < 0 ? 0 : init3 - speed;
    //                 if (bookmarkTabDisplay) {
    //                     if (init2 < maxWidth) init2 = init2 + speed > maxWidth ? maxWidth : init2 + speed;
    //                     if (init3 <= 0 && init1 >= maxWidth && init2 >= maxWidth) {
    //                         setDisplayState(true);
    //                         return;
    //                     }
    //                 } else {
    //                     if (init1 <= 0 && init1 >= maxWidth) {
    //                         setDisplayState(true);
    //                         return;
    //                     }
    //                 }
    //             }
    //             const gridtemp = `${init1}px ${dividerWidth}px ${init2}px ${dividerWidth}px ${init3}px`;
    //             tabContRef.current!.style.gridTemplateColumns = gridtemp;
    //             requestAnimationFrame(animate);
    //         };
    //         requestAnimationFrame(animate);
    //     }
    // };
    //!i really didnt need this
    //!why did i do this
    //
    const toggleTab = (whichTab?: "bookmark" | "history") => {
        const width1 = (tabContRef.current!.offsetWidth - 2 * dividerWidth) / 3;
        const width2 = (tabContRef.current!.offsetWidth - 2 * dividerWidth) / 2;
        const width3 = tabContRef.current!.offsetWidth - 2 * dividerWidth;
        const maxWidth =
            (tabContRef.current!.offsetWidth - 2 * dividerWidth) / (+!!bookmarkTabDisplay + +!!historyTabDisplay);
        const minWidth = bookmarkTabDisplay || historyTabDisplay ? width1 : width2;
        const speed = 150 / (+!!bookmarkTabDisplay + +!!historyTabDisplay);
        const speed2 = 150 / (1 + +!!bookmarkTabDisplay + +!!historyTabDisplay);
        let init1 =
            bookmarkTabDisplay && historyTabDisplay
                ? width1
                : bookmarkTabDisplay || historyTabDisplay
                ? width2
                : width3;
        let init2 = bookmarkTabDisplay ? (historyTabDisplay ? width1 : width2) : 0;
        let init3 = historyTabDisplay ? (bookmarkTabDisplay ? width1 : width2) : 0;
        let displayState;
        let elem: HTMLDivElement;
        let setDisplayState: (value: React.SetStateAction<boolean>) => void;
        if (whichTab === "bookmark") displayState = bookmarkTabDisplay;
        if (whichTab === "history") displayState = historyTabDisplay;
        if (whichTab === "bookmark") setDisplayState = setBookmarkTabDisplay;
        if (whichTab === "history") setDisplayState = setHistoryTabDisplay;
        if (whichTab === "bookmark") elem = bookmarkTabRef.current!;
        if (whichTab === "history") elem = historyTabRef.current!;
        if (elem!) {
            if (displayState) {
                const animate = () => {
                    if (whichTab === "bookmark") {
                        init2 = init2 - speed < 0 ? 0 : init2 - speed;
                        bookmarkTabRef.current!.style.flexBasis = init2 + "px";
                        init1 = init1 + speed > maxWidth ? maxWidth : init1 + speed;
                        locationTabRef.current!.style.flexBasis = init1 + "px";
                        if (historyTabDisplay) {
                            init3 = init3 + speed > maxWidth ? maxWidth : init3 + speed;
                            historyTabRef.current!.style.flexBasis = init3 + "px";
                            if (init2 <= 0 && init1 >= maxWidth && init3 >= maxWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                historyTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                setDisplayState(false);
                                return;
                            }
                        } else {
                            if (init2 <= 0 && init1 >= maxWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 1)";
                                setDisplayState(false);
                                return;
                            }
                        }
                    }
                    if (whichTab === "history") {
                        init3 = init3 - speed < 0 ? 0 : init3 - speed;
                        historyTabRef.current!.style.flexBasis = init3 + "px";
                        init1 = init1 + speed > maxWidth ? maxWidth : init1 + speed;
                        locationTabRef.current!.style.flexBasis = init1 + "px";
                        if (bookmarkTabDisplay) {
                            init2 = init2 + speed > maxWidth ? maxWidth : init2 + speed;
                            bookmarkTabRef.current!.style.flexBasis = init2 + "px";
                            if (init3 <= 0 && init1 >= maxWidth && init2 >= maxWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                bookmarkTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                setDisplayState(false);
                                return;
                            }
                        } else {
                            if (init3 <= 0 && init1 >= maxWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 1)";
                                setDisplayState(false);
                                return;
                            }
                        }
                    }
                    requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            } else {
                setDisplayState!(true);
                const animate = () => {
                    if (whichTab === "bookmark") {
                        init2 = init2 + speed2 > minWidth ? minWidth : init2 + speed2;
                        bookmarkTabRef.current!.style.flexBasis = init2 + "px";
                        init1 = init1 - speed2 < minWidth ? minWidth : init1 - speed2;
                        locationTabRef.current!.style.flexBasis = init1 + "px";
                        if (historyTabDisplay) {
                            init3 = init3 - speed2 < minWidth ? minWidth : init3 - speed2;
                            historyTabRef.current!.style.flexBasis = init3 + "px";
                            if (init2 >= minWidth && init1 >= minWidth && init3 >= minWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 3)";
                                historyTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 3)";
                                bookmarkTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 3)";
                                return;
                            }
                        } else {
                            if (init2 >= minWidth && init1 >= minWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                bookmarkTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                return;
                            }
                        }
                    }
                    if (whichTab === "history") {
                        init3 = init3 + speed2 > minWidth ? minWidth : init3 + speed2;
                        historyTabRef.current!.style.flexBasis = init3 + "px";
                        init1 = init1 - speed2 < minWidth ? minWidth : init1 - speed2;
                        locationTabRef.current!.style.flexBasis = init1 + "px";
                        if (bookmarkTabDisplay) {
                            init2 = init2 - speed2 < minWidth ? minWidth : init2 - speed2;
                            bookmarkTabRef.current!.style.flexBasis = init2 + "px";
                            if (init3 >= minWidth && init1 >= minWidth && init3 >= minWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 3)";
                                historyTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 3)";
                                bookmarkTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 3)";
                                return;
                            }
                        } else {
                            if (init3 >= minWidth && init1 >= minWidth) {
                                locationTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                historyTabRef.current!.style.flexBasis =
                                    "calc((100% - 2 * (var(--divider-width))) / 2)";
                                return;
                            }
                        }
                    }
                    requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }
        }
    };
    useLayoutEffect(() => {
        if (tabContRef.current) {
            setDividerWidth(
                parseInt(window.getComputedStyle(tabContRef.current).getPropertyValue("--divider-width"))
            );
        }
    }, []);
    return (
        <MainContext.Provider value={{ showContextMenu, isContextMenuOpen, setInfoOnHover }}>
            <div id="app">
                <div className="tabCont" ref={tabContRef} style={{ display: isReaderOpen ? "none" : "flex" }}>
                    <LocationsTab
                        mangaPath={appSettings.baseDir}
                        currentLink={currentLink}
                        setCurrentLink={setCurrentLink}
                        ref={locationTabRef}
                    />
                    <div className="divider" onClick={() => toggleTab("bookmark")}>
                        <div className="bar"></div>
                    </div>
                    <BookmarkTab bookmarkTabDisplay={bookmarkTabDisplay} ref={bookmarkTabRef} />
                    <div className="divider" onClick={() => toggleTab("history")}>
                        <div className="bar"></div>
                    </div>
                    <HistoryTab historyTabDisplay={historyTabDisplay} ref={historyTabRef} />
                </div>
                <Settings promptSetDefaultLocation={promptSetDefaultLocation} />
                <LoadingScreen />
                {isContextMenuOpen ? (
                    contextMenuData ? (
                        <ContextMenu
                            {...contextMenuData}
                            closeContextMenu={closeContextMenu}
                            realRef={contextMenuRef}
                            ref={contextMenuRef}
                        />
                    ) : null
                ) : (
                    ""
                )}
                {infoOnHover ? <InfoOnHover {...infoOnHover} /> : ""}
                {linkInReader !== "" ? <Reader /> : ""}
            </div>
        </MainContext.Provider>
    );
};

export default Main;
