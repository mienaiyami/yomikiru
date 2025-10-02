import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const initialState = {
    prev: "",
    next: "",
};

const prevNextChapter = createSlice({
    name: "prevNextChapter",
    initialState,
    reducers: {
        setPrevNextChapter: (_state, action: PayloadAction<{ prev: string; next: string }>) => {
            return action.payload;
        },
    },
});

export const { setPrevNextChapter } = prevNextChapter.actions;

export default prevNextChapter.reducer;
