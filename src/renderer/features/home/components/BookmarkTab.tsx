import type { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import { faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ListNavigator from "@renderer/components/ListNavigator";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { formatUtils } from "@utils/file";
import { useMemo } from "react";
import { useAppContext } from "src/renderer/App";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const BookmarkTab: React.FC = () => {
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const library = useAppSelector((store) => store.library);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    const { setContextMenuData } = useAppContext();

    const bookmarksArray = useMemo(() => {
        const arr: (BookBookmark | MangaBookmark)[] = [];
        Object.entries(bookmarks.book).forEach(([itemLink, bookmarks]) => {
            bookmarks?.forEach((bookmark) => {
                arr.push({ ...bookmark, itemLink });
            });
        });
        Object.entries(bookmarks.manga).forEach(([itemLink, bookmarks]) => {
            bookmarks?.forEach((bookmark) => {
                arr.push({ ...bookmark, itemLink });
            });
        });

        let sorted = [...arr];

        if (appSettings.bookListSortBy === "name") {
            sorted = sorted.sort((a, b) => {
                const itemA = library.items[a.itemLink];
                const itemB = library.items[b.itemLink];
                if (!itemA || !itemB) return 0;
                return window.app.betterSortOrder(itemA.title, itemB.title);
            });
        } else {
            sorted = sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        return appSettings.bookListSortType === "inverse" ? [...sorted].reverse() : sorted;
    }, [bookmarks, library.items, appSettings.bookListSortBy, appSettings.bookListSortType]);

    const filterBookmark = (filter: string, bookmark: LibraryItemWithProgress | BookBookmark | MangaBookmark) => {
        if ("type" in bookmark) return false;
        const item = library.items[bookmark.itemLink];
        if (!item) return false;

        //"page" in bookmark means it's a manga bookmark not epub

        const searchText =
            item.title +
            (item.progress?.chapterName ? ` ${item.progress.chapterName}` : "") +
            ("page" in bookmark ? "manga|manhua|manhwa|webtoon|webcomic|comic" : "") +
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

    if (!appSettings.showTabs.bookmark) {
        return null;
    }

    return (
        <div className="contTab listCont" id="bookmarksTab">
            <h2>Bookmarks</h2>

            <ListNavigator.Provider
                items={bookmarksArray as (BookBookmark | MangaBookmark)[]}
                filterFn={filterBookmark}
                renderItem={renderBookmarkItem}
                emptyMessage="No Bookmarks"
                onContextMenu={(elem) => elem.dispatchEvent(window.contextMenu.fakeEvent(elem))}
                onSelect={(elem) => elem.click()}
            >
                {appSettings.showSearch && (
                    <div className="tools">
                        <div className="row1">
                            <button
                                data-tooltip={
                                    "Sort: " +
                                    (appSettings.bookListSortType === "normal" ? "▲ " : "▼ ") +
                                    appSettings.bookListSortBy.toUpperCase()
                                }
                                onClick={(e) => {
                                    const items: Menu.ListItem[] = [
                                        {
                                            label: "Name",
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        bookListSortBy: "name",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.bookListSortBy === "name",
                                        },
                                        {
                                            label: "Date Added",
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        bookListSortBy: "date",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.bookListSortBy === "date",
                                        },
                                        window.contextMenu.template.divider(),
                                        {
                                            label: "Ascending",
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        bookListSortType: "normal",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.bookListSortType === "normal",
                                        },
                                        {
                                            label: "Descending",
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        bookListSortType: "inverse",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.bookListSortType === "inverse",
                                        },
                                    ];
                                    setContextMenuData({
                                        clickX: e.currentTarget.getBoundingClientRect().x,
                                        clickY: e.currentTarget.getBoundingClientRect().bottom + 4,
                                        padLeft: true,
                                        items,
                                        focusBackElem: e.currentTarget,
                                    });
                                }}
                            >
                                <FontAwesomeIcon icon={faSort} />
                            </button>
                            <ListNavigator.SearchInput />
                        </div>
                    </div>
                )}
                <div className="location-cont">
                    <ListNavigator.List />
                </div>
            </ListNavigator.Provider>
        </div>
    );
};

export default BookmarkTab;
