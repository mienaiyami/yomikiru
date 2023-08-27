import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isReaderOpen = createSlice({
    name: "isReaderOpen",
    initialState,
    reducers: {
        setReaderOpen: (state, action: PayloadAction<boolean>) => {
            window.app.isReaderOpen = action.payload;
            return action.payload;
        },
    },
});

export const { setReaderOpen } = isReaderOpen.actions;

export default isReaderOpen.reducer;
