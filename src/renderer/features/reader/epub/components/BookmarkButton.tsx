import { faBookmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark as farBookmark } from "@fortawesome/free-regular-svg-icons";
import { addBookmark, removeBookmark } from "@store/bookmarks";
import { useAppDispatch } from "@store/hooks";
import { useAppSelector } from "@store/hooks";
import { getReaderBook } from "@store/reader";
import { dialogUtils } from "@utils/dialog";
import { memo, useEffect, useState } from "react";

const BookmarkButton = memo(
    ({
        addToBookmarkRef,
        setShortcutText,
        makeScrollPos,
    }: {
        addToBookmarkRef: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
        makeScrollPos: (
            callback?: (progress: { chapterName: string; chapterId: string; position: string }) => any,
        ) => void;
    }) => {
        const bookInReader = useAppSelector(getReaderBook);
        const bookmarks = useAppSelector((store) => store.bookmarks);
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
        return (
            <button
                className="ctrl-menu-item"
                data-tooltip="Bookmark"
                ref={addToBookmarkRef}
                onClick={() => {
                    if (!bookInReader || !bookInReader.progress) return;
                    if (bookmarkedId !== null) {
                        return dialogUtils
                            .warn({
                                title: "Warning",
                                message: "Remove - Remove Bookmark\n",
                                noOption: false,
                                buttons: ["Cancel", "Remove"],
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
                        setShortcutText("Bookmark Added");
                    });
                }}
            >
                <FontAwesomeIcon icon={bookmarkedId !== null ? faBookmark : farBookmark} />
            </button>
        );
    },
);

export default BookmarkButton;
