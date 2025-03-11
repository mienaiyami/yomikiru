import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { DatabaseChannels } from "@common/types/ipc";
import { RootState } from ".";

// todo : add proper error handling

type LibraryState = {
    items: Record<string, DatabaseChannels["db:library:getAllAndProgress"]["response"][0] | null>;
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
    const now = performance.now();
    const data = await window.electron.invoke("db:library:getAllAndProgress");
    const time = performance.now() - now;
    console.log(`db:library:getAllAndProgress took ${time}ms`);
    return data;
});

export const addLibraryItem = createAsyncThunk(
    "library/addItem",
    async (args: DatabaseChannels["db:library:addItem"]["request"]) => {
        return await window.electron.invoke("db:library:addItem", args);
    },
);

export const updateMangaProgress = createAsyncThunk(
    "library/updateMangaProgress",
    async (args: DatabaseChannels["db:manga:updateProgress"]["request"]) => {
        const res = await window.electron.invoke("db:manga:updateProgress", args);
        if (!res) throw new Error("Failed to update progress");
        return res;
    },
);

export const updateBookProgress = createAsyncThunk(
    "library/updateBookProgress",
    async (args: DatabaseChannels["db:book:updateProgress"]["request"]) => {
        const res = await window.electron.invoke("db:book:updateProgress", args);
        if (!res) throw new Error("Failed to update progress");
        return res;
    },
);

export const deleteLibraryItem = createAsyncThunk(
    "library/deleteItem",
    async (args: DatabaseChannels["db:library:deleteItem"]["request"]) => {
        return await window.electron.invoke("db:library:deleteItem", args);
    },
);

export const updateCurrentItemProgress = createAsyncThunk(
    "library/updateCurrentItemProgress",
    async (_, { getState }) => {
        //todo test
        const readerState = (getState() as RootState).reader;
        if (!readerState.link) {
            console.error("No link in reader");
            return;
        }
        if (readerState.type === "book" && readerState.content?.progress) {
            const res = await window.electron.invoke("db:book:updateProgress", {
                ...readerState.content.progress,
            });
            if (!res) throw new Error("Failed to update progress");
            return res;
        } else if (readerState.type === "manga" && readerState.content?.progress) {
            const res = await window.electron.invoke("db:manga:updateProgress", {
                ...readerState.content.progress,
            });
            if (!res) throw new Error("Failed to update progress");
            return res;
        } else {
            console.error("No progress to update");
        }
    },
);

export const updateChaptersRead = createAsyncThunk(
    "library/updateChaptersRead",
    async ({ itemLink, chapterName, read }: { itemLink: string; chapterName: string; read: boolean }) => {
        const chapterRead = await window.electron.invoke("db:manga:updateChaptersRead", {
            itemLink,
            chapterName,
            read,
        });
        return { itemLink, chapterRead };
    },
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
    },
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
