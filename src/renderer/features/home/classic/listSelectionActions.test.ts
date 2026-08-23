import path from "node:path";
import type { BookBookmark, MangaBookmark } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import libraryReducer from "@store/library";
import { makeBookItem, makeMangaItem, SAMPLE_BOOK_LINK, SAMPLE_MANGA_LINK } from "@test/fixtures/libraryItem";
import { onInvoke } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    bookmarkLibraryItemsAtProgress,
    confirmDeleteProgressForLinks,
    copyPathsToClipboard,
    getAddBookmarkArgsFromProgress,
    getBookmarkItemPath,
    getBookmarkSelectionKey,
    getBookmarksBySelectionKeys,
    getHistoryItemPath,
    progressLinksFromSelection,
    removeBookmarksGrouped,
} from "./listSelectionActions";

describe("getAddBookmarkArgsFromProgress", () => {
    it("builds book bookmark args from progress", () => {
        const item = makeBookItem();
        expect(getAddBookmarkArgsFromProgress(item)).toEqual({
            type: "book",
            data: {
                chapterId: "chap-1",
                position: "body>p:nth-child(1)",
                chapterName: "Chapter 1",
                itemLink: item.link,
            },
        });
    });

    it("builds manga bookmark args from progress", () => {
        const item = makeMangaItem();
        expect(getAddBookmarkArgsFromProgress(item)).toEqual({
            type: "manga",
            data: {
                itemLink: item.link,
                page: 3,
                chapterName: "ch1",
            },
        });
    });

    it("returns null without progress", () => {
        expect(getAddBookmarkArgsFromProgress(makeMangaItem({}, null))).toBeNull();
    });
});

describe("bookmarkLibraryItemsAtProgress", () => {
    it("dispatches once per unique link and skips items without progress", () => {
        const dispatch = vi.fn();
        const a = makeMangaItem({ link: SAMPLE_MANGA_LINK });
        const dup = makeMangaItem({ link: SAMPLE_MANGA_LINK, id: 9 });
        const noProgress = makeMangaItem({ link: path.join("testdata", "manga", "other"), id: 3 }, null);
        bookmarkLibraryItemsAtProgress(dispatch, [null, a, dup, noProgress]);
        expect(dispatch).toHaveBeenCalledTimes(1);
    });
});

describe("getHistoryItemPath / getBookmarkItemPath", () => {
    it("returns book link / manga chapter path for history", () => {
        expect(getHistoryItemPath(makeBookItem())).toBe(SAMPLE_BOOK_LINK);
        expect(getHistoryItemPath(makeMangaItem())).toBe(window.path.join(SAMPLE_MANGA_LINK, "ch1"));
    });

    it("resolves bookmark paths", () => {
        const mangaBm: MangaBookmark = {
            id: 1,
            itemLink: SAMPLE_MANGA_LINK,
            page: 2,
            chapterName: "ch2",
            note: "",
            createdAt: new Date(),
        };
        const bookBm: BookBookmark = {
            id: 2,
            itemLink: SAMPLE_BOOK_LINK,
            chapterId: "c1",
            chapterName: "One",
            position: "p",
            note: null,
            createdAt: new Date(),
        };
        expect(getBookmarkItemPath(mangaBm)).toBe(window.path.join(SAMPLE_MANGA_LINK, "ch2"));
        expect(getBookmarkItemPath(bookBm)).toBe(SAMPLE_BOOK_LINK);
    });
});

describe("getBookmarkSelectionKey / getBookmarksBySelectionKeys", () => {
    it("disambiguates manga vs book bookmarks that share a numeric id", () => {
        const mangaBm: MangaBookmark = {
            id: 1,
            itemLink: "manga-a",
            page: 1,
            chapterName: "c",
            note: "",
            createdAt: new Date(),
        };
        const bookBm: BookBookmark = {
            id: 1,
            itemLink: "book-a",
            chapterId: "x",
            chapterName: "n",
            position: "p",
            note: null,
            createdAt: new Date(),
        };
        expect(getBookmarkSelectionKey(mangaBm)).toBe("manga:1");
        expect(getBookmarkSelectionKey(bookBm)).toBe("book:1");

        const resolved = getBookmarksBySelectionKeys([mangaBm, bookBm], ["book:1", "manga:1", "manga:99"]);
        expect(resolved).toEqual([bookBm, mangaBm]);
    });

    it("resolves known keys and skips stale ones", () => {
        const bookmarks: MangaBookmark[] = [
            {
                id: 1,
                itemLink: "a",
                page: 1,
                chapterName: "c",
                note: "",
                createdAt: new Date(),
            },
            {
                id: 2,
                itemLink: "b",
                page: 2,
                chapterName: "c",
                note: "",
                createdAt: new Date(),
            },
        ];
        expect(
            getBookmarksBySelectionKeys(bookmarks, ["manga:2", "manga:99", "manga:1"]).map((b) => b.id),
        ).toEqual([2, 1]);
    });
});

