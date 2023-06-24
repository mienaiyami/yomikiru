import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isAniLoginOpen = createSlice({
    name: "isAniLoginOpen",
    initialState,
    reducers: {
        setAniLoginOpen: (state, action: PayloadAction<boolean>) => {
            return action.payload;
        },
    },
});

export const { setAniLoginOpen } = isAniLoginOpen.actions;

export default isAniLoginOpen.reducer;
