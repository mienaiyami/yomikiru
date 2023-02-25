import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const unzipping = createSlice({
    name: "unzipping",
    initialState,
    reducers: {
        setUnzipping: (state, action: PayloadAction<boolean>) => {
            return action.payload;
        },
    },
});

export const { setUnzipping } = unzipping.actions;

export default unzipping.reducer;
