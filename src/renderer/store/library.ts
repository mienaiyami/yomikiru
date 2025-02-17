import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { LibraryItem, MangaProgress, BookProgress } from "@common/types/db";
import { ipc } from "../utils/ipc";
import { DatabaseChannels } from "@common/types/ipc";

// todo : add proper error handling

type ItemWithProgress = {
    item: LibraryItem;
    mangaProgress: MangaProgress | null;
    bookProgress: BookProgress | null;
};

type LibraryState = {
    items: Map<string, LibraryItem>;
    mangaProgress: Map<string, MangaProgress>;
    bookProgress: Map<string, BookProgress>;
    loading: boolean;
    error: string | null;
};

const initialState: LibraryState = {
    items: new Map(),
    mangaProgress: new Map(),
    bookProgress: new Map(),
    loading: false,
    error: null,
};

export const getAllItemsWithProgress = createAsyncThunk("library/getAllItemsWithProgress", async () => {
    return await ipc.invoke("db:library:getAllAndProgress");
});

export const addItem = createAsyncThunk(
    "library/addItem",
    async (args: DatabaseChannels["db:library:addItem"]["request"]) => {
        return await ipc.invoke("db:library:addItem", args);
    }
);

export const updateMangaProgress = createAsyncThunk(
    "library/updateMangaProgress",
    async (args: DatabaseChannels["db:manga:updateProgress"]["request"]) => {
        const res = await ipc.invoke("db:manga:updateProgress", args);
        if (!res) throw new Error("Failed to update progress");
        return res;
    }
);

export const updateBookProgress = createAsyncThunk(
    "library/updateBookProgress",
    async (args: DatabaseChannels["db:book:updateProgress"]["request"]) => {
        const res = await ipc.invoke("db:book:updateProgress", args);
        if (!res) throw new Error("Failed to update progress");
        return res;
    }
);

// export const clearProgress = createAsyncThunk(
//     "library/clearProgress",
//     async ({ itemLink }: { itemLink: string }) => {}
// );

export const updateChaptersRead = createAsyncThunk(
    "library/updateChaptersRead",
    async ({ itemLink, chapterName, read }: { itemLink: string; chapterName: string; read: boolean }) => {
        const chapterRead = await ipc.invoke("db:manga:updateChaptersRead", { itemLink, chapterName, read });
        return { itemLink, chapterRead };
    }
);
export const updateChaptersReadAll = createAsyncThunk(
    "library/updateChaptersReadAll",
    // pass empty chapters to unmark all chapters
    async ({ itemLink, chapters, read }: { itemLink: string; chapters: string[]; read: boolean }) => {
        const chaptersRead = await ipc.invoke("db:manga:updateChaptersReadAll", { itemLink, chapters, read });
        return { itemLink, chaptersRead };
    }
);

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
            .addCase(getAllItemsWithProgress.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getAllItemsWithProgress.fulfilled, (state, action: PayloadAction<ItemWithProgress[]>) => {
                action.payload.forEach(({ item, mangaProgress, bookProgress }) => {
                    state.items.set(item.link, item);
                    if (mangaProgress) state.mangaProgress.set(item.link, mangaProgress);
                    if (bookProgress) state.bookProgress.set(item.link, bookProgress);
                });
                state.loading = false;
            })
            .addCase(getAllItemsWithProgress.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || "Failed to load items";
            })
            .addCase(addItem.fulfilled, (state, action: PayloadAction<LibraryItem>) => {
                state.items.set(action.payload.link, action.payload);
                // todo: add progress
            })
            .addCase(updateMangaProgress.fulfilled, (state, action) => {
                state.mangaProgress.set(action.payload.itemLink, {
                    ...action.payload,
                } as MangaProgress);
            })
            .addCase(updateBookProgress.fulfilled, (state, action) => {
                state.bookProgress.set(action.payload.itemLink, {
                    ...action.payload,
                } as BookProgress);
            })
            .addCase(updateChaptersRead.fulfilled, (state, action) => {
                const { itemLink, chapterRead } = action.payload;
                const progress = state.mangaProgress.get(itemLink);
                if (progress) {
                    progress.chaptersRead = chapterRead;
                }
            })
            .addCase(updateChaptersReadAll.fulfilled, (state, action) => {
                const { itemLink, chaptersRead } = action.payload;
                const progress = state.mangaProgress.get(itemLink);
                if (progress) {
                    progress.chaptersRead = chaptersRead;
                }
            });
    },
});

export const { clearError: clearError_library } = librarySlice.actions;
export default librarySlice.reducer;
