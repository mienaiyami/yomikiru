import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isLoadingManga = createSlice({
    name: "isLoadingManga",
    initialState,
    reducers: {
        setLoadingManga: (state, action: PayloadAction<boolean>) => {
            state = action.payload;
            return state;
        },
    },
});

export const { setLoadingManga } = isLoadingManga.actions;

export default isLoadingManga.reducer;
