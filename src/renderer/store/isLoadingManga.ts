import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isLoadingManga = createSlice({
    name: "isLoadingManga",
    initialState,
    reducers: {
        setLoadingManga: (state, action: PayloadAction<boolean>) => {
            return action.payload;
        },
    },
});

export const { setLoadingManga } = isLoadingManga.actions;

export default isLoadingManga.reducer;
