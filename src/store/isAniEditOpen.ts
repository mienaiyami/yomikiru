import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isAniEditOpen = createSlice({
    name: "isAniEditOpen",
    initialState,
    reducers: {
        setAniEditOpen: (state, action: PayloadAction<boolean>) => {
            return action.payload;
        },
    },
});

export const { setAniEditOpen } = isAniEditOpen.actions;

export default isAniEditOpen.reducer;
