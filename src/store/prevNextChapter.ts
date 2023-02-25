import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = {
    prev: "",
    next: "",
};

const prevNextChapter = createSlice({
    name: "prevNextChapter",
    initialState,
    reducers: {
        setPrevNextChapter: (state, action: PayloadAction<{ prev: string; next: string }>) => {
            state = action.payload;
            return state;
        },
    },
});

export const { setPrevNextChapter } = prevNextChapter.actions;

export default prevNextChapter.reducer;
