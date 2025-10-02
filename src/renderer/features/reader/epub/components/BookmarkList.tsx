import type { BookBookmark } from "@common/types/db";
import ListItem from "@renderer/components/ListItem";
import ListNavigator from "@renderer/components/ListNavigator";
import { useAppSelector } from "@store/hooks";
import { getReaderBook } from "@store/reader";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { useCallback } from "react";
import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";

const BookmarkList: React.FC<{
    openChapterById: (chapterId: string, position?: string) => void;
}> = ({ openChapterById }) => {
    const { setContextMenuData } = useAppContext();
    const bookInReader = useAppSelector(getReaderBook);
    const bookmarksArray: BookBookmark[] = useAppSelector(
        (store) =>
            [...((bookInReader && store.bookmarks.book[bookInReader.link]) || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
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
                console.error(error);
                dialogUtils.customError({
                    message: "Could not find the chapter for corresponding id.",
                });
            }
        },
        [bookmarksArray, bookInReader, openChapterById],
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
                    message: "Could not find the chapter for corresponding id.",
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
        [bookmarksArray, setContextMenuData],
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
                emptyMessage="No Bookmarks"
            >
                <ListNavigator.List />
            </ListNavigator.Provider>
        </div>
    );
};

export default BookmarkList;
