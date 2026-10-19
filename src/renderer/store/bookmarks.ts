import type {
    BookBookmark,
    MangaBookmark,
    UpdateBookBookmarkData,
    UpdateMangaBookmarkData,
} from "@common/types/db";
import type { DatabaseChannels } from "@common/types/ipc";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { relocateLibraryItem } from "./library";

type BookmarksState = {
    // map of key:itemLink value: bookmarks
    manga: Record<string, MangaBookmark[] | null>;
    book: Record<string, BookBookmark[] | null>;
    loading: boolean;
    error: string | null;
};
const initialState: BookmarksState = {
    manga: {},
    book: {},
    loading: false,
    error: null,
};

/**
 * Replaces a bookmark in a link-keyed map, moving it when `itemLink` changed.
 */
const upsertBookmarkById = <T extends { id: number; itemLink: string }>(
    map: Record<string, T[] | null>,
    updated: T,
): void => {
    for (const [link, list] of Object.entries(map)) {
        if (!list) continue;
        const next = list.filter((b) => b.id !== updated.id);
        if (next.length === list.length) continue;
        if (next.length === 0) delete map[link];
        else map[link] = next;
    }
    const dest = map[updated.itemLink] ?? [];
    dest.push(updated);
    map[updated.itemLink] = dest;
};

export const fetchAllBookmarks = createAsyncThunk("bookmarks/fetchAll", async () => {
    const bookmarks = await window.electron.invoke("db:library:getAllBookmarks");
    return bookmarks;
});

export const addBookmark = createAsyncThunk(
    "bookmarks/add",
    async ({
        data,
        type,
    }:
        | {
              data: DatabaseChannels["db:manga:addBookmark"]["request"];
              type: "manga";
          }
        | {
              data: DatabaseChannels["db:book:addBookmark"]["request"];
              type: "book";
          }) => {
        const bookmark = await window.electron.invoke(`db:${type}:addBookmark`, data);
        if (!bookmark) throw new Error("Failed to add bookmark");
        return { bookmark, type };
    },
);
export const removeBookmark = createAsyncThunk(
    "bookmarks/remove",
    async ({ itemLink, type, ids }: { itemLink: string; type: "manga" | "book"; ids: number[] }) => {
        const _res = await window.electron.invoke(`db:${type}:deleteBookmarks`, { itemLink, ids });
        return { itemLink, type, ids };
    },
);

/**
 * Partial update for a manga bookmark (`id` required; other fields optional).
 */
export const updateMangaBookmark = createAsyncThunk(
    "bookmarks/updateManga",
    async (args: UpdateMangaBookmarkData) => {
        const bookmark = await window.electron.invoke("db:manga:updateBookmark", args);
        if (!bookmark) throw new Error("Failed to update bookmark");
        return bookmark;
    },
);

/**
 * Partial update for a book bookmark (`id` required; other fields optional).
 */
export const updateBookBookmark = createAsyncThunk(
    "bookmarks/updateBook",
    async (args: UpdateBookBookmarkData) => {
        const bookmark = await window.electron.invoke("db:book:updateBookmark", args);
        if (!bookmark) throw new Error("Failed to update bookmark");
        return bookmark;
    },
);

export const removeAllBookmarks = createAsyncThunk(
    "bookmarks/removeAll",
    async ({ itemLink, type }: { itemLink: string; type: "manga" | "book" }) => {
        await window.electron.invoke(`db:${type}:deleteBookmarks`, { itemLink, ids: [] });
        return { itemLink, type };
    },
);

const bookmarksSlice = createSlice({
    name: "bookmarks",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        setBookmarks: (_state, action: PayloadAction<BookmarksState>) => {
            return action.payload;
        },
    },

    extraReducers: (builder) => {
        builder
            .addCase(fetchAllBookmarks.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchAllBookmarks.fulfilled, (state, action) => {
                state.manga = {};
                for (const mangaBookmark of action.payload.mangaBookmarks) {
                    if (!state.manga[mangaBookmark.itemLink]) {
                        state.manga[mangaBookmark.itemLink] = [];
                    }
                    state.manga[mangaBookmark.itemLink]?.push(mangaBookmark);
                }
                state.book = {};
                for (const bookBookmark of action.payload.bookBookmarks) {
                    if (!state.book[bookBookmark.itemLink]) {
                        state.book[bookBookmark.itemLink] = [];
                    }
                    state.book[bookBookmark.itemLink]?.push(bookBookmark);
                }
                state.loading = false;
            })
            .addCase(relocateLibraryItem.fulfilled, (state, action) => {
                if (!action.payload) return;
                const { oldLink, newLink } = action.meta.arg;
                if (oldLink === newLink) return;
                const mangaList = state.manga[oldLink];
                if (mangaList) {
                    delete state.manga[oldLink];
                    state.manga[newLink] = mangaList.map((b) => ({ ...b, itemLink: newLink }));
                }
                const bookList = state.book[oldLink];
                if (bookList) {
                    delete state.book[oldLink];
                    state.book[newLink] = bookList.map((b) => ({ ...b, itemLink: newLink }));
                }
            })
            .addCase(updateMangaBookmark.fulfilled, (state, action) => {
                upsertBookmarkById(state.manga, action.payload);
            })
            .addCase(updateBookBookmark.fulfilled, (state, action) => {
                upsertBookmarkById(state.book, action.payload);
            });
    },
});

export const { clearError: clearError_bookmark, setBookmarks } = bookmarksSlice.actions;

export default bookmarksSlice.reducer;
