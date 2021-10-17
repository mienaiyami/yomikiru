import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement } from "react";

const HistoryTab = (): ReactElement => {
    return (
        <div className="contTab" id="historyTab">
            <h2>
                History
                <button
                    // onClick="clearHistory()"
                    tabIndex={-1}
                    data-tooltip="Clear All"
                >
                    <FontAwesomeIcon icon={faTrash} />
                </button>
            </h2>
            <div className="location-cont">
                <ol></ol>
            </div>
        </div>
    );
};

export default HistoryTab;
