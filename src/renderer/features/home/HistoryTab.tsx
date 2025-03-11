import { useAppSelector } from "@store/hooks";
import { useMemo } from "react";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import { formatUtils } from "@utils/file";
import ListTab from "./ListTab";
import { useAppContext } from "src/renderer/App";
import { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";

const HistoryTab = () => {
    const library = useAppSelector((store) => store.library);
    const appSettings = useAppSelector((store) => store.appSettings);

    const historyItems = useMemo(() => {
        return (
            Object.values(library.items).filter((item) => item && item.progress) as LibraryItemWithProgress[]
        ).sort((a, b) => {
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
    }, [library.items]);

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

    return (
        <ListTab
            title="Continue Reading"
            tabId="historyTab"
            isCollapsed={!appSettings.showTabs.history}
            items={historyItems}
            filterFn={filterHistoryItem}
            renderItem={renderHistoryItem}
            emptyMessage="Library Empty"
            onContextMenu={(elem) => elem.dispatchEvent(window.contextMenu.fakeEvent(elem))}
            onSelect={(elem) => elem.click()}
        />
    );
};

export default HistoryTab;
