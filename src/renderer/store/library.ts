import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { LibraryItem, MangaProgress, BookProgress } from "@common/types/db";
import { ipc } from "../MainImports";
import { DatabaseChannels } from "@common/types/ipc";

interface LibraryState {
    items: Record<string, LibraryItem>;
    mangaProgress: Record<string, MangaProgress>;
    bookProgress: Record<string, BookProgress>;
    loading: boolean;
    error: string | null;
}

const initialState: LibraryState = {
    items: {},
    mangaProgress: {},
    bookProgress: {},
    loading: false,
    error: null,
};

export const fetchWholeLibrary = createAsyncThunk("library/fetchWhole", async () => {
    const items = await ipc.invoke("db:library:getWholeAndProgress");
    return items;
});

// export const fetchLibraryItem = createAsyncThunk("library/fetchItem", async (link: string) => {
//     const item = await ipc.invoke("db:library:getItem", { link });
//     if (!item) {
//         throw new Error("Item not found");
//     }
//     const progress =
//         item.type === "manga"
//             ? await ipc.invoke("db:manga:getProgress", { itemLink: item.link })
//             : await ipc.invoke("db:book:getProgress", { itemLink: item.link });
//     return { item, progress };
// });

export const updateMangaProgress = createAsyncThunk(
    "library/updateMangaProgress",
    async (data: DatabaseChannels["db:manga:updateProgress"]["request"]) => {
        await ipc.invoke("db:manga:updateProgress", data);
        return { data };
    }
);
// add more update functions for book progress, bookmarks, etc.

const librarySlice = createSlice({
    name: "library",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchWholeLibrary.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchWholeLibrary.fulfilled, (state, action) => {
                state.items = {};
                state.mangaProgress = {};
                state.bookProgress = {};
                for (const { item, mangaProgress, bookProgress } of action.payload) {
                    state.items[item.link] = item;
                    if (mangaProgress) state.mangaProgress[item.link] = mangaProgress;
                    if (bookProgress) state.bookProgress[item.link] = bookProgress;
                }
                state.loading = false;
            })
            .addCase(fetchWholeLibrary.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || "Failed to fetch item";
            })
            .addCase(updateMangaProgress.fulfilled, (state, action) => {
                const { data } = action.payload;
                state.mangaProgress[data.itemLink] = {
                    ...state.mangaProgress[data.itemLink],
                    ...data,
                };
            });
    },
});

export const { clearError: clearError_library } = librarySlice.actions;
export default librarySlice.reducer;
