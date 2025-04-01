import { BookBookmark, MangaBookmark } from "@common/types/db";
import { useAppSelector } from "@store/hooks";
import { getReaderBook, getReaderManga } from "@store/reader";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { useCallback } from "react";
import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";
import ListItem from "src/renderer/components/ListItem";
import ListNavigator from "src/renderer/components/ListNavigator";

const BookmarkList = () => {
    const { setContextMenuData, openInReader } = useAppContext();
    const mangaInReader = useAppSelector(getReaderManga);
    const bookmarksArray: MangaBookmark[] = useAppSelector(
        (store) =>
            [...((mangaInReader && store.bookmarks.manga[mangaInReader.link]) || [])].sort(
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
                if (mangaInReader?.progress?.chapterLink === bookmark.link) {
                    window.app.scrollToPage(bookmark.page, "smooth");
                } else {
                    openInReader(bookmark.link, {
                        mangaPageNumber: bookmark.page,
                    });
                }
            } catch (error) {
                console.error(error);
                dialogUtils.customError({
                    message: "Could not find the chapter for corresponding id.",
                });
            }
        },
        [bookmarksArray, mangaInReader],
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
                window.contextMenu.template.removeBookmark(bookmark.itemLink, bookmark.id, "manga"),
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
    const renderBookmarkItem = (bookmark: MangaBookmark, index: number, isSelected: boolean) => {
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
