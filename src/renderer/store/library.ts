import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { DatabaseChannels } from "@common/types/ipc";
import { useAppSelector } from "./hooks";
import { RootState } from ".";

// todo : add proper error handling

type LibraryState = {
    items: Record<string, DatabaseChannels["db:library:getAllAndProgress"]["response"][0]>;
    // mangaProgress: Record<string, MangaProgress>;
    // bookProgress: Record<string, BookProgress>;
    loading: boolean;
    error: string | null;
};

const initialState: LibraryState = {
    items: {},
    // mangaProgress: {},
    // bookProgress: {},
    loading: false,
    error: null,
};

export const fetchAllItemsWithProgress = createAsyncThunk("library/getAllItemsWithProgress", async () => {
    const data = await window.electron.invoke("db:library:getAllAndProgress");
    return data;
});

export const addLibraryItem = createAsyncThunk(
    "library/addItem",
    async (args: DatabaseChannels["db:library:addItem"]["request"]) => {
        return await window.electron.invoke("db:library:addItem", args);
    }
);

export const updateMangaProgress = createAsyncThunk(
    "library/updateMangaProgress",
    async (args: DatabaseChannels["db:manga:updateProgress"]["request"]) => {
        const res = await window.electron.invoke("db:manga:updateProgress", args);
        if (!res) throw new Error("Failed to update progress");
        return res;
    }
);

export const updateBookProgress = createAsyncThunk(
    "library/updateBookProgress",
    async (args: DatabaseChannels["db:book:updateProgress"]["request"]) => {
        const res = await window.electron.invoke("db:book:updateProgress", args);
        if (!res) throw new Error("Failed to update progress");
        return res;
    }
);

export const deleteLibraryItem = createAsyncThunk(
    "library/deleteItem",
    async (args: DatabaseChannels["db:library:deleteItem"]["request"]) => {
        return await window.electron.invoke("db:library:deleteItem", args);
    }
);

// todo: this is temp only, plan to remove window.app.linkInReader and window.app.epubHistorySaveData
export const updateCurrentItemProgress = createAsyncThunk(
    "library/updateCurrentItemProgress",
    async (_, { getState }) => {
        //todo test
        const readerState = (getState() as RootState).reader;
        if (!readerState.link) {
            console.error("No link in reader");
            return;
        }
        console.log({
            readerState,
        });
        if (readerState.type === "book") {
            const res = await window.electron.invoke("db:book:updateProgress", {
                itemLink: readerState.link,
                data: {
                    chapterId: readerState.epubChapterId,
                    lastReadAt: new Date(),
                    position: readerState.epubElementQueryString,
                },
            });
            if (!res) throw new Error("Failed to update progress");
            return res;
        } else if (readerState.type === "manga") {
            const res = await window.electron.invoke("db:manga:updateProgress", {
                itemLink: window.path.dirname(readerState.link),
                chapterLink: readerState.content?.progress?.chapterLink,
                currentPage: readerState.mangaPageNumber,
                lastReadAt: new Date(),
            });
            if (!res) throw new Error("Failed to update progress");
            return res;
        }
    }
);

// export const clearProgress = createAsyncThunk(
//     "library/clearProgress",
//     async ({ itemLink }: { itemLink: string }) => {}
// );

export const updateChaptersRead = createAsyncThunk(
    "library/updateChaptersRead",
    async ({ itemLink, chapterName, read }: { itemLink: string; chapterName: string; read: boolean }) => {
        const chapterRead = await window.electron.invoke("db:manga:updateChaptersRead", {
            itemLink,
            chapterName,
            read,
        });
        return { itemLink, chapterRead };
    }
);
export const updateChaptersReadAll = createAsyncThunk(
    "library/updateChaptersReadAll",
    // pass empty chapters to unmark all chapters
    async ({ itemLink, chapters, read }: { itemLink: string; chapters: string[]; read: boolean }) => {
        const chaptersRead = await window.electron.invoke("db:manga:updateChaptersReadAll", {
            itemLink,
            chapters,
            read,
        });
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
        setLibrary: (state, action: PayloadAction<LibraryState["items"]>) => {
            state.items = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllItemsWithProgress.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllItemsWithProgress.fulfilled, (state, action) => {
                state.items = action.payload.reduce((acc, item) => {
                    acc[item.link] = item;
                    return acc;
                }, {} as LibraryState["items"]);
                state.loading = false;
            })
            .addCase(fetchAllItemsWithProgress.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || "Failed to load items";
            });

        // for now re fetch all items on change

        // .addCase(addLibraryItem.fulfilled, (state, action: PayloadAction<LibraryItem>) => {
        //     const items = new Map(state.items);
        //     items.set(action.payload.link, action.payload);
        //     state.items = items;
        //     // todo: add progress
        // })
        // .addCase(updateMangaProgress.fulfilled, (state, action) => {
        //     const mangaProgress = new Map(state.mangaProgress);
        //     mangaProgress.set(action.payload.itemLink, {
        //         ...action.payload,
        //     } as MangaProgress);
        //     state.mangaProgress = mangaProgress;
        // })
        // .addCase(updateBookProgress.fulfilled, (state, action) => {
        //     const bookProgress = new Map(state.bookProgress);
        //     bookProgress.set(action.payload.itemLink, {
        //         ...action.payload,
        //     } as BookProgress);
        //     state.bookProgress = bookProgress;
        // })
        // .addCase(updateChaptersRead.fulfilled, (state, action) => {
        //     const { itemLink, chapterRead } = action.payload;
        //     const mangaProgress = new Map(state.mangaProgress);
        //     const progress = state.mangaProgress.get(itemLink);
        //     if (progress) {
        //         progress.chaptersRead = chapterRead;
        //     }
        //     state.mangaProgress = mangaProgress;
        // })
        // .addCase(updateChaptersReadAll.fulfilled, (state, action) => {
        //     const { itemLink, chaptersRead } = action.payload;
        //     const mangaProgress = new Map(state.mangaProgress);
        //     const progress = mangaProgress.get(itemLink);
        //     if (progress) {
        //         progress.chaptersRead = chaptersRead;
        //     }
        //     state.mangaProgress = mangaProgress;
        // });
    },
});

export const { clearError: clearError_library, setLibrary } = librarySlice.actions;
export default librarySlice.reducer;

export const selectLibraryItem = (state: RootState, path: string) => {
    try {
        const dirPath = window.path.dirname(path);
        return state.library.items[dirPath] ?? null;
    } catch (error) {
        console.error("Error in selectLibraryItem:", error);
        return null;
    }
};
