import type { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import { faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ListNavigator from "@renderer/components/ListNavigator";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "src/renderer/App";
import {
    bookmarkLibraryItemsAtProgress,
    copyPathsToClipboard,
    getBookmarkItemPath,
    getBookmarkSelectionKey,
    getBookmarksBySelectionKeys,
    removeBookmarksGrouped,
} from "../listSelectionActions";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import ListSelectionToolbar from "./ListSelectionToolbar";

const BookmarkTab: React.FC = () => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
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

    const sourceIds = useMemo(() => bookmarksArray.map(getBookmarkSelectionKey), [bookmarksArray]);
    const selection = useMultiSelect(sourceIds);

    useEffect(() => {
        if (!checkboxesEnabled) selection.clearSelection();
    }, [checkboxesEnabled, selection.clearSelection]);

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
                isChecked={checkboxesEnabled ? selection.isSelected(getBookmarkSelectionKey(bookmark)) : false}
                onToggleSelected={
                    checkboxesEnabled
                        ? ({ shiftKey }) => selection.toggleItem(getBookmarkSelectionKey(bookmark), { shiftKey })
                        : undefined
                }
            />
        );

    const handleCopySelected = useCallback(() => {
        copyPathsToClipboard(
            getBookmarksBySelectionKeys(bookmarksArray, selection.selectedIds).map(getBookmarkItemPath),
        );
    }, [bookmarksArray, selection.selectedIds]);

    const handleBookmarkSelected = useCallback(() => {
        bookmarkLibraryItemsAtProgress(
            dispatch,
            getBookmarksBySelectionKeys(bookmarksArray, selection.selectedIds).map(
                (bookmark) => library.items[bookmark.itemLink],
            ),
        );
        selection.clearSelection();
    }, [bookmarksArray, dispatch, library.items, selection]);

    /**
     * Removes every bookmark whose selection key is in the current selection,
     * grouped by `(itemLink, type)` so we issue one IPC call per parent item.
     */
    const handleRemoveSelected = useCallback(() => {
        const selected = getBookmarksBySelectionKeys(bookmarksArray, selection.selectedIds);
        if (selected.length === 0) return;

        dialogUtils
            .warn({
                title: t("classic.bookmarks.removeTitle"),
                message: t("classic.bookmarks.removeMessage", { count: selected.length }),
                noOption: false,
                buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
                defaultId: 0,
            })
            .then(({ response }) => {
                if (!response) return;
                removeBookmarksGrouped(dispatch, selected);
                selection.clearSelection();
            });
    }, [bookmarksArray, dispatch, selection, t, tCommon]);

    if (!appSettings.showTabs.bookmark) {
        return null;
    }

    return (
        <div className="contTab listCont" id="bookmarksTab">
            <h2>{t("classic.bookmarks.title")}</h2>

            <ListNavigator.Provider
                items={bookmarksArray as (BookBookmark | MangaBookmark)[]}
                filterFn={filterBookmark}
                renderItem={renderBookmarkItem}
                emptyMessage={t("classic.bookmarks.empty")}
                onFilteredItemsChange={(items) => selection.setVisibleOrder(items.map(getBookmarkSelectionKey))}
                onContextMenu={(elem) => elem.dispatchEvent(window.contextMenu.fakeEvent(elem))}
                onSelect={(elem) => elem.click()}
            >
                {checkboxesEnabled && selection.isSelectionMode && (
                    <div className="tools">
                        <ListSelectionToolbar
                            count={selection.count}
                            onSelectAll={selection.selectAll}
                            onInvertSelection={selection.invertSelection}
                            onCancel={selection.clearSelection}
                            showInvertButton={false}
                            extraMenuItems={[
                                {
                                    label: t("shared.selection.copyPath"),
                                    action: handleCopySelected,
                                },
                                {
                                    label: t("shared.selection.bookmark"),
                                    action: handleBookmarkSelected,
                                },
                                {
                                    label: t("classic.bookmarks.removeMenu", { count: selection.count }),
                                    action: handleRemoveSelected,
                                },
                            ]}
                        />
                    </div>
                )}
                {!selection.isSelectionMode && appSettings.showSearch && (
                    <div className="tools">
                        <div className="row1">
                            <button
                                data-tooltip={t("shared.sort.tooltip", {
                                    arrow: appSettings.bookListSortType === "normal" ? "▲ " : "▼ ",
                                    by: appSettings.bookListSortBy.toUpperCase(),
                                })}
                                onClick={(e) => {
                                    const items: Menu.ListItem[] = [
                                        {
                                            label: t("shared.sort.name"),
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
                                            label: t("shared.sort.dateAdded"),
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
                                            label: t("shared.sort.ascending"),
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
                                            label: t("shared.sort.descending"),
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
