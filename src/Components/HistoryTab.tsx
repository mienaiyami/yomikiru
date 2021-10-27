import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { forwardRef, ReactElement, useContext } from "react";
import { AppContext } from "../App";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const HistoryTab = forwardRef(
    (
        { historyTabDisplay }: { historyTabDisplay: boolean },
        ref: React.ForwardedRef<HTMLDivElement>
    ): ReactElement => {
        const { history, setHistory } = useContext(AppContext);
        return (
            <div
                className="contTab listCont"
                style={{ display: historyTabDisplay ? "flex" : "none" }}
                id="historyTab"
                ref={ref}
            >
                <h2>
                    History
                    <button
                        onFocus={(e) => e.currentTarget.blur()}
                        onClick={() => {
                            window.electron.dialog
                                .showMessageBox(window.electron.getCurrentWindow(), {
                                    title: "Warning",
                                    type: "warning",
                                    message: "Are you sure you want to clear history",
                                    buttons: ["Yes", "No"],
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
    }
);

export default HistoryTab;
