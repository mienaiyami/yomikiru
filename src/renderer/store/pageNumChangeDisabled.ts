import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const pageNumChangeDisabled = createSlice({
    name: "pageNumChangeDisabled",
    initialState,
    reducers: {
        setPageNumChangeDisabled: (state, action: PayloadAction<boolean>) => {
            return action.payload;
        },
    },
});

export const { setPageNumChangeDisabled } = pageNumChangeDisabled.actions;

export default pageNumChangeDisabled.reducer;
