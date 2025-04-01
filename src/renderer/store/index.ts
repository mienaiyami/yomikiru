import { configureStore } from "@reduxjs/toolkit";
import appSettingsReducer from "./appSettings";
import prevNextChapterReducer from "./prevNextChapter";
import shortcutsReducer from "./shortcuts";
import themesReducer from "./themes";
import anilistReducer from "./anilist";
import libraryReducer from "./library";
import bookmarksReducer from "./bookmarks";
import bookNotesReducer from "./bookNotes";
import uiReducer from "./ui";
import readerReducer from "./reader";

const store = configureStore({
    reducer: {
        appSettings: appSettingsReducer,
        theme: themesReducer,
        bookmarks: bookmarksReducer,
        bookNotes: bookNotesReducer,
        library: libraryReducer,
        prevNextChapter: prevNextChapterReducer,
        shortcuts: shortcutsReducer,
        anilist: anilistReducer,
        ui: uiReducer,
        reader: readerReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
