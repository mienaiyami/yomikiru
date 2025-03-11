import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import AniList from "@utils/anilist";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@utils/localStorage";

type AnilistState = {
    token: string | null;
    tracking: Anilist.TrackStore;
    currentManga: Anilist.MangaData | null;
};

const initialState: AnilistState = {
    token: getStorageItem("ANILIST_TOKEN") || null,
    tracking: loadTrackingFromStorage(),
    currentManga: null,
};

function loadTrackingFromStorage(): Anilist.TrackStore {
    try {
        const tracking = JSON.parse(getStorageItem("ANILIST_TRACKING") || "[]") as Anilist.TrackStore;
        return tracking.filter((e) => window.fs.existsSync(e.localURL));
    } catch (e) {
        console.error(e);
        return [];
    }
}

const anilistSlice = createSlice({
    name: "anilist",
    initialState,
    reducers: {
        setAnilistToken: (state, action: PayloadAction<string | null>) => {
            const newToken = action.payload || "";
            setStorageItem("ANILIST_TOKEN", newToken);
            AniList.setToken(newToken);
            state.token = action.payload;
        },

        addAnilistTracker: (state, action: PayloadAction<Anilist.TrackItem>) => {
            state.tracking.push(action.payload);
            setStorageItem("ANILIST_TRACKING", JSON.stringify(state.tracking));
        },
        /**
         * @param action local URL of manga
         */
        removeAnilistTracker: (state, action: PayloadAction<string>) => {
            // state.tracking = state.tracking.filter((item) => item.localURL !== action.payload);
            const index = state.tracking.findIndex((item) => item.localURL === action.payload);
            if (index !== -1) {
                state.tracking.splice(index, 1);
            }
            setStorageItem("ANILIST_TRACKING", JSON.stringify(state.tracking));
        },

        setAnilistCurrentManga: (state, action: PayloadAction<Anilist.MangaData | null>) => {
            if (action.payload) {
                AniList.setCurrentMangaListId(action.payload.id);
            } else {
                AniList.setCurrentMangaListId(null);
            }
            state.currentManga = action.payload;
        },
    },
});

export const { setAnilistToken, addAnilistTracker, removeAnilistTracker, setAnilistCurrentManga } =
    anilistSlice.actions;

export default anilistSlice.reducer;
