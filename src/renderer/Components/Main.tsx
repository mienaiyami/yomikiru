import { ReactElement, useContext } from "react";
import ContextMenu from "./ContextMenu";
import LoadingScreen from "./LoadingScreen";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { AppContext } from "../App";
import LocationsTab from "@features/home/LocationsTab";
import { setAppSettings } from "@store/appSettings";
import BookmarkTab from "@features/home/BookmarkTab";
import HistoryTab from "@features/home/HistoryTab";
import Settings from "@features/settings/Settings";
import MenuList from "@ui/MenuList";
import InputColorReal from "@ui/InputColorReal";
import AniLogin from "@features/anilist/AniLogin";
import Reader from "@features/reader-image/Reader";
import EPubReader from "@features/reader-epub/EPubReader";

const Main = (): ReactElement => {
    const appSettings = useAppSelector((store) => store.appSettings);
    const isReaderOpen = useAppSelector((store) => store.ui.isOpen.reader);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    const anilistToken = useAppSelector((store) => store.anilist.token);
    const isAniLoginOpen = useAppSelector((store) => store.ui.isOpen.anilist.login);

    const { contextMenuData, optSelectData, colorSelectData } = useContext(AppContext);
    const dispatch = useAppDispatch();

    return (
        <div id="app" className={appSettings.disableListNumbering ? "noListNumbering " : ""}>
            <div
                className="tabCont"
                style={{
                    display: isReaderOpen ? "none" : "flex",
                }}
            >
                <LocationsTab />
                <div
                    className="divider"
                    onClick={() =>
                        dispatch(
                            setAppSettings({
                                showTabs: {
                                    bookmark: !appSettings.showTabs.bookmark,
                                    history: appSettings.showTabs.history,
                                },
                            })
                        )
                    }
                >
                    <div className="bar"></div>
                </div>
                <BookmarkTab />
                <div
                    className="divider"
                    onClick={() =>
                        dispatch(
                            setAppSettings({
                                showTabs: {
                                    bookmark: appSettings.showTabs.bookmark,
                                    history: !appSettings.showTabs.history,
                                },
                            })
                        )
                    }
                >
                    <div className="bar"></div>
                </div>
                <HistoryTab />
            </div>
            <Settings />
            <LoadingScreen />
            {contextMenuData && <ContextMenu />}
            {optSelectData && <MenuList />}
            {colorSelectData && <InputColorReal />}
            {!anilistToken && isAniLoginOpen && <AniLogin />}
            {linkInReader.type === "image" && linkInReader.link !== "" ? <Reader /> : ""}
            {linkInReader.type === "book" && linkInReader.link !== "" ? <EPubReader /> : ""}
        </div>
    );
};

export default Main;
