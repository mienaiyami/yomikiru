import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { deleteAllHistory } from "../store/history";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import { useState } from "react";

const HistoryTab = () => {
    const history = useAppSelector((store) => store.history);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();

    const [filter, setFilter] = useState<string>("");
    const List = (historyData: HistoryItem[], filter: string) => {
        return historyData.map((e, i) => {
            if (new RegExp(filter, "ig").test(e.type === "book" ? e.data.title : e.data.mangaName)) {
                return (
                    <BookmarkHistoryListItem
                        isBookmark={false}
                        isHistory={true}
                        index={i}
                        {...e}
                        key={e.data.date}
                    />
                );
            }
        });
    };
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
                                message: "Are you sure you want to clear history?",
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

            {appSettings.showSearch && (
                <div className="tools">
                    <input
                        type="text"
                        name=""
                        spellCheck={false}
                        placeholder="Type to Search"
                        // tabIndex={-1}
                        onChange={(e) => {
                            const val = e.target.value;
                            let filter = "";
                            for (let i = 0; i < val.length; i++) {
                                filter += val[i] + ".*";
                            }
                            setFilter(filter);
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }
                            if (e.key === "Escape") {
                                e.currentTarget.blur();
                            }
                        }}
                    />
                </div>
            )}
            <div className="location-cont">
                {history.length === 0 ? <p>No History...</p> : <ol>{List(history, filter)}</ol>}
            </div>
        </div>
    );
};

export default HistoryTab;
