import type { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import { faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ListNavigator from "@renderer/components/ListNavigator";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { deleteLibraryItem } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "src/renderer/App";
import { bookmarkLibraryItemsAtProgress, copyPathsToClipboard, getHistoryItemPath } from "../listSelectionActions";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import ListSelectionToolbar from "./ListSelectionToolbar";

const HistoryTab: React.FC = () => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const library = useAppSelector((store) => store.library);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    const { setContextMenuData } = useAppContext();
    const checkboxesEnabled = appSettings.enableClassicListCheckboxes;

    const historyItems = useMemo(() => {
        const items = Object.values(library.items).filter((item) => item?.progress) as LibraryItemWithProgress[];

        let sorted = [...items];

        if (appSettings.historyListSortBy === "name") {
            sorted = sorted.sort((a, b) => window.app.betterSortOrder(a.title, b.title));
        } else {
            sorted = sorted.sort((a, b) => {
                const aDate =
                    a.type === "book"
                        ? new Date(a.progress?.lastReadAt || 0).getTime()
                        : new Date(a.progress?.lastReadAt || 0).getTime();

                const bDate =
                    b.type === "book"
                        ? new Date(b.progress?.lastReadAt || 0).getTime()
                        : new Date(b.progress?.lastReadAt || 0).getTime();

                return bDate - aDate;
            });
        }

        return appSettings.historyListSortType === "inverse" ? [...sorted].reverse() : sorted;
    }, [library.items, appSettings.historyListSortBy, appSettings.historyListSortType]);

    const sourceIds = useMemo(() => historyItems.map((it) => it.link), [historyItems]);
    const selection = useMultiSelect(sourceIds);

    useEffect(() => {
        if (!checkboxesEnabled) selection.clearSelection();
    }, [checkboxesEnabled, selection.clearSelection]);

    const filterHistoryItem = (filter: string, item: LibraryItemWithProgress | BookBookmark | MangaBookmark) => {
        if (!("type" in item)) return false;
        const searchText =
            item.type === "manga"
                ? item.title +
                  (formatUtils.files.test(item.progress?.chapterName || "")
                      ? `${window.path.extname(item.progress?.chapterName || "")}`
                      : "") +
                  "manga|manhua|manhwa|webtoon|webcomic|comic"
                : `${item.title}.epubbook`;

        return new RegExp(filter, "ig").test(searchText);
    };

    const renderHistoryItem = (
        item: LibraryItemWithProgress | BookBookmark | MangaBookmark,
        index: number,
        isSelected: boolean,
    ) =>
        "type" in item && (
            <BookmarkHistoryListItem
                isHistory={true}
                isBookmark={false}
                focused={isSelected}
                link={item.link}
                id={index}
                key={`${item.updatedAt}-${index}`}
                selectionMode={checkboxesEnabled && selection.isSelectionMode}
                isChecked={checkboxesEnabled ? selection.isSelected(item.link) : false}
                onToggleSelected={
                    checkboxesEnabled ? ({ shiftKey }) => selection.toggleItem(item.link, { shiftKey }) : undefined
                }
            />
        );

    const handleCopySelected = useCallback(() => {
        // Fall back to the library link when the item is missing or has no progress.
        copyPathsToClipboard(
            Array.from(selection.selectedIds).map((link) => {
                const item = library.items[link];
                return item?.progress ? getHistoryItemPath(item) : link;
            }),
        );
    }, [library.items, selection.selectedIds]);

    const handleBookmarkSelected = useCallback(() => {
        bookmarkLibraryItemsAtProgress(
            dispatch,
            Array.from(selection.selectedIds).map((link) => library.items[link]),
        );
        selection.clearSelection();
    }, [dispatch, library.items, selection]);

    /**
     * Removes selected history items from the library (mirrors the
     * `removeHistory` context-menu action, in batch). Files on disk remain.
     */
    const handleRemoveSelected = useCallback(() => {
        const links = Array.from(selection.selectedIds);
        if (links.length === 0) return;
        dialogUtils
            .warn({
                title: t("shared.removeFromLibrary.title"),
                message: t("shared.removeFromLibrary.message", { count: links.length }),
                noOption: false,
                buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
                defaultId: 0,
            })
            .then(({ response }) => {
                if (!response) return;
                for (const link of links) {
                    dispatch(deleteLibraryItem({ link }));
                }
                selection.clearSelection();
            });
    }, [dispatch, selection, t, tCommon]);

    if (!appSettings.showTabs.history) {
        return null;
    }

    return (
        <div className="contTab listCont" id="historyTab">
            <h2>{t("classic.history.title")}</h2>

            <ListNavigator.Provider
                items={historyItems}
                filterFn={filterHistoryItem}
                renderItem={renderHistoryItem}
                emptyMessage={t("classic.history.empty")}
                onFilteredItemsChange={(items) => selection.setVisibleOrder(items.map((it) => it.link))}
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
                                    label: t("shared.removeFromLibrary.menu", { count: selection.count }),
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
                                    arrow: appSettings.historyListSortType === "normal" ? "▲ " : "▼ ",
                                    by: appSettings.historyListSortBy.toUpperCase(),
                                })}
                                onClick={(e) => {
                                    const items: Menu.ListItem[] = [
                                        {
                                            label: t("shared.sort.name"),
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        historyListSortBy: "name",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.historyListSortBy === "name",
                                        },
                                        {
                                            label: t("shared.sort.dateUpdated"),
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        historyListSortBy: "date",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.historyListSortBy === "date",
                                        },
                                        window.contextMenu.template.divider(),
                                        {
                                            label: t("shared.sort.ascending"),
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        historyListSortType: "normal",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.historyListSortType === "normal",
                                        },
                                        {
                                            label: t("shared.sort.descending"),
                                            action() {
                                                dispatch(
                                                    setAppSettings({
                                                        historyListSortType: "inverse",
                                                    }),
                                                );
                                            },
                                            selected: appSettings.historyListSortType === "inverse",
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
                            <ListNavigator.SearchInput
                                pageSearch={{ id: "classic-history", priority: PAGE_SEARCH_PRIORITY.home }}
                            />
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

export default HistoryTab;
