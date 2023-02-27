import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = {
    link: window.loadManga || "",
    page: 5,
};

const linkInReader = createSlice({
    name: "linkInReader",
    initialState,
    reducers: {
        setLinkInReader: (state, action: PayloadAction<typeof initialState>) => {
            return { ...action.payload };
        },
    },
});

export const { setLinkInReader } = linkInReader.actions;

export default linkInReader.reducer;
