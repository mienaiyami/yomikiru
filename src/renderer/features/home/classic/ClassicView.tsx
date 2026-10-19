import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import BookmarkTab from "./components/BookmarkTab";
import HistoryTab from "./components/HistoryTab";
import LocationsTab from "./components/LocationsTab";

const ClassicView: React.FC = () => {
    const dispatch = useAppDispatch();
    const showTabs = useAppSelector((store) => store.appSettings.showTabs);
    return (
        <div className="tabCont">
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
