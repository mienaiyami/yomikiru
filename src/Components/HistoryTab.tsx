import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext } from "react";
import { AppContext } from "../App";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const HistoryTab = (): ReactElement => {
    const { history } = useContext(AppContext);
    return (
        <div className="contTab" id="historyTab">
            <h2>
                History
                <button
                    // onClick="clearHistory()"
                    tabIndex={-1}
                    data-tooltip="Clear All">
                    <FontAwesomeIcon icon={faTrash} />
                </button>
            </h2>
            <div className="location-cont">
                <ol>
                    {history.map(e => (
                        <BookmarkHistoryListItem {...e} />
                    ))}
                </ol>
            </div>
        </div>
    );
};

export default HistoryTab;
