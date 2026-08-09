import type { MangaBookmark } from "@common/types/db";
import ListItem from "@renderer/components/ListItem";
import ListNavigator from "@renderer/components/ListNavigator";
import { useAppSelector } from "@store/hooks";
import { getReaderManga } from "@store/reader";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { createRendererLogger } from "@utils/logger";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("manga/BookmarkList");

import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";

const BookmarkList: React.FC = () => {
    const { t } = useTranslation("reader");
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
                const bookmarkPath = resolveMangaChapterPath(bookmark.itemLink, bookmark.chapterName);
                const progressPath =
                    mangaInReader?.progress?.itemLink && mangaInReader?.progress?.chapterName
                        ? resolveMangaChapterPath(
                              mangaInReader.progress.itemLink,
                              mangaInReader.progress.chapterName,
                          )
                        : "";
                if (progressPath && bookmarkPath === progressPath) {
                    window.app.scrollToPage(bookmark.page, "smooth");
                } else {
                    openInReader(bookmarkPath, {
                        mangaPageNumber: bookmark.page,
                    });
                }
            } catch (error) {
                log.error("navigate to bookmark failed", error);
                dialogUtils.customError({
                    message: t("errors.chapterIdNotFound"),
                });
            }
        },
        [bookmarksArray, mangaInReader, t],
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
                    message: t("errors.chapterIdNotFound"),
                });
                return;
            }
            const items: Menu.ListItem[] = [
                window.contextMenu.template.removeBookmark(bookmark.itemLink, bookmark.id, "manga", true),
            ];
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                focusBackElem: e.nativeEvent.relatedTarget,
                items,
            });
        },
        [bookmarksArray, setContextMenuData, t],
    );
    const renderBookmarkItem = (bookmark: MangaBookmark, _index: number, isSelected: boolean) => {
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
                <span className="text">
                    <span className="chapterName">{bookmark.chapterName}</span>

                    <span className="page" title={t("sideList.bookmarkedPageTitle")}>
                        {bookmark.page}/{mangaInReader?.progress?.totalPages}
                    </span>
                </span>
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
                emptyMessage={t("sideList.noBookmarks")}
            >
                <ListNavigator.List />
            </ListNavigator.Provider>
        </div>
    );
};

export default BookmarkList;
