import type { ItemTracker, TrackerProvider } from "@common/types/db";
import type { DatabaseChannels } from "@common/types/ipc";
import { createAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { trackerCoverAbsolutePath } from "@utils/libraryCover";
import { cacheTrackerCoverFromUrl } from "@utils/libraryCoverService";
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
    /** Bumped after a tracker WebP is written so gallery/details re-read disk. */
    coverCacheGeneration: number;
};

const initialState: TrackersState = {
    entries: [],
    coverCacheGeneration: 0,
};

/** Loads every `item_trackers` row into `trackers.entries`. */
export const fetchAllTrackers = createAsyncThunk("trackers/fetchAll", async () => {
    return await window.electron.invoke("db:trackers:getAll");
});

/** Signals that `covers/tracker-<id>.webp` was written so library views re-read disk. */
export const trackerCoverCached = createAction("trackers/coverCached");

/**
 * Downloads a missing tracker cover after a row write so later offline views can use a local file.
 * Skips when the tracker slot already exists (progress syncs must not re-download).
 */
const maybeCacheTrackerCover = async (
    row: ItemTracker | null,
    getState: () => unknown,
    dispatch: (action: ReturnType<typeof trackerCoverCached>) => void,
): Promise<void> => {
    const url = row?.media?.coverImage?.trim();
    const item = row ? (getState() as RootState).library?.items?.[row.itemLink] : undefined;
    if (!row || !url || item?.id == null) return;
    if (window.fs.isFile(trackerCoverAbsolutePath(item.id))) return;
    const ok = await cacheTrackerCoverFromUrl(item.id, url);
    if (ok) dispatch(trackerCoverCached());
};

/** Inserts or replaces a tracker row for one library path and provider. */
export const upsertTracker = createAsyncThunk(
    "trackers/upsert",
    async (args: DatabaseChannels["db:trackers:upsert"]["request"], { getState, dispatch }) => {
        const row = await window.electron.invoke("db:trackers:upsert", args);
        void maybeCacheTrackerCover(row, getState, dispatch);
        return row;
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
    async (args: DatabaseChannels["db:trackers:updateSnapshot"]["request"], { getState, dispatch }) => {
        const row = await window.electron.invoke("db:trackers:updateSnapshot", args);
        void maybeCacheTrackerCover(row, getState, dispatch);
        return row;
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
            .addCase(trackerCoverCached, (state) => {
                state.coverCacheGeneration += 1;
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

/** Generation counter so gallery/details re-resolve local tracker covers after a cache write. */
export const selectTrackerCoverCacheGeneration = (state: RootState): number => state.trackers.coverCacheGeneration;
