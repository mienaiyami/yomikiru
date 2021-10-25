import { createContext, ReactElement, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
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
    return (
        <MainContext.Provider value={{ showContextMenu, isContextMenuOpen, setInfoOnHover }}>
            <div id="app">
                <div className="tabCont" style={{ display: isReaderOpen ? "none" : "flex" }}>
                    <LocationsTab
                        mangaPath={appSettings.baseDir}
                        currentLink={currentLink}
                        setCurrentLink={setCurrentLink}
                    />
                    <div className="divider" onClick={() => setBookmarkTabDisplay((i) => !i)}>
                        <div className="bar"></div>
                    </div>
                    {bookmarkTabDisplay ? <BookmarkTab /> : ""}
                    <div className="divider" onClick={() => setHistoryTabDisplay((i) => !i)}>
                        <div className="bar"></div>
                    </div>
                    {historyTabDisplay ? <HistoryTab /> : ""}
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
