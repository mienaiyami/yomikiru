import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type PendingSettingsNav = {
    id: string;
    /** Bumped on every request so navigating to the same id retriggers apply. */
    requestId: number;
};

/**
 * One non-dismissible full-window lock. `id` lets nested callers release only
 * their own entry; the last stack item is the one shown.
 */
export type UiBlock = {
    id: string;
    /** Status text on the overlay; omit for a silent lock. */
    message?: string;
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
    /** Stack of {@link UiBlock} entries; empty means the UI is interactive. */
    blocks: UiBlock[];
};

/** {@link blockUi} id for Settings library import, EPUB scan, and thumbnail work. */
export const UI_BLOCK_ID_LIBRARY = "settings-library";

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
    blocks: [],
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

        /**
         * Adds or replaces a UI lock by id. The last stack entry is shown.
         * Call {@link unblockUi} with the same id when the work finishes.
         */
        blockUi: (state, action: PayloadAction<UiBlock>) => {
            const next = action.payload;
            const i = state.blocks.findIndex((b) => b.id === next.id);
            if (i >= 0) state.blocks[i] = next;
            else state.blocks.push(next);
        },
        /** Removes the UI lock with this id. No-op when that id is not in the stack. */
        unblockUi: (state, action: PayloadAction<string>) => {
            state.blocks = state.blocks.filter((b) => b.id !== action.payload);
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
    blockUi,
    unblockUi,
    setAnilistLoginOpen,
    setAnilistSearchOpen,
    setAnilistEditOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
