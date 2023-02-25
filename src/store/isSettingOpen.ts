import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isSettingOpen = createSlice({
    name: "isSettingOpen",
    initialState,
    reducers: {
        setOpenSetting: (state, action: PayloadAction<boolean>) => {
            return action.payload;
        },
        toggleOpenSetting: (state) => {
            return !state;
        },
    },
});

export const { setOpenSetting, toggleOpenSetting } = isSettingOpen.actions;

export default isSettingOpen.reducer;
