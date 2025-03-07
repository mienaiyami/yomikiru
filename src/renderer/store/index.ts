import { configureStore } from "@reduxjs/toolkit";
import appSettingsReducer from "./appSettings";
// import isLoadingMangaReducer from "./isLoadingManga";
// import loadingMangaPercentReducer from "./loadingMangaPercent";
// import mangaInReaderReducer from "./mangaInReader";
import pageNumChangeDisabledReducer from "./pageNumChangeDisabled";
import prevNextChapterReducer from "./prevNextChapter";
import shortcutsReducer from "./shortcuts";
import themesReducer from "./themes";
// import unzippingReducer from "./unzipping";
// import bookInReaderReducer from "./bookInReader";
import anilistReducer from "./anilist";
import libraryReducer from "./library";
import bookmarksReducer from "./bookmarks";
import uiReducer from "./ui";
import readerReducer from "./reader";

const store = configureStore({
    reducer: {
        appSettings: appSettingsReducer,
        theme: themesReducer,
        bookmarks: bookmarksReducer,
        library: libraryReducer,
        // isLoadingManga: isLoadingMangaReducer,
        // unzipping: unzippingReducer,
        pageNumChangeDisabled: pageNumChangeDisabledReducer,
        // loadingMangaPercent: loadingMangaPercentReducer,
        prevNextChapter: prevNextChapterReducer,
        // mangaInReader: mangaInReaderReducer,
        shortcuts: shortcutsReducer,
        // bookInReader: bookInReaderReducer,
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
