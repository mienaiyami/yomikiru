import { useMemo } from "react";
import { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import { useAppSelector } from "@store/hooks";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import { formatUtils } from "@utils/file";
import ListTab from "./ListTab";

const BookmarkTab = () => {
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const library = useAppSelector((store) => store.library);
    const appSettings = useAppSelector((store) => store.appSettings);

    const bookmarksArray = useMemo(() => {
        const arr: (BookBookmark | MangaBookmark)[] = [];
        Object.entries(bookmarks.book).forEach(([itemLink, bookmarks]) => {
            bookmarks.forEach((bookmark) => {
                arr.push({ ...bookmark, itemLink });
            });
        });
        Object.entries(bookmarks.manga).forEach(([itemLink, bookmarks]) => {
            bookmarks.forEach((bookmark) => {
                arr.push({ ...bookmark, itemLink });
            });
        });
        return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [bookmarks]);

    const filterBookmark = (filter: string, bookmark: LibraryItemWithProgress | BookBookmark | MangaBookmark) => {
        if ("type" in bookmark) return false;
        const item = library.items[bookmark.itemLink];
        if (!item) return false;

        // todo test
        const searchText =
            item.title +
            (item.progress?.chapterName ? ` ${item.progress.chapterName}` : "") +
            ` ${formatUtils.files.getExt("page" in bookmark ? bookmark.link : bookmark.itemLink)}`;

        return new RegExp(filter, "ig").test(searchText);
    };

    const renderBookmarkItem = (
        bookmark: LibraryItemWithProgress | BookBookmark | MangaBookmark,
        index: number,
        isSelected: boolean,
    ) =>
        "chapterName" in bookmark && (
            <BookmarkHistoryListItem
                isHistory={false}
                isBookmark={true}
                focused={isSelected}
                link={bookmark.itemLink}
                id={bookmark.id}
                bookmark={bookmark}
                key={`${bookmark.id}-${bookmark.itemLink}`}
            />
        );

    return (
        <ListTab
            title="Bookmarks"
            tabId="bookmarksTab"
            isCollapsed={!appSettings.showTabs.bookmark}
            items={bookmarksArray as (BookBookmark | MangaBookmark)[]}
            filterFn={filterBookmark}
            renderItem={renderBookmarkItem}
            emptyMessage="No Bookmarks..."
            onContextMenu={(elem) => elem.dispatchEvent(window.contextMenu.fakeEvent(elem))}
            onSelect={(elem) => elem.click()}
        />
    );
};

export default BookmarkTab;
