import type { DetailsCoverSource, LibraryItem, LibraryItemMetadata } from "@common/types/db";
import type { DatabaseChannels } from "@common/types/ipc";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type ResolvedItemMetadata, resolveItemMetadata } from "@utils/libraryMetadata";
import { findLibraryItemKeyForOpenPath } from "@utils/mangaChapterPath";
import { createRendererLogger } from "../utils/logger";
import type { RootState } from ".";

const log = createRendererLogger("store/library");

type LibraryState = {
    items: Record<string, DatabaseChannels["db:library:getAllAndProgress"]["response"][0] | null>;
    metadata: Record<string, LibraryItemMetadata[]>;
    loading: boolean;
    error: string | null;
};

const initialState: LibraryState = {
    items: {},
    metadata: {},
    loading: false,
    error: null,
};

export const fetchAllItemsWithProgress = createAsyncThunk("library/getAllItemsWithProgress", async () => {
    return await window.electron.invoke("db:library:getAllAndProgress");
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

/** Loads every metadata overlay row and groups them by `itemLink` in the slice. */
export const fetchAllMetadata = createAsyncThunk("library/getAllMetadata", async () => {
    return await window.electron.invoke("db:library:getAllMetadata");
});

/** Writes {@link LibraryItem.favouritedAt} to a timestamp, or null to clear the favourite. */
export const setLibraryItemFavourite = createAsyncThunk(
    "library/setFavourite",
    async ({ link, favourite }: { link: string; favourite: boolean }) => {
        return await window.electron.invoke("db:library:updateItem", {
            link,
            favouritedAt: favourite ? new Date() : null,
        });
    },
);

/**
 * Merges {@link LibraryItemExtra.detailsCoverSource} into the row extra JSON.
 * `db:library:updateItem` replaces `extra` wholesale, so this reads the current map first.
 * Omitted extra follows the tracker image once a snapshot URL exists.
 */
export const setLibraryItemDetailsCoverSource = createAsyncThunk(
    "library/setDetailsCoverSource",
    async ({ link, source }: { link: string; source: DetailsCoverSource }, { getState }) => {
        const item = (getState() as RootState).library.items[link];
        if (!item) {
            log.warn("setDetailsCoverSource: no library row", { link });
            return null;
        }
        return await window.electron.invoke("db:library:updateItem", {
            link,
            extra: { ...item.extra, detailsCoverSource: source },
        });
    },
);

/** Persists the library-item note. Empty string is stored as null. */
export const setLibraryItemNote = createAsyncThunk(
    "library/setNote",
    async ({ link, note }: { link: string; note: string }) => {
        const trimmed = note.trim();
        return await window.electron.invoke("db:library:updateItem", {
            link,
            note: trimmed.length > 0 ? trimmed : null,
        });
    },
);

/**
 * Upserts one metadata overlay. Omitted fields stay as stored; explicit `null` clears that field.
 */
export const setLibraryItemMetadata = createAsyncThunk(
    "library/setMetadata",
    async (args: DatabaseChannels["db:library:setMetadata"]["request"]) => {
        return await window.electron.invoke("db:library:setMetadata", args);
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
 * Moves a library item to a new disk path (progress/bookmarks/notes/trackers/metadata follow).
 * Callers should update any UI selection holding `oldLink`.
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

/**
 * Merges a library-row IPC result into the in-memory map so toggles (favourite,
 * note, title) update the UI before `db:library:change` refetch finishes.
 * Progress is kept from the previous map entry.
 */
const applyLibraryItemPatch = (state: LibraryState, item: LibraryItem | null | undefined): void => {
    if (!item) return;
    const prev = state.items[item.link];
    if (!prev) return;
    if (prev.type === "manga" && item.type === "manga") {
        state.items[item.link] = { ...prev, ...item, type: "manga", progress: prev.progress };
        return;
    }
    if (prev.type === "book" && item.type === "book") {
        state.items[item.link] = { ...prev, ...item, type: "book", progress: prev.progress };
    }
};

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
            .addCase(fetchAllMetadata.fulfilled, (state, action) => {
                const next: Record<string, LibraryItemMetadata[]> = {};
                for (const row of action.payload) {
                    const list = next[row.itemLink];
                    if (list) list.push(row);
                    else next[row.itemLink] = [row];
                }
                state.metadata = next;
            })
            .addCase(updateLibraryItem.fulfilled, (state, action) => {
                applyLibraryItemPatch(state, action.payload);
            })
            .addCase(setLibraryItemFavourite.fulfilled, (state, action) => {
                applyLibraryItemPatch(state, action.payload);
            })
            .addCase(setLibraryItemNote.fulfilled, (state, action) => {
                applyLibraryItemPatch(state, action.payload);
            })
            .addCase(setLibraryItemDetailsCoverSource.fulfilled, (state, action) => {
                applyLibraryItemPatch(state, action.payload);
            })
            .addCase(setLibraryItemMetadata.fulfilled, (state, action) => {
                const row = action.payload;
                if (!row) return;
                const list = state.metadata[row.itemLink] ?? [];
                const index = list.findIndex((item) => item.source === row.source);
                if (index === -1) {
                    state.metadata[row.itemLink] = [...list, row];
                    return;
                }
                const next = [...list];
                next[index] = row;
                state.metadata[row.itemLink] = next;
            })
            // Keep UI selection keys valid before db:library:change refetch finishes.
            .addCase(relocateLibraryItem.fulfilled, (state, action) => {
                const item = action.payload;
                const { oldLink, newLink } = action.meta.arg;
                if (!item || oldLink === newLink) return;
                const prev = state.items[oldLink];
                delete state.items[oldLink];
                const overlays = state.metadata[oldLink];
                if (overlays) {
                    delete state.metadata[oldLink];
                    state.metadata[newLink] = overlays.map((row) => ({ ...row, itemLink: newLink }));
                }
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
        const key = findLibraryItemKeyForOpenPath(path, (link) => Boolean(state.library.items[link]));
        return key ? (state.library.items[key] ?? null) : null;
    } catch (error) {
        log.error(`selectLibraryItem: lookup failed for "${path}"`, error);
        return null;
    }
};

/** Metadata overlay rows for a library path (user and, later, file). */
export const selectItemMetadata = (state: RootState, itemLink: string): LibraryItemMetadata[] =>
    state.library.metadata[itemLink] ?? [];

/**
 * Display metadata for a library path: user overlay > tracker snapshot > file overlay > row.
 * Returns null when the library map has no item for `itemLink`.
 */
export const selectResolvedItemMetadata = (
    state: RootState,
    itemLink: string | undefined,
): ResolvedItemMetadata | null => {
    if (!itemLink) return null;
    const item = state.library.items[itemLink];
    if (!item) return null;
    const tracker = state.trackers.entries.find((row) => row.itemLink === itemLink && row.provider === "anilist");
    return resolveItemMetadata({
        item,
        overlays: state.library.metadata[itemLink] ?? [],
        tracker,
    });
};
