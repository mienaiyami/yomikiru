import { MangaItem } from "@common/types/legacy";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = null as MangaItem | null;

const mangaInReader = createSlice({
    name: "mangaInReader",
    initialState,
    reducers: {
        setMangaInReader: (state, action: PayloadAction<MangaItem | null>) => {
            return action.payload;
        },
    },
});

export const { setMangaInReader } = mangaInReader.actions;

export default mangaInReader.reducer;
