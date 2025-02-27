import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import AniList from "@utils/anilist";

const initialState = null as Anilist.MangaData | null;

const anilistCurrentManga = createSlice({
    name: "anilistCurrentManga",
    initialState,
    reducers: {
        setAnilistCurrentManga: (state, action: PayloadAction<Anilist.MangaData | null>) => {
            if (action.payload) AniList.setCurrentMangaListId(action.payload.id);
            else AniList.setCurrentMangaListId(null);
            return action.payload;
        },
    },
});

export const { setAnilistCurrentManga } = anilistCurrentManga.actions;

export default anilistCurrentManga.reducer;
