import { ReactElement, useContext, useEffect, useState } from "react"
import { AppContext } from "../App"
import BookmarkTab from "./BookmarkTab"
import HistoryTab from "./HistoryTab"
import LoadingScreen from "./LoadingScreen"
import LocationsTab from "./LocationsTab"
import Reader from "./Reader"
import Settings from "./Settings"

const Main = ({ promptSetDefaultLocation }: { promptSetDefaultLocation: () => void }): ReactElement => {
    const { appSettings, isReaderOpen, setReaderOpen } = useContext(AppContext)
    const [currentLink, setCurrentLink] = useState(appSettings.baseDir)

    useEffect(() => {
        setCurrentLink(appSettings.baseDir)
    }, [appSettings])
    return (
        <div id="app">
            <div className="tabCont" style={{ display: isReaderOpen ? "none" : "flex" }}>
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
            <LoadingScreen />
            <Reader />
        </div>
    )
}

export default Main
