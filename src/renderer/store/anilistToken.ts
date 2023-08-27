import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = localStorage.getItem("anilist_token") || "";

const anilistToken = createSlice({
    name: "anilistToken",
    initialState,
    reducers: {
        setAnilistToken: (state, action: PayloadAction<string>) => {
            let aa = action.payload;
            if (!aa) aa = "";
            localStorage.setItem("anilist_token", aa);
            window.al.setToken(aa);
            return aa;
        },
    },
});

export const { setAnilistToken } = anilistToken.actions;

export default anilistToken.reducer;
