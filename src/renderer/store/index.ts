import { configureStore } from "@reduxjs/toolkit";
import anilistReducer from "./anilist";
import appSettingsReducer from "./appSettings";
import bookmarksReducer from "./bookmarks";
import bookNotesReducer from "./bookNotes";
import libraryReducer from "./library";
import mainSettingsReducer from "./mainSettings";
import prevNextChapterReducer from "./prevNextChapter";
import readerReducer from "./reader";
import shortcutsReducer from "./shortcuts";
import themesReducer from "./themes";
import uiReducer from "./ui";

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
        mainSettings: mainSettingsReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
