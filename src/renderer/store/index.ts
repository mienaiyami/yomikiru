import { configureStore } from "@reduxjs/toolkit";
import appSettingsReducer from "./appSettings";
// import contextMenuReducer from "./contextMenu";
import isLoadingMangaReducer from "./isLoadingManga";
import isReaderOpenReducer from "./isReaderOpen";
import isSettingOpenReducer from "./isSettingOpen";
import linkInReaderReducer from "./linkInReader";
import loadingMangaPercentReducer from "./loadingMangaPercent";
import mangaInReaderReducer from "./mangaInReader";
import pageNumChangeDisabledReducer from "./pageNumChangeDisabled";
import prevNextChapterReducer from "./prevNextChapter";
import shortcutsReducer from "./shortcuts";
import themesReducer from "./themes";
import unzippingReducer from "./unzipping";
import bookInReaderReducer from "./bookInReader";
import anilistTokenReducer from "./anilistToken";
import isAniLoginOpenReducer from "./isAniLoginOpen";
import anilistTrackingReducer from "./anilistTracking";
import isAniSearchOpenReducer from "./isAniSearchOpen";
import anilistCurrentMangaReducer from "./anilistCurrentManga";
import isAniEditOpenReducer from "./isAniEditOpen";

import libraryReducer from "./library";
import bookmarksReducer from "./bookmarks";

const store = configureStore({
    reducer: {
        appSettings: appSettingsReducer,
        theme: themesReducer,
        bookmarks: bookmarksReducer,
        library: libraryReducer,
        isSettingOpen: isSettingOpenReducer,
        isReaderOpen: isReaderOpenReducer,
        isLoadingManga: isLoadingMangaReducer,
        unzipping: unzippingReducer,
        pageNumChangeDisabled: pageNumChangeDisabledReducer,
        loadingMangaPercent: loadingMangaPercentReducer,
        linkInReader: linkInReaderReducer,
        prevNextChapter: prevNextChapterReducer,
        mangaInReader: mangaInReaderReducer,
        shortcuts: shortcutsReducer,
        // contextMenu: contextMenuReducer,
        bookInReader: bookInReaderReducer,
        anilistToken: anilistTokenReducer,
        isAniLoginOpen: isAniLoginOpenReducer,
        anilistTracking: anilistTrackingReducer,
        isAniSearchOpen: isAniSearchOpenReducer,
        anilistCurrentManga: anilistCurrentMangaReducer,
        isAniEditOpen: isAniEditOpenReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
