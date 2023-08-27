import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isAniSearchOpen = createSlice({
    name: "isAniSearchOpen",
    initialState,
    reducers: {
        setAniSearchOpen: (state, action: PayloadAction<boolean>) => {
            return action.payload;
        },
    },
});

export const { setAniSearchOpen } = isAniSearchOpen.actions;

export default isAniSearchOpen.reducer;
