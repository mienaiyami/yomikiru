import type { ItemTracker } from "@common/types/db";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
    getAnilistStorageToken,
    readStoredTracking,
    setAnilistClientToken,
    setAnilistListEntryId,
    setAnilistStorageToken,
    toTrackerListState,
    toTrackerMediaSnapshot,
} from "@utils/anilist";
import { getStorageItem, setStorageItem } from "@utils/localStorage";
import { createRendererLogger } from "@utils/logger";
import type { RootState } from ".";
import { removeTracker, selectTracker, updateTrackerSnapshot, upsertTracker } from "./trackers";

/**
 * AniList session (token, open list entry, gallery search context) plus thin
 * wrappers over {@link upsertTracker} / {@link removeTracker} / {@link updateTrackerSnapshot}.
 *
 * AniList UI (bar, search, edit, login, Settings) may dispatch these wrappers.
 * Library, gallery details, and reader cache writes should use `store/trackers.ts`
 * instead; see `trackers.md`.
 */

const log = createRendererLogger("store/anilist");

type AnilistState = {
    token: string | null;
    currentListEntry: Anilist.ListEntry | null;
    /** When set, AniList search / track UI uses this library path instead of `reader.content` (e.g. gallery). */
    galleryTrackContext: { link: string; title: string } | null;
};

const initialState: AnilistState = {
    token: getAnilistStorageToken(),
    currentListEntry: null,
    galleryTrackContext: null,
};

/**
 * Copies localStorage AniList trackers into `item_trackers` once. Skips entries whose
 * `localURL` is not a library item. Leaves the original localStorage key in place.
 */
export const importAnilistTrackingFromStorage = createAsyncThunk(
    "anilist/importTrackingFromStorage",
    async (_, { getState }) => {
        if (getStorageItem("ANILIST_TRACKING_IMPORTED")) return;
        const stored = readStoredTracking();
        const library = (getState() as RootState).library.items;
        for (const entry of stored) {
            if (!library[entry.localURL]) {
                log.warn("import tracking: skip orphan (no library item)", { localURL: entry.localURL });
                continue;
            }
            await window.electron.invoke("db:trackers:upsert", {
                itemLink: entry.localURL,
                provider: "anilist",
                remoteId: String(entry.anilistMediaId),
            });
        }
        setStorageItem("ANILIST_TRACKING_IMPORTED", "1");
    },
);

/**
 * Inserts or replaces the AniList tracker row for a library path.
 * Dispatches {@link upsertTracker} with `provider: "anilist"`.
 * AniList search/edit only; other callers should dispatch {@link upsertTracker}.
 */
export const addAnilistTracker = (args: { itemLink: string; anilistMediaId: number }) =>
    upsertTracker({
        itemLink: args.itemLink,
        provider: "anilist",
        remoteId: String(args.anilistMediaId),
    });

/**
 * Deletes the AniList tracker row for a library path.
 * Dispatches {@link removeTracker} with `provider: "anilist"`.
 * AniList UI only; other callers should dispatch {@link removeTracker}.
 */
export const removeAnilistTracker = (itemLink: string) => removeTracker({ itemLink, provider: "anilist" });

/**
 * Writes the AniList list-entry payload into the tracker cache for this library item.
 * Dispatches {@link updateTrackerSnapshot}.
 * AniList UI only; reader/details should dispatch {@link updateTrackerSnapshot} after
 * {@link toTrackerMediaSnapshot} / {@link toTrackerListState} (`trackers.md`).
 */
export const cacheAnilistListEntry = ({ itemLink, data }: { itemLink: string; data: Anilist.ListEntry }) =>
    updateTrackerSnapshot({
        itemLink,
        provider: "anilist",
        remoteListId: String(data.id),
        remoteUrl: data.media.siteUrl,
        media: toTrackerMediaSnapshot(data.media),
        listState: toTrackerListState(data),
        syncedAt: new Date(),
    });

const anilistSlice = createSlice({
    name: "anilist",
    initialState,
    reducers: {
        setAnilistToken: (state, action: PayloadAction<string | null>) => {
            const newToken = action.payload || "";
            setAnilistStorageToken(newToken);
            setAnilistClientToken(newToken);
            state.token = action.payload;
        },

        setAnilistCurrentListEntry: (state, action: PayloadAction<Anilist.ListEntry | null>) => {
            if (action.payload) {
                setAnilistListEntryId(action.payload.id);
            } else {
                setAnilistListEntryId(null);
            }
            state.currentListEntry = action.payload;
        },

        setGalleryTrackContext: (state, action: PayloadAction<{ link: string; title: string } | null>) => {
            state.galleryTrackContext = action.payload;
        },

        /**
         * Rewrites session gallery-track context after a library relocate.
         * Tracker rows themselves are rewritten in the DB transaction.
         */
        relocateGalleryTrackContext: (state, action: PayloadAction<{ oldLink: string; newLink: string }>) => {
            const { oldLink, newLink } = action.payload;
            if (state.galleryTrackContext?.link === oldLink) {
                state.galleryTrackContext = { ...state.galleryTrackContext, link: newLink };
            }
        },
    },
});

export const { setAnilistToken, setAnilistCurrentListEntry, setGalleryTrackContext, relocateGalleryTrackContext } =
    anilistSlice.actions;

export default anilistSlice.reducer;

/**
 * AniList tracker row for a library path, if any.
 * AniList UI convenience over {@link selectTracker}; details panels should call
 * `selectTracker(state, itemLink, "anilist")` (`trackers.md`).
 */
export const selectAnilistTracker = (state: RootState, itemLink: string | undefined): ItemTracker | undefined =>
    selectTracker(state, itemLink, "anilist");
