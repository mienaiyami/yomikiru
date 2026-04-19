import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import AniList from "@utils/anilist";

type AnilistState = {
    token: string | null;
    tracking: Anilist.TrackStore;
    currentManga: Anilist.MangaData | null;
    /** When set, AniList search / track UI uses this library path instead of `reader.content` (e.g. gallery). */
    galleryTrackContext: { link: string; title: string } | null;
};

const initialState: AnilistState = {
    token: AniList.getStorageToken(),
    tracking: AniList.loadTrackingFromStorage(),
    currentManga: null,
    galleryTrackContext: null,
};

const anilistSlice = createSlice({
    name: "anilist",
    initialState,
    reducers: {
        setAnilistToken: (state, action: PayloadAction<string | null>) => {
            const newToken = action.payload || "";
            AniList.setStorageToken(newToken);
            AniList.setToken(newToken);
            state.token = action.payload;
        },

        addAnilistTracker: (state, action: PayloadAction<Anilist.TrackItem>) => {
            state.tracking.push(action.payload);
            AniList.setStorageTracking(state.tracking);
        },
        /**
         * @param action local URL of manga
         */
        removeAnilistTracker: (state, action: PayloadAction<string>) => {
            const index = state.tracking.findIndex((item) => item.localURL === action.payload);
            if (index !== -1) {
                state.tracking.splice(index, 1);
            }
            AniList.setStorageTracking(state.tracking);
        },

        setAnilistCurrentManga: (state, action: PayloadAction<Anilist.MangaData | null>) => {
            if (action.payload) {
                AniList.setCurrentMangaListId(action.payload.id);
            } else {
                AniList.setCurrentMangaListId(null);
            }
            state.currentManga = action.payload;
        },

        setGalleryTrackContext: (state, action: PayloadAction<{ link: string; title: string } | null>) => {
            state.galleryTrackContext = action.payload;
        },
    },
});

export const {
    setAnilistToken,
    addAnilistTracker,
    removeAnilistTracker,
    setAnilistCurrentManga,
    setGalleryTrackContext,
} = anilistSlice.actions;

export default anilistSlice.reducer;
