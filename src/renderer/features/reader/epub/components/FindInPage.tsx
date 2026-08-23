import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PAGE_SEARCH_PRIORITY, usePageSearchFocus } from "@renderer/hooks/usePageSearchFocus";
import { memo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Book-reader find-in-page field. Registered as the reader-layer page-search target.
 */
const FindInPage = memo(({ findInPage }: { findInPage: (str: string, forward?: boolean) => void }) => {
    const { t } = useTranslation("reader");
    const [findInPageStr, setFindInPageStr] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    usePageSearchFocus(inputRef, { id: "reader-book-find", priority: PAGE_SEARCH_PRIORITY.reader });

    return (
        <div className="row1">
            <input
                ref={inputRef}
                type="text"
                name=""
                spellCheck={false}
                placeholder={t("findInPage.placeholder")}
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
                data-tooltip={t("findInPage.previous")}
                onClick={() => {
                    findInPage(findInPageStr, false);
                }}
            >
                <FontAwesomeIcon icon={faArrowUp} />
            </button>
            <button
                data-tooltip={t("findInPage.next")}
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
