import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext } from "react";
import { AppContext } from "../App";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const HistoryTab = (): ReactElement => {
    const { history, setHistory, appSettings } = useContext(AppContext);
    return (
        <div
            className="contTab listCont"
            style={{ display: appSettings.showTabs.history ? "flex" : "none" }}
            id="historyTab"
        >
            <h2>
                History
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
                                if (res && res.response === 0) setHistory([]);
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
