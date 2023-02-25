import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = {
    link: window.loadManga || "",
    page: 1,
};

const linkInReader = createSlice({
    name: "linkInReader",
    initialState,
    reducers: {
        setLinkInReader: (state, action: PayloadAction<{ link: string; page: number }>) => {
            state = action.payload;
            return state;
        },
    },
});

export const { setLinkInReader } = linkInReader.actions;

export default linkInReader.reducer;
