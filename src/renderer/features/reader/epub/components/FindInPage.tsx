import { useCommandOwner } from "@features/keybindings";
import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PAGE_SEARCH_PRIORITY, usePageSearchFocus } from "@renderer/hooks/usePageSearchFocus";
import { onWidgetActivateKey } from "@utils/keyboard";
import { memo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BOOK_READER_OWNER_ID } from "../useBookCommandOwner";

/** Owner id for find-in-page Escape; nested under the book reader. */
const BOOK_FIND_OWNER_ID = "book-find-in-page";

/**
 * Book-reader find-in-page field. Registered as the reader-layer page-search
 * target. Escape blurs via a nested bookReader owner so it wins over the
 * book reader's zen-exit. Enter / Shift+Enter stay on the field (next / previous
 * match) via {@link onWidgetActivateKey}; they are not catalog commands. Does not
 * claim searchWidget: that context is for list commands and would steal
 * contextMenu while the field is focused.
 */
const FindInPage = memo(({ findInPage }: { findInPage: (str: string, forward?: boolean) => void }) => {
    const { t } = useTranslation("reader");
    const [findInPageStr, setFindInPageStr] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    usePageSearchFocus(inputRef, {
        id: "reader-book-find",
        contextKinds: ["bookReader"],
        tieOrder: PAGE_SEARCH_PRIORITY.reader,
    });
    useCommandOwner({
        ownerId: BOOK_FIND_OWNER_ID,
        contextKinds: ["bookReader"],
        visible: true,
        parentOwnerId: BOOK_READER_OWNER_ID,
        focusRoot: () => inputRef.current,
        onEscape: () => {
            const input = inputRef.current;
            if (!input || document.activeElement !== input) return false;
            input.blur();
            return true;
        },
    });

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
                    onWidgetActivateKey(e, {
                        enter: () => findInPage(findInPageStr),
                        shiftEnter: () => findInPage(findInPageStr, false),
                    });
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
