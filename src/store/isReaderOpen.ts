import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// todo: do i need object for this?
const initialState = false;

const isReaderOpen = createSlice({
    name: "isReaderOpen",
    initialState,
    reducers: {
        setReaderOpen: (state, action: PayloadAction<boolean>) => {
            state = action.payload;
            window.app.isReaderOpen = action.payload;
            return state;
        },
    },
});

export const { setReaderOpen } = isReaderOpen.actions;

export default isReaderOpen.reducer;
