import { ReactNode } from "react";
import { useAppSelector } from "@store/hooks";
import { useListNavigation, ListNavigationProps } from "./hooks/useListNavigation";
import { useAppContext } from "src/renderer/App";
import { LibraryItemWithProgress, BookBookmark, MangaBookmark } from "@common/types/db";

type ListTabProps = {
    title: string;
    tabId: string;
    isCollapsed: boolean;
    items: LibraryItemWithProgress[] | (BookBookmark | MangaBookmark)[];
    filterFn: (filter: string, item: LibraryItemWithProgress | BookBookmark | MangaBookmark) => boolean;
    renderItem: (
        item: LibraryItemWithProgress | BookBookmark | MangaBookmark,
        index: number,
        isSelected: boolean,
    ) => ReactNode;
    emptyMessage?: string;
} & Omit<ListNavigationProps, "itemsLength">;

const ListTab = ({
    title,
    tabId,
    isCollapsed,
    items,
    filterFn,
    renderItem,
    emptyMessage = "No items",
    onContextMenu,
    onSelect,
}: ListTabProps) => {
    const appSettings = useAppSelector((store) => store.appSettings);

    const { filter, focused, listContainerRef, handleFilterChange, handleKeyDown, setFocused } = useListNavigation(
        {
            itemsLength: items.length,
            onContextMenu,
            onSelect,
        },
    );

    const filteredItems = items.filter((item) => filterFn(filter, item));

    return (
        <div className={`contTab listCont ${isCollapsed ? "collapsed" : ""}`} id={tabId}>
            <h2>{title}</h2>

            {appSettings.showSearch && (
                <div className="tools">
                    <input
                        type="text"
                        spellCheck={false}
                        placeholder="Type to Search"
                        onChange={(e) => handleFilterChange(e.target.value)}
                        onBlur={() => setFocused(-1)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            )}

            <div className="location-cont" ref={listContainerRef}>
                {filteredItems.length === 0 ? (
                    <p>{emptyMessage}</p>
                ) : (
                    <ol>
                        {filteredItems.map((item, index) =>
                            renderItem(item, index, focused >= 0 && focused % filteredItems.length === index),
                        )}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default ListTab;
