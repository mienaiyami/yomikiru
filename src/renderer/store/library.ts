import type { DatabaseChannels } from "@common/types/ipc";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { formatUtils } from "@utils/file";
import { createRendererLogger } from "../utils/logger";
import type { RootState } from ".";

const log = createRendererLogger("store/library");

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
    // console.log(`db:library:getAllAndProgress took ${time}ms`);
    return data;
});

export const addLibraryItem = createAsyncThunk(
    "library/addItem",
    async (args: DatabaseChannels["db:library:addItem"]["request"]) => {
        return await window.electron.invoke("db:library:addItem", args);
    },
);
export const updateLibraryItem = createAsyncThunk(
    "library/updateItem",
    async (args: DatabaseChannels["db:library:updateItem"]["request"]) => {
        return await window.electron.invoke("db:library:updateItem", args);
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

/**
 * Moves a library item to a new disk path (progress/bookmarks/notes follow).
 * Callers should update AniList `localURL` and any UI selection holding `oldLink`.
 *
 * @returns The updated library row, or `null` when the IPC reports conflict/missing.
 */
export const relocateLibraryItem = createAsyncThunk(
    "library/relocateItem",
    async (args: DatabaseChannels["db:library:relocateItem"]["request"]) => {
        return await window.electron.invoke("db:library:relocateItem", args);
    },
);

export const resetLibrary = createAsyncThunk("library/reset", async () => {
    return await window.electron.invoke("db:library:reset");
});

export const updateCurrentItemProgress = createAsyncThunk(
    "library/updateCurrentItemProgress",
    async (_, { getState }) => {
        //todo test
        const readerState = (getState() as RootState).reader;
        if (!readerState.link) {
            log.error("updateCurrentItemProgress: no active reader link; skipping DB write");
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
            log.error("updateCurrentItemProgress: reader has no progress object; skipping DB write");
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
                state.items = action.payload.reduce(
                    (acc, item) => {
                        acc[item.link] = item;
                        return acc;
                    },
                    {} as LibraryState["items"],
                );
                state.loading = false;
            })
            .addCase(fetchAllItemsWithProgress.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || "Failed to load items";
            })
            // Keep UI selection keys valid before db:library:change refetch finishes.
            .addCase(relocateLibraryItem.fulfilled, (state, action) => {
                const item = action.payload;
                const { oldLink, newLink } = action.meta.arg;
                if (!item || oldLink === newLink) return;
                const prev = state.items[oldLink];
                delete state.items[oldLink];
                if (!prev) {
                    state.items[newLink] = { ...item, progress: null };
                    return;
                }
                if (prev.type === "manga") {
                    state.items[newLink] = {
                        ...prev,
                        ...item,
                        type: "manga",
                        link: newLink,
                        progress: prev.progress ? { ...prev.progress, itemLink: newLink } : null,
                    };
                    return;
                }
                state.items[newLink] = {
                    ...prev,
                    ...item,
                    type: "book",
                    link: newLink,
                    progress: prev.progress ? { ...prev.progress, itemLink: newLink } : null,
                };
            });
    },
});

export const { clearError: clearError_library, setLibrary } = librarySlice.actions;
export default librarySlice.reducer;

export const selectLibraryItem = (state: RootState, path: string) => {
    try {
        const dirPath = formatUtils.book.test(path) ? path : window.path.dirname(path);
        return state.library.items[dirPath] ?? null;
    } catch (error) {
        log.error(`selectLibraryItem: lookup failed for "${path}"`, error);
        return null;
    }
};
