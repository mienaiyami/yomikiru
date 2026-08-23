import type { LibraryItemTag, LibraryTag } from "@common/types/db";
import type { DatabaseChannels } from "@common/types/ipc";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from ".";
import { relocateLibraryItem } from "./library";

type TagsState = {
    /** All `library_tags` catalog rows. */
    catalog: LibraryTag[];
    /** All `library_item_tags` assignment rows. */
    assignments: LibraryItemTag[];
    /** True after the first {@link fetchAllTags} fulfillment (catalog may still be empty). */
    hydrated: boolean;
};

const initialState: TagsState = {
    catalog: [],
    assignments: [],
    hydrated: false,
};

/** Loads the tag catalog and every item assignment. */
export const fetchAllTags = createAsyncThunk("tags/fetchAll", async () => {
    const [catalog, assignments] = await Promise.all([
        window.electron.invoke("db:tags:getAll"),
        window.electron.invoke("db:library:getAllItemTags"),
    ]);
    return { catalog, assignments };
});

/** Inserts a catalog tag. Returns null when the name collides. */
export const createLibraryTag = createAsyncThunk(
    "tags/create",
    async (args: DatabaseChannels["db:tags:create"]["request"]) => {
        return await window.electron.invoke("db:tags:create", args);
    },
);

/** Patches a catalog tag name and/or colour. */
export const updateLibraryTag = createAsyncThunk(
    "tags/update",
    async (args: DatabaseChannels["db:tags:update"]["request"]) => {
        return await window.electron.invoke("db:tags:update", args);
    },
);

/** Deletes a catalog tag; assignments cascade in SQLite. */
export const deleteLibraryTag = createAsyncThunk(
    "tags/delete",
    async (args: DatabaseChannels["db:tags:delete"]["request"]) => {
        const ok = await window.electron.invoke("db:tags:delete", args);
        return { ok, id: args.id };
    },
);

/** Replace-set of tag ids on one library item. */
export const setLibraryItemTags = createAsyncThunk(
    "tags/setItemTags",
    async (args: DatabaseChannels["db:library:setItemTags"]["request"]) => {
        const rows = await window.electron.invoke("db:library:setItemTags", args);
        return { itemLink: args.itemLink, rows };
    },
);

/** Unions tag ids onto many library items without removing existing assignments. */
export const unionLibraryItemTags = createAsyncThunk(
    "tags/unionItemTags",
    async (args: DatabaseChannels["db:library:unionItemTags"]["request"]) => {
        const rows = await window.electron.invoke("db:library:unionItemTags", args);
        return { itemLinks: args.itemLinks, rows };
    },
);

const upsertCatalogRow = (state: TagsState, row: LibraryTag | null | undefined): void => {
    if (!row) return;
    const index = state.catalog.findIndex((tag) => tag.id === row.id);
    if (index === -1) state.catalog.push(row);
    else state.catalog[index] = row;
};

const tagsSlice = createSlice({
    name: "tags",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllTags.fulfilled, (state, action) => {
                state.catalog = action.payload.catalog;
                state.assignments = action.payload.assignments;
                state.hydrated = true;
            })
            .addCase(createLibraryTag.fulfilled, (state, action) => {
                upsertCatalogRow(state, action.payload);
            })
            .addCase(updateLibraryTag.fulfilled, (state, action) => {
                upsertCatalogRow(state, action.payload);
            })
            .addCase(deleteLibraryTag.fulfilled, (state, action) => {
                if (!action.payload.ok) return;
                const { id } = action.payload;
                state.catalog = state.catalog.filter((tag) => tag.id !== id);
                state.assignments = state.assignments.filter((row) => row.tagId !== id);
            })
            .addCase(setLibraryItemTags.fulfilled, (state, action) => {
                const { itemLink, rows } = action.payload;
                if (!rows) return;
                state.assignments = [...state.assignments.filter((row) => row.itemLink !== itemLink), ...rows];
            })
            .addCase(unionLibraryItemTags.fulfilled, (state, action) => {
                const { itemLinks, rows } = action.payload;
                if (!rows) return;
                const touched = new Set(itemLinks);
                state.assignments = [...state.assignments.filter((row) => !touched.has(row.itemLink)), ...rows];
            })
            .addCase(relocateLibraryItem.fulfilled, (state, action) => {
                const item = action.payload;
                const { oldLink, newLink } = action.meta.arg;
                if (!item || oldLink === newLink) return;
                for (const row of state.assignments) {
                    if (row.itemLink === oldLink) row.itemLink = newLink;
                }
            });
    },
});

export default tagsSlice.reducer;

/** Catalog row by id, if it still exists. */
export const selectLibraryTag = (state: RootState, tagId: number | undefined): LibraryTag | undefined =>
    tagId == null ? undefined : state.tags.catalog.find((tag) => tag.id === tagId);
