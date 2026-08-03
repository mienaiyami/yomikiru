import type { LibraryItemWithProgress } from "@common/types/db";

/**
 * Sorts all gallery items according to gallery settings.
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
            sorted.sort((a, b) => {
                const aTime = a.progress?.lastReadAt?.getTime() ?? 0;
                const bTime = b.progress?.lastReadAt?.getTime() ?? 0;
                return bTime - aTime;
            });
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
 * Sorts Continue Reading tab items using its independent settings.
 */
export const sortContinueReadingItems = (
    items: LibraryItemWithProgress[],
    sortBy: AppSettings["continueReadingSortBy"],
    sortType: AppSettings["continueReadingSortType"],
): LibraryItemWithProgress[] => {
    const sorted = [...items];
    if (sortBy === "name") {
        sorted.sort((a, b) => window.app.betterSortOrder(a.title, b.title));
    } else {
        sorted.sort((a, b) => {
            const aTime = a.progress?.lastReadAt?.getTime() ?? 0;
            const bTime = b.progress?.lastReadAt?.getTime() ?? 0;
            return bTime - aTime;
        });
    }
    return sortType === "inverse" ? sorted.reverse() : sorted;
};
