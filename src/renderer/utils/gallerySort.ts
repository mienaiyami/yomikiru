import type { LibraryItemWithProgress } from "@common/types/db";

/**
 * Link-keyed bookmark lists used to derive the `bookmarks` gallery tab.
 * Matches the manga/book maps on the Redux bookmarks slice (`null` = empty).
 */
export type GalleryBookmarkMaps = {
    manga: Record<string, readonly { createdAt: Date }[] | null | undefined>;
    book: Record<string, readonly { createdAt: Date }[] | null | undefined>;
};

/**
 * `progress.lastReadAt` as a millisecond timestamp for sort comparisons.
 * Missing progress sorts last under descending last-read order.
 */
const lastReadTime = (item: LibraryItemWithProgress): number => item.progress?.lastReadAt?.getTime() ?? 0;

/**
 * Orders items by `gallerySortBy` / `gallerySortType` for tabs that show sort.
 */
export const sortGalleryItems = (
    items: LibraryItemWithProgress[],
    sortBy: AppSettings["gallerySortBy"],
    sortType: AppSettings["gallerySortType"],
): LibraryItemWithProgress[] => {
    const sorted = [...items];
    switch (sortBy) {
        case "name":
            sorted.sort((a, b) => window.app.betterSortOrder(a.title, b.title));
            break;
        case "lastRead":
            sorted.sort((a, b) => lastReadTime(b) - lastReadTime(a));
            break;
        case "date":
            sorted.sort((a, b) => (b.updatedAt.getTime() || 0) - (a.updatedAt.getTime() || 0));
            break;
        default:
            break;
    }
    return sortType === "inverse" ? sorted.reverse() : sorted;
};

/**
 * Orders the `continue-reading` tab by `progress.lastReadAt` descending
 * (missing progress sorts last). Does not apply `gallerySortBy` / `gallerySortType`.
 */
export const sortContinueReadingItems = (items: LibraryItemWithProgress[]): LibraryItemWithProgress[] => {
    const sorted = [...items];
    sorted.sort((a, b) => lastReadTime(b) - lastReadTime(a));
    return sorted;
};

/** Bookmark list for a library item, or empty/`null` when it has none. */
const bookmarksForItem = (
    item: LibraryItemWithProgress,
    bookmarks: GalleryBookmarkMaps,
): readonly { createdAt: Date }[] | null | undefined =>
    item.type === "manga" ? bookmarks.manga[item.link] : bookmarks.book[item.link];

/**
 * Library items that have at least one bookmark (`bookmarks` gallery tab).
 * Empty and `null` lists are excluded. Progress is not required.
 */
export const selectBookmarkedItems = (
    items: LibraryItemWithProgress[],
    bookmarks: GalleryBookmarkMaps,
): LibraryItemWithProgress[] =>
    items.filter((item) => {
        const list = bookmarksForItem(item, bookmarks);
        return Boolean(list && list.length > 0);
    });
