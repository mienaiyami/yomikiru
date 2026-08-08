import type { BookBookmark, LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import { addBookmark, removeBookmark } from "@store/bookmarks";
import type { AppDispatch } from "@store/index";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";

type AddBookmarkArgs = Parameters<typeof addBookmark>[0];
type LibraryBookmark = BookBookmark | MangaBookmark;

/**
 * Selection key for a bookmark row. Manga and book bookmarks use separate
 * autoincrement tables, so bare numeric `id` is not unique across the merged
 * classic Bookmark list.
 */
export type BookmarkSelectionKey = `manga:${number}` | `book:${number}`;

/**
 * Stable multi-select id for a manga or book bookmark.
 */
export const getBookmarkSelectionKey = (bookmark: LibraryBookmark): BookmarkSelectionKey =>
    "page" in bookmark ? `manga:${bookmark.id}` : `book:${bookmark.id}`;

/**
 * Builds the {@link addBookmark} payload for an item's current reading progress.
 * Returns `null` when the item has no usable progress.
 */
export const getAddBookmarkArgsFromProgress = (item: LibraryItemWithProgress): AddBookmarkArgs | null => {
    if (!item.progress) return null;
    if (item.type === "book" && "chapterId" in item.progress) {
        return {
            type: "book",
            data: {
                chapterId: item.progress.chapterId,
                position: item.progress.position,
                chapterName: item.progress.chapterName,
                itemLink: item.link,
            },
        };
    }
    if (item.type === "manga" && "currentPage" in item.progress) {
        return {
            type: "manga",
            data: {
                itemLink: item.link,
                page: item.progress.currentPage,
                chapterName: item.progress.chapterName,
            },
        };
    }
    return null;
};

/**
 * Bookmarks each unique library item at its current progress. Skips duplicates
 * by `item.link` so multi-select of the same series only creates one bookmark.
 */
export const bookmarkLibraryItemsAtProgress = (
    dispatch: AppDispatch,
    items: Iterable<LibraryItemWithProgress | null | undefined>,
): void => {
    const seen = new Set<string>();
    for (const item of items) {
        if (!item || seen.has(item.link)) continue;
        seen.add(item.link);
        const args = getAddBookmarkArgsFromProgress(item);
        if (args) dispatch(addBookmark(args));
    }
};

/** Path copied by the history-row context menu (chapter path for manga). */
export const getHistoryItemPath = (item: LibraryItemWithProgress): string => {
    if (item.type === "book") return item.link;
    if (item.progress && "chapterName" in item.progress) {
        return resolveMangaChapterPath(item.progress.itemLink, item.progress.chapterName);
    }
    return item.link;
};

/** Path copied by the bookmark-row context menu. */
export const getBookmarkItemPath = (bookmark: LibraryBookmark): string => {
    if ("page" in bookmark) {
        return resolveMangaChapterPath(bookmark.itemLink, bookmark.chapterName);
    }
    return bookmark.itemLink;
};

/** Writes one or more paths to the clipboard (newline-separated when multiple). */
export const copyPathsToClipboard = (paths: readonly string[]): void => {
    const cleaned = paths.filter(Boolean);
    if (cleaned.length === 0) return;
    window.electron.writeText(cleaned.join("\n"));
};

/**
 * Resolves selected bookmark keys against the current bookmark list.
 * Unknown / stale keys are skipped.
 */
export const getBookmarksBySelectionKeys = (
    bookmarks: readonly LibraryBookmark[],
    keys: Iterable<string>,
): LibraryBookmark[] => {
    const byKey = new Map(bookmarks.map((b) => [getBookmarkSelectionKey(b), b]));
    const out: LibraryBookmark[] = [];
    for (const key of keys) {
        const bookmark = byKey.get(key as BookmarkSelectionKey);
        if (bookmark) out.push(bookmark);
    }
    return out;
};

/**
 * Removes bookmarks grouped by parent `(type, itemLink)` so each parent gets
 * one IPC call. Caller is responsible for confirmation UI.
 */
export const removeBookmarksGrouped = (dispatch: AppDispatch, bookmarks: readonly LibraryBookmark[]): void => {
    if (bookmarks.length === 0) return;

    const grouped = new Map<string, { type: "manga" | "book"; itemLink: string; ids: number[] }>();
    for (const b of bookmarks) {
        const type: "manga" | "book" = "page" in b ? "manga" : "book";
        // Keep itemLink on the value — do not encode it into the key (paths may contain "::").
        const key = `${type}\0${b.itemLink}`;
        const existing = grouped.get(key);
        if (existing) existing.ids.push(b.id);
        else grouped.set(key, { type, itemLink: b.itemLink, ids: [b.id] });
    }
    for (const value of grouped.values()) {
        dispatch(removeBookmark({ itemLink: value.itemLink, type: value.type, ids: value.ids }));
    }
};
