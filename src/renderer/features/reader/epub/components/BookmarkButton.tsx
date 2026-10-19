import { useCommandOwner } from "@features/keybindings";
import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { addBookmark, removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderBook, selectReaderCommandsActive } from "@store/reader";
import { dialogUtils } from "@utils/dialog";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BOOK_BOOKMARK_OWNER_ID, BOOK_READER_OWNER_ID } from "../useBookCommandOwner";

type BookmarkProgress = {
    chapterName: string;
    chapterId: string;
    position: string;
};

/**
 * Side-list bookmark control. Owns the bookmark command so keyboard and the
 * reader context menu run the same operation as the button.
 */
const BookmarkButton = memo(
    ({
        addToBookmarkRef,
        setShortcutText,
        makeScrollPos,
    }: {
        addToBookmarkRef: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
        makeScrollPos: (onCaptured?: (progress: BookmarkProgress) => void) => void;
    }) => {
        const { t } = useTranslation("reader");
        const { t: tDialogs } = useTranslation("dialogs");
        const { t: tCommon } = useTranslation("common");
        const bookInReader = useAppSelector(getReaderBook);
        const bookmarks = useAppSelector((store) => store.bookmarks);
        const commandsActive = useAppSelector(selectReaderCommandsActive);
        const dispatch = useAppDispatch();
        const [bookmarkedId, setBookmarkedId] = useState<number | null>(null);

        useEffect(() => {
            if (bookInReader?.link) {
                setBookmarkedId(
                    bookmarks.book[bookInReader.link]?.find(
                        (b) =>
                            b.itemLink === bookInReader.link &&
                            b.chapterId === bookInReader.progress?.chapterId &&
                            b.position === bookInReader.progress?.position,
                    )?.id || null,
                );
            } else {
                setBookmarkedId(null);
            }
        }, [bookmarks, bookInReader]);

        const handleBookmark = () => {
            if (!bookInReader || !bookInReader.progress) return;
            if (bookmarkedId !== null) {
                void dialogUtils
                    .warn({
                        title: tDialogs("titles.warning"),
                        message: t("dialogs.removeBookmarkBook"),
                        noOption: false,
                        buttons: [tDialogs("buttons.cancel"), tCommon("actions.remove")],
                        defaultId: 0,
                    })
                    .then(({ response }) => {
                        if (response === 1 && bookInReader?.progress) {
                            dispatch(
                                removeBookmark({
                                    itemLink: bookInReader.link,
                                    type: "book",
                                    ids: [bookmarkedId],
                                }),
                            );
                        }
                    });
                return;
            }
            makeScrollPos((progress) => {
                dispatch(
                    addBookmark({
                        type: "book",
                        data: {
                            chapterId: progress.chapterId,
                            position: progress.position,
                            chapterName: progress.chapterName,
                            itemLink: bookInReader.link,
                        },
                    }),
                );
                setShortcutText(t("hud.bookmarkAdded"));
            });
        };

        useCommandOwner({
            ownerId: BOOK_BOOKMARK_OWNER_ID,
            contextKinds: ["bookReader"],
            visible: commandsActive,
            parentOwnerId: BOOK_READER_OWNER_ID,
            handlers: { bookmark: handleBookmark },
        });

        return (
            <button
                className="ctrl-menu-item"
                data-tooltip={t("sideList.bookmark")}
                ref={addToBookmarkRef}
                onClick={handleBookmark}
            >
                <FontAwesomeIcon icon={bookmarkedId !== null ? faBookmark : farBookmark} />
            </button>
        );
    },
);

export default BookmarkButton;
