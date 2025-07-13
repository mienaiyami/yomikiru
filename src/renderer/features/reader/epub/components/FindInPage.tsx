import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { memo, useState } from "react";

const FindInPage = memo(({ findInPage }: { findInPage: (str: string, forward?: boolean) => void }) => {
    const [findInPageStr, setFindInPageStr] = useState<string>("");
    return (
        <div className="row1">
            <input
                type="text"
                name=""
                spellCheck={false}
                placeholder="Find In Page (regexp allowed)"
                onChange={(e) => {
                    setFindInPageStr(e.currentTarget.value);
                }}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                        e.currentTarget.blur();
                    }
                    if (e.key === "Enter") {
                        if (e.shiftKey) {
                            findInPage(findInPageStr, false);
                        } else findInPage(findInPageStr);
                    }
                }}
                onBlur={(e) => {
                    if (e.currentTarget.value === "") findInPage("");
                }}
            />
            <button
                data-tooltip="Previous"
                onClick={() => {
                    findInPage(findInPageStr, false);
                }}
            >
                <FontAwesomeIcon icon={faArrowUp} />
            </button>
            <button
                data-tooltip="Next"
                onClick={() => {
                    findInPage(findInPageStr);
                }}
            >
                <FontAwesomeIcon icon={faArrowDown} />
            </button>
        </div>
    );
});

export default FindInPage;
