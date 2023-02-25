import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = null as ListItem | null;

const mangaInReader = createSlice({
    name: "mangaInReader",
    initialState,
    reducers: {
        setMangaInReader: (state, action: PayloadAction<ListItem | null>) => {
            return action.payload;
        },
    },
});

export const { setMangaInReader } = mangaInReader.actions;

export default mangaInReader.reducer;
