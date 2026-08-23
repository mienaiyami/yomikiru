import type { BookBookmark } from "@common/types/db";
import ListItem from "@renderer/components/ListItem";
import ListNavigator from "@renderer/components/ListNavigator";
import { useAppSelector } from "@store/hooks";
import { getReaderBook } from "@store/reader";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { createRendererLogger } from "@utils/logger";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("epub/BookmarkList");

import { useAppContext } from "src/renderer/App";

/** Stable fallback keeps an absent bookmark map from invalidating the selector result. */
const EMPTY_BOOK_BOOKMARKS: readonly BookBookmark[] = [];

const BookmarkList: React.FC<{
    openChapterById: (chapterId: string, position?: string) => void;
}> = ({ openChapterById }) => {
    const { t } = useTranslation("reader");
    const { setContextMenuData } = useAppContext();
    const bookInReader = useAppSelector(getReaderBook);
    const bookmarks = useAppSelector((store) =>
        bookInReader ? (store.bookmarks.book[bookInReader.link] ?? EMPTY_BOOK_BOOKMARKS) : EMPTY_BOOK_BOOKMARKS,
    );
    const bookmarksArray = useMemo(
        () => [...bookmarks].sort((b, a) => a.createdAt.getTime() - b.createdAt.getTime()),
        [bookmarks],
    );
    const handleBookmarkClick = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const bookmarkId = Number(e.currentTarget.getAttribute("data-bookmark-id"));
                if (isNaN(bookmarkId)) throw new Error("Invalid bookmark id");
                const bookmark = bookmarksArray.find((b) => b.id === bookmarkId);
                if (!bookmark) throw new Error("Bookmark not found");
                openChapterById(bookmark.chapterId, bookmark.position);
            } catch (error) {
                log.error("navigate to chapter failed", error);
                dialogUtils.customError({
                    message: t("errors.chapterIdNotFound"),
                });
            }
        },
        [bookmarksArray, openChapterById, t],
    );
    const handleBookmarkContextMenu = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const bookmarkId = Number(e.currentTarget.getAttribute("data-bookmark-id"));
            if (isNaN(bookmarkId)) return;
            const bookmark = bookmarksArray.find((b) => b.id === bookmarkId);
            if (!bookmark) {
                dialogUtils.customError({
                    message: t("errors.chapterIdNotFound"),
                });
                return;
            }
            const items: Menu.ListItem[] = [
                window.contextMenu.template.removeBookmark(bookmark.itemLink, bookmark.id, "book", true),
            ];
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                focusBackElem: e.nativeEvent.relatedTarget,
                items,
            });
        },
        [bookmarksArray, setContextMenuData, t],
    );
    const renderBookmarkItem = (bookmark: BookBookmark, _index: number, isSelected: boolean) => {
        return (
            <ListItem
                focused={isSelected}
                title={bookmark.chapterName}
                key={bookmark.id}
                onClick={handleBookmarkClick}
                onContextMenu={handleBookmarkContextMenu}
                dataAttributes={{
                    "data-bookmark-id": bookmark.id.toString(),
                }}
            >
                <span className="text">{bookmark.chapterName}</span>
                <span className="date" title={bookmark.createdAt.toString()}>
                    {dateUtils.format(bookmark.createdAt, {
                        format: dateUtils.presets.dateTime,
                    })}
                </span>
            </ListItem>
        );
    };

    return (
        <div className="location-cont">
            <ListNavigator.Provider
                items={bookmarksArray}
                renderItem={renderBookmarkItem}
                emptyMessage={t("sideList.noBookmarks")}
            >
                <ListNavigator.List />
            </ListNavigator.Provider>
        </div>
    );
};

export default BookmarkList;