describe("copyPathsToClipboard / removeBookmarksGrouped", () => {
    it("writes newline-joined paths", () => {
        copyPathsToClipboard(["a", "", "b"]);
        expect(window.electron.readText()).toBe("a\nb");
    });

    it("groups bookmark removals by type+itemLink", () => {
        const dispatch = vi.fn();
        const bookmarks: (MangaBookmark | BookBookmark)[] = [
            {
                id: 1,
                itemLink: "manga-a",
                page: 1,
                chapterName: "c",
                note: "",
                createdAt: new Date(),
            },
            {
                id: 2,
                itemLink: "manga-a",
                page: 2,
                chapterName: "c",
                note: "",
                createdAt: new Date(),
            },
            {
                id: 3,
                itemLink: "book-a",
                chapterId: "x",
                chapterName: "n",
                position: "p",
                note: null,
                createdAt: new Date(),
            },
        ];
        removeBookmarksGrouped(dispatch, bookmarks);
        expect(dispatch).toHaveBeenCalledTimes(2);
    });
});

describe("progressLinksFromSelection", () => {
    it("keeps selected links that have progress and skips the rest", () => {
        const unread = makeMangaItem({ link: path.join("testdata", "manga", "unread"), id: 9 }, null);
        const items = {
            [SAMPLE_MANGA_LINK]: makeMangaItem(),
            [SAMPLE_BOOK_LINK]: makeBookItem(),
            [unread.link]: unread,
        };
        expect(
            progressLinksFromSelection(items, [unread.link, SAMPLE_BOOK_LINK, "missing", SAMPLE_MANGA_LINK]),
        ).toEqual([SAMPLE_BOOK_LINK, SAMPLE_MANGA_LINK]);
    });
});

describe("confirmDeleteProgressForLinks", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Library store seeded with one manga that has progress. */
    const makeProgressStore = () =>
        configureStore({
            reducer: { library: libraryReducer },
            preloadedState: {
                library: {
                    items: { [SAMPLE_MANGA_LINK]: makeMangaItem() },
                    metadata: {},
                    loading: false,
                    error: null,
                },
            },
        });

    it("does not invoke IPC when the user cancels", async () => {
        const invoke = vi.fn(async () => ({ deleted: 1 }));
        onInvoke("dialog:warn", async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("db:library:deleteProgressForLinks", invoke);
        const store = makeProgressStore();
        const onRemoved = vi.fn();

        const ok = await confirmDeleteProgressForLinks(store.dispatch, [SAMPLE_MANGA_LINK], { onRemoved });

        expect(ok).toBe(false);
        expect(invoke).not.toHaveBeenCalled();
        expect(onRemoved).not.toHaveBeenCalled();
        expect(store.getState().library.items[SAMPLE_MANGA_LINK]?.progress).not.toBeNull();
    });

    it("deletes progress after confirm and runs onRemoved", async () => {
        onInvoke("dialog:warn", async () => ({ response: 1, checkboxChecked: false }));
        onInvoke("db:library:deleteProgressForLinks", async ({ links }) => ({ deleted: links.length }));
        const store = makeProgressStore();
        const onRemoved = vi.fn();

        const ok = await confirmDeleteProgressForLinks(store.dispatch, [SAMPLE_MANGA_LINK], { onRemoved });

        expect(ok).toBe(true);
        expect(onRemoved).toHaveBeenCalledTimes(1);
        expect(store.getState().library.items[SAMPLE_MANGA_LINK]?.progress).toBeNull();
    });

    it("skips the dialog when links are empty", async () => {
        const warn = vi.fn(async () => ({ response: 1, checkboxChecked: false }));
        onInvoke("dialog:warn", warn);
        const store = makeProgressStore();

        const ok = await confirmDeleteProgressForLinks(store.dispatch, []);

        expect(ok).toBe(false);
        expect(warn).not.toHaveBeenCalled();
    });
});
