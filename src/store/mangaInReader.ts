import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// todo: maybe not safe; coz this needs to be null sometimes as well
const initialState: ListItem = null!;

const mangaInReader = createSlice({
    name: "mangaInReader",
    initialState,
    reducers: {
        setMangaInReader: (state, action: PayloadAction<ListItem>) => {
            state = action.payload;
            return state;
        },
    },
});

export const { setMangaInReader } = mangaInReader.actions;

export default mangaInReader.reducer;
