import { useAppSelector, useAppDispatch } from "@store/hooks";
import { useMemo } from "react";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import { formatUtils } from "@utils/file";
import { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import ListNavigator from "../../components/ListNavigator";
import { faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setAppSettings } from "@store/appSettings";
import { useAppContext } from "src/renderer/App";

const HistoryTab: React.FC = () => {
    const library = useAppSelector((store) => store.library);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    const { setContextMenuData } = useAppContext();

    const historyItems = useMemo(() => {
        const items = Object.values(library.items).filter(
            (item) => item && item.progress,
        ) as LibraryItemWithProgress[];

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

    const filterHistoryItem = (filter: string, item: LibraryItemWithProgress | BookBookmark | MangaBookmark) => {
        if (!("type" in item)) return false;
        const searchText =
            item.type === "manga"
                ? item.title +
                  (formatUtils.files.test(item.progress?.chapterName || "")
                      ? `${window.path.extname(item.progress?.chapterName || "")}`
                      : "")
                : item.title + ".epub";

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
            />
        );

    if (!appSettings.showTabs.history) {
        return null;
    }

    return (
        <div className="contTab listCont" id="historyTab">
            <h2>Continue Reading</h2>

            <ListNavigator.Provider
                items={historyItems}
                filterFn={filterHistoryItem}
                renderItem={renderHistoryItem}
                emptyMessage="Library Empty"
                onContextMenu={(elem) => elem.dispatchEvent(window.contextMenu.fakeEvent(elem))}
                onSelect={(elem) => elem.click()}
            >
                {appSettings.showSearch && (
                    <div className="tools">
                        <div className="row1">
                            <button
                                data-tooltip={
                                    "Sort: " +
                                    (appSettings.historyListSortType === "normal" ? "▲ " : "▼ ") +
                                    appSettings.historyListSortBy.toUpperCase()
                                }
                                onClick={(e) => {
                                    const items: Menu.ListItem[] = [
                                        {
                                            label: "Name",
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
                                            label: "Date Updated",
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
                                            label: "Ascending",
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
                                            label: "Descending",
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

export default HistoryTab;
