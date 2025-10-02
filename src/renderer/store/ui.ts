import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type UIState = {
    isOpen: {
        settings: boolean;
        anilist: {
            login: boolean;
            search: boolean;
            edit: boolean;
        };
    };
};

const initialState: UIState = {
    isOpen: {
        settings: false,
        anilist: {
            login: false,
            search: false,
            edit: false,
        },
    },
};

const uiSlice = createSlice({
    name: "ui",
    initialState,
    reducers: {
        setSettingsOpen: (state, action: PayloadAction<boolean>) => {
            state.isOpen.settings = action.payload;
        },
        toggleSettingsOpen: (state) => {
            state.isOpen.settings = !state.isOpen.settings;
        },

        setAnilistLoginOpen: (state, action: PayloadAction<boolean>) => {
            state.isOpen.anilist.login = action.payload;
        },
        setAnilistSearchOpen: (state, action: PayloadAction<boolean>) => {
            state.isOpen.anilist.search = action.payload;
        },
        setAnilistEditOpen: (state, action: PayloadAction<boolean>) => {
            state.isOpen.anilist.edit = action.payload;
        },
    },
});

export const {
    setSettingsOpen,
    toggleSettingsOpen,
    setAnilistLoginOpen,
    setAnilistSearchOpen,
    setAnilistEditOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
