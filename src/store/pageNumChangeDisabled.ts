import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const pageNumChangeDisabled = createSlice({
    name: "pageNumChangeDisabled",
    initialState,
    reducers: {
        setPageNumChangeDisabled: (state, action: PayloadAction<boolean>) => {
            state = action.payload;
            return state;
        },
    },
});

export const { setPageNumChangeDisabled } = pageNumChangeDisabled.actions;

export default pageNumChangeDisabled.reducer;
