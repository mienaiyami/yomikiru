import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = false;

const isSettingOpen = createSlice({
    name: "isSettingOpen",
    initialState,
    reducers: {
        setOpenSetting: (state, action: PayloadAction<boolean>) => {
            state = action.payload;
            return state;
        },
        toggleOpenSetting: (state) => {
            state = !state;
            return state;
        },
    },
});

export const { setOpenSetting, toggleOpenSetting } = isSettingOpen.actions;

export default isSettingOpen.reducer;
