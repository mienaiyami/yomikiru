import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type PendingSettingsNav = {
    id: string;
    /** Bumped on every request so navigating to the same id retriggers apply. */
    requestId: number;
};

type UIState = {
    isOpen: {
        settings: boolean;
        anilist: {
            login: boolean;
            search: boolean;
            edit: boolean;
        };
    };
    /** Catalog target id waiting for Settings to apply; cleared after apply or close. */
    pendingSettingsNav: PendingSettingsNav | null;
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
    pendingSettingsNav: null,
};

const uiSlice = createSlice({
    name: "ui",
    initialState,
    reducers: {
        setSettingsOpen: (state, action: PayloadAction<boolean>) => {
            state.isOpen.settings = action.payload;
            if (!action.payload) state.pendingSettingsNav = null;
        },
        toggleSettingsOpen: (state) => {
            state.isOpen.settings = !state.isOpen.settings;
            if (!state.isOpen.settings) state.pendingSettingsNav = null;
        },
        /** Opens Settings and queues navigation to a settings catalog target id. */
        requestSettingsNav: (state, action: PayloadAction<string>) => {
            state.isOpen.settings = true;
            state.pendingSettingsNav = {
                id: action.payload,
                requestId: (state.pendingSettingsNav?.requestId ?? 0) + 1,
            };
        },
        /** Clears a pending settings navigate request without closing Settings. */
        clearPendingSettingsNav: (state) => {
            state.pendingSettingsNav = null;
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
    requestSettingsNav,
    clearPendingSettingsNav,
    setAnilistLoginOpen,
    setAnilistSearchOpen,
    setAnilistEditOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
