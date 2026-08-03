import type { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import { faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ListNavigator from "@renderer/components/ListNavigator";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { setAppSettings } from "@store/appSettings";
import { removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { useCallback, useEffect, useMemo } from "react";
import { useAppContext } from "src/renderer/App";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import ListSelectionToolbar from "./ListSelectionToolbar";

const BookmarkTab: React.FC = () => {
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const library = useAppSelector((store) => store.library);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    const { setContextMenuData } = useAppContext();
    const checkboxesEnabled = appSettings.enableClassicListCheckboxes;

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

    const visibleIds = useMemo(() => bookmarksArray.map((b) => b.id), [bookmarksArray]);
    const selection = useMultiSelect<number>(visibleIds);

    useEffect(() => {
        if (!checkboxesEnabled) selection.clearSelection();
    }, [checkboxesEnabled, selection]);

    const filterBookmark = (filter: string, bookmark: LibraryItemWithProgress | BookBookmark | MangaBookmark) => {
        if ("type" in bookmark) return false;
        const item = library.items[bookmark.itemLink];
        if (!item) return false;

        //"page" in bookmark means it's a manga bookmark not epub

        const searchText =
            item.title +
            (item.progress?.chapterName ? ` ${item.progress.chapterName}` : "") +
            ("page" in bookmark ? "manga|manhua|manhwa|webtoon|webcomic|comic" : "") +
            ` ${formatUtils.files.getExt("page" in bookmark ? bookmark.chapterName : bookmark.itemLink)}`;

        return new RegExp(filter, "ig").test(searchText);
    };

    const renderBookmarkItem = (
        bookmark: LibraryItemWithProgress | BookBookmark | MangaBookmark,
        _index: number,
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
                selectionMode={checkboxesEnabled && selection.isSelectionMode}
                isChecked={checkboxesEnabled ? selection.isSelected(bookmark.id) : false}
                onToggleSelected={
                    checkboxesEnabled
                        ? ({ shiftKey }) => selection.toggleItem(bookmark.id, { shiftKey })
                        : undefined
                }
            />
        );

    /**
     * Bulk-deletes every bookmark whose id is in the current selection,
     * grouped by `(itemLink, type)` so we issue one IPC call per parent item.
     */
    const handleDeleteSelected = useCallback(() => {
        const ids = Array.from(selection.selectedIds);
        if (ids.length === 0) return;

        const bookmarkById = new Map<number, BookBookmark | MangaBookmark>();
        for (const b of bookmarksArray) bookmarkById.set(b.id, b);

        dialogUtils
            .warn({
                title: "Delete Bookmarks",
                message: `Delete ${ids.length} bookmark${ids.length === 1 ? "" : "s"}?`,
                noOption: false,
                buttons: ["Cancel", "Yes"],
                defaultId: 0,
            })
            .then(({ response }) => {
                if (!response) return;
                const grouped = new Map<string, { type: "manga" | "book"; ids: number[] }>();
                for (const id of ids) {
                    const b = bookmarkById.get(id);
                    if (!b) continue;
                    const type: "manga" | "book" = "page" in b ? "manga" : "book";
                    const key = `${type}::${b.itemLink}`;
                    const existing = grouped.get(key);
                    if (existing) existing.ids.push(id);
                    else grouped.set(key, { type, ids: [id] });
                }
                for (const [key, value] of grouped) {
                    const itemLink = key.slice(value.type.length + 2);
                    dispatch(removeBookmark({ itemLink, type: value.type, ids: value.ids }));
                }
                selection.clearSelection();
            });
    }, [bookmarksArray, dispatch, selection]);

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
                {checkboxesEnabled && selection.isSelectionMode && (
                    <div className="tools">
                        <ListSelectionToolbar
                            count={selection.count}
                            onSelectAll={() => selection.selectAll(visibleIds)}
                            onInvertSelection={() => selection.invertSelection(visibleIds)}
                            onCancel={selection.clearSelection}
                            extraMenuItems={[
                                {
                                    label: `Delete ${selection.count} Bookmark${selection.count === 1 ? "" : "s"}`,
                                    action: handleDeleteSelected,
                                },
                            ]}
                        />
                    </div>
                )}
                {!selection.isSelectionMode && appSettings.showSearch && (
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
