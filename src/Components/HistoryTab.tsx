import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { deleteAllHistory } from "../store/history";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const HistoryTab = () => {
    const history = useAppSelector((store) => store.history);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    return (
        <div
            className="contTab listCont"
            style={{ display: appSettings.showTabs.history ? "flex" : "none" }}
            id="historyTab"
        >
            <h2>
                Continue Reading
                <button
                    // onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => {
                        window.dialog
                            .warn({
                                title: "Warning",
                                message: "Are you sure you want to clear history",
                                noOption: false,
                            })
                            .then((res) => {
                                if (res && res.response === 0) dispatch(deleteAllHistory());
                            });
                    }}
                    tabIndex={-1}
                    data-tooltip="Clear All"
                >
                    <FontAwesomeIcon icon={faTrash} />
                </button>
            </h2>
            <div className="location-cont">
                {history.length === 0 ? (
                    <p>No History...</p>
                ) : (
                    <ol>
                        {history.map((e, i) => (
                            <BookmarkHistoryListItem
                                isBookmark={false}
                                isHistory={true}
                                index={i}
                                {...e}
                                key={e.date}
                            />
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default HistoryTab;
