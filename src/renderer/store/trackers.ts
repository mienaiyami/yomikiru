import type { ItemTracker, TrackerProvider } from "@common/types/db";
import type { DatabaseChannels } from "@common/types/ipc";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from ".";
import { relocateLibraryItem } from "./library";

/**
 * Provider-agnostic `item_trackers` Redux slice.
 *
 * Library, gallery details, and app bootstrap should use these thunks/selectors.
 * AniList GraphQL, OAuth, and AniList UI stay in `anilist.ts` / `utils/anilist.ts`.
 * Call-site conversion is listed in `trackers.md`.
 */

type TrackersState = {
    /** All `item_trackers` rows (every provider). */
    entries: ItemTracker[];
};

const initialState: TrackersState = {
    entries: [],
};

/** Loads every `item_trackers` row into `trackers.entries`. */
export const fetchAllTrackers = createAsyncThunk("trackers/fetchAll", async () => {
    return await window.electron.invoke("db:trackers:getAll");
});

/** Inserts or replaces a tracker row for one library path and provider. */
export const upsertTracker = createAsyncThunk(
    "trackers/upsert",
    async (args: DatabaseChannels["db:trackers:upsert"]["request"]) => {
        return await window.electron.invoke("db:trackers:upsert", args);
    },
);

/** Deletes the tracker row for one library path and provider. */
export const removeTracker = createAsyncThunk(
    "trackers/remove",
    async (args: DatabaseChannels["db:trackers:remove"]["request"]) => {
        await window.electron.invoke("db:trackers:remove", args);
        return args;
    },
);

/** Writes cached media / list-state fields on an existing tracker row. */
export const updateTrackerSnapshot = createAsyncThunk(
    "trackers/updateSnapshot",
    async (args: DatabaseChannels["db:trackers:updateSnapshot"]["request"]) => {
        return await window.electron.invoke("db:trackers:updateSnapshot", args);
    },
);

/**
 * Inserts or replaces one row in `trackers.entries` keyed by `(itemLink, provider)`.
 */
const upsertEntry = (state: TrackersState, row: ItemTracker | null | undefined): void => {
    if (!row) return;
    const index = state.entries.findIndex(
        (item) => item.itemLink === row.itemLink && item.provider === row.provider,
    );
    if (index === -1) state.entries.push(row);
    else state.entries[index] = row;
};

const trackersSlice = createSlice({
    name: "trackers",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllTrackers.fulfilled, (state, action) => {
                state.entries = action.payload;
            })
            .addCase(upsertTracker.fulfilled, (state, action) => {
                upsertEntry(state, action.payload);
            })
            .addCase(removeTracker.fulfilled, (state, action) => {
                const { itemLink, provider } = action.payload;
                state.entries = state.entries.filter(
                    (item) => !(item.itemLink === itemLink && item.provider === provider),
                );
            })
            .addCase(updateTrackerSnapshot.fulfilled, (state, action) => {
                upsertEntry(state, action.payload);
            })
            // keep tracker keys valid before db:tracker:change refetch finishes
            .addCase(relocateLibraryItem.fulfilled, (state, action) => {
                const item = action.payload;
                const { oldLink, newLink } = action.meta.arg;
                if (!item || oldLink === newLink) return;
                for (const row of state.entries) {
                    if (row.itemLink === oldLink) row.itemLink = newLink;
                }
            });
    },
});

export default trackersSlice.reducer;

/** Tracker row for a library path and provider, if any. */
export const selectTracker = (
    state: RootState,
    itemLink: string | undefined,
    provider: TrackerProvider,
): ItemTracker | undefined =>
    itemLink
        ? state.trackers.entries.find((item) => item.itemLink === itemLink && item.provider === provider)
        : undefined;
