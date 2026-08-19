import { configureStore } from "@reduxjs/toolkit";
import anilistReducer from "./anilist";
import appSettingsReducer from "./appSettings";
import bookmarksReducer from "./bookmarks";
import bookNotesReducer from "./bookNotes";
import libraryReducer from "./library";
import mainSettingsReducer from "./mainSettings";
import prevNextChapterReducer from "./prevNextChapter";
import readerReducer from "./reader";
import readerPresetsReducer from "./readerPresets";
import { readerPresetsAutosaveMiddleware } from "./readerPresetsAutosaveMiddleware";
import shortcutsReducer from "./shortcuts";
import themesReducer from "./themes";
import trackersReducer from "./trackers";
import uiReducer from "./ui";

/**
 * Shared reducer map used by the app store and by isolated Vitest stores
 * (`src/test/renderWithProviders.tsx`).
 */
export const rootReducer = {
    appSettings: appSettingsReducer,
    readerPresets: readerPresetsReducer,
    theme: themesReducer,
    bookmarks: bookmarksReducer,
    bookNotes: bookNotesReducer,
    library: libraryReducer,
    prevNextChapter: prevNextChapterReducer,
    shortcuts: shortcutsReducer,
    anilist: anilistReducer,
    trackers: trackersReducer,
    ui: uiReducer,
    reader: readerReducer,
    mainSettings: mainSettingsReducer,
};

const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }).concat(readerPresetsAutosaveMiddleware),
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
