import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = null as BookItem | null;

const bookInReader = createSlice({
    name: "mangaInReader",
    initialState,
    reducers: {
        setBookInReader: (state, action: PayloadAction<BookItem | null>) => {
            return action.payload;
        },
    },
});

export const { setBookInReader } = bookInReader.actions;

export default bookInReader.reducer;
