import React, { ReactElement, useContext, useEffect, useState } from "react";
import { AppContext } from "../App";
import BookmarkTab from "./BookmarkTab";
import HistoryTab from "./HistoryTab";
import LocationsTab from "./LocationsTab";
import Settings from "./Settings";

const Main = ({
    promptSetDefaultLocation,
}: {
    promptSetDefaultLocation: () => void;
}): ReactElement => {
    const {
        appSettings,
        // setAppSettings,
        // isSettingOpen,
        // setSettingOpen,
        // pageNumberInputRef,
    } = useContext(AppContext);
    const [currentLink, setCurrentLink] = useState(appSettings.baseDir);
    useEffect(() => {
        setCurrentLink(appSettings.baseDir);
    }, [appSettings]);
    return (
        <div id="app">
            <div className="tabCont">
                <LocationsTab
                    mangaPath={appSettings.baseDir}
                    currentLink={currentLink}
                    setCurrentLink={setCurrentLink}
                />
                <div className="divider"></div>
                <BookmarkTab />
                <div className="divider"></div>
                <HistoryTab />
            </div>
            <Settings promptSetDefaultLocation={promptSetDefaultLocation} />
        </div>
    );
};

export default Main;
