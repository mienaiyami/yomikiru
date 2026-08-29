import type { MangaBookmark } from "@common/types/db";
import { useAppContext } from "@renderer/App";
import ListItem from "@renderer/components/ListItem";
import ListNavigator from "@renderer/components/ListNavigator";
import { useAppSelector } from "@store/hooks";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { createRendererLogger } from "@utils/logger";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("manga/BookmarkList");

/** Stable fallback keeps an absent bookmark map from invalidating the selector result. */
const EMPTY_MANGA_BOOKMARKS: readonly MangaBookmark[] = [];

const BookmarkList: React.FC = () => {
    const { t } = useTranslation("reader");
    const { setContextMenuData, openInReader } = useAppContext();
    const mangaContentLink = useAppSelector((store) =>
        store.reader.type === "manga" ? store.reader.content?.link : undefined,
    );
    const mangaProgressItemLink = useAppSelector((store) =>
        store.reader.type === "manga" ? store.reader.content?.progress?.itemLink : undefined,
    );
    const mangaChapterName = useAppSelector((store) =>
        store.reader.type === "manga" ? store.reader.content?.progress?.chapterName : undefined,
    );
    const mangaTotalPages = useAppSelector((store) =>
        store.reader.type === "manga" ? (store.reader.content?.progress?.totalPages ?? 0) : 0,
    );
    const bookmarks = useAppSelector((store) =>
        mangaContentLink
            ? (store.bookmarks.manga[mangaContentLink] ?? EMPTY_MANGA_BOOKMARKS)
            : EMPTY_MANGA_BOOKMARKS,
    );
    const bookmarksArray = useMemo(
        () => [...bookmarks].sort((b, a) => a.createdAt.getTime() - b.createdAt.getTime()),
        [bookmarks],
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
                    mangaProgressItemLink && mangaChapterName
                        ? resolveMangaChapterPath(mangaProgressItemLink, mangaChapterName)
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
        [bookmarksArray, mangaChapterName, mangaProgressItemLink, openInReader, t],
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
                        {bookmark.page}/{mangaTotalPages}
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
