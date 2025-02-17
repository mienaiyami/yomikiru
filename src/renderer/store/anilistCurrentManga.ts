import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = null as Anilist.MangaData | null;

const anilistCurrentManga = createSlice({
    name: "anilistCurrentManga",
    initialState,
    reducers: {
        setAnilistCurrentManga: (state, action: PayloadAction<Anilist.MangaData | null>) => {
            if (action.payload) window.al.setCurrentMangaListId(action.payload.id);
            else window.al.setCurrentMangaListId(null);
            return action.payload;
        },
    },
});

export const { setAnilistCurrentManga } = anilistCurrentManga.actions;

export default anilistCurrentManga.reducer;
