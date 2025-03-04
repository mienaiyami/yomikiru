import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import AniList from "@utils/anilist";

type AnilistState = {
    token: string | null;
    tracking: Anilist.TrackStore;
    currentManga: Anilist.MangaData | null;
};

let initialTracking: Anilist.TrackStore = [];
let initialToken: string | null = null;
try {
    initialTracking = JSON.parse(localStorage.getItem("anilist_tracking") || "[]");
    initialTracking = initialTracking.filter((e) => {
        // todo: cleanup later with async for performance?
        if (!window.fs.existsSync(e.localURL)) {
            window.logger.log(`"${e.localURL}" no longer exist, removing from AniList Tracking.`);
            return false;
        }
        return true;
    });

    initialToken = localStorage.getItem("anilist_token") || null;
} catch (e) {
    console.error(e);
}

const initialState: AnilistState = {
    //todo: maybe dont need token in store? maintain in Anilist class?
    token: initialToken,
    tracking: initialTracking,
    currentManga: null,
};

const anilistSlice = createSlice({
    name: "anilist",
    initialState,
    reducers: {
        setAnilistToken: (state, action: PayloadAction<string | null>) => {
            const newToken = action.payload || "";
            localStorage.setItem("anilist_token", newToken);
            AniList.setToken(newToken);
            state.token = action.payload;
        },

        addAnilistTracker: (state, action: PayloadAction<Anilist.TrackItem>) => {
            state.tracking.push(action.payload);
            localStorage.setItem("anilist_tracking", JSON.stringify(state.tracking));
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
            localStorage.setItem("anilist_tracking", JSON.stringify(state.tracking));
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
