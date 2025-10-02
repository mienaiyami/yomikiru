import type { BookBookmark, MangaBookmark } from "@common/types/db";
import type { DatabaseChannels } from "@common/types/ipc";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

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
export const fetchAllBookmarks = createAsyncThunk("bookmarks/fetchAll", async () => {
    const bookmarks = await window.electron.invoke("db:library:getAllBookmarks");
    return bookmarks;
});

// export const fetchBookmarks = createAsyncThunk(
//     "bookmarks/fetch",
//     async ({ itemLink, type }: { itemLink: string; type: "manga" | "book" }) => {
//         const bookmarks = await ipc.invoke(`db:${type}:getBookmarks`, { itemLink });
//         return bookmarks;
//     }
// );

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
            });
    },
});

export const { clearError: clearError_bookmark, setBookmarks } = bookmarksSlice.actions;

export default bookmarksSlice.reducer;
