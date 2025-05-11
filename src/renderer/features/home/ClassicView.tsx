import { useAppDispatch, useAppSelector } from "@store/hooks";
import LocationsTab from "./components/LocationsTab";
import BookmarkTab from "./components/BookmarkTab";
import HistoryTab from "./components/HistoryTab";
import { setAppSettings } from "@store/appSettings";

const ClassicView: React.FC = () => {
    const dispatch = useAppDispatch();
    const showTabs = useAppSelector((store) => store.appSettings.showTabs);
    const isReaderActive = useAppSelector((store) => store.reader.active);
    return (
        <div
            className="tabCont"
            style={{
                display: isReaderActive ? "none" : "flex",
            }}
        >
            <LocationsTab />
            <div
                className="divider"
                onClick={() =>
                    dispatch(
                        setAppSettings({
                            showTabs: {
                                bookmark: !showTabs.bookmark,
                                history: showTabs.history,
                            },
                        }),
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
                                bookmark: showTabs.bookmark,
                                history: !showTabs.history,
                            },
                        }),
                    )
                }
            >
                <div className="bar"></div>
            </div>
            <HistoryTab />
        </div>
    );
};

export default ClassicView;
