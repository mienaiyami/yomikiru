import { configureStore } from "@reduxjs/toolkit";
import appSettingsReducer from "./appSettings";
import bookmarksReducer from "./bookmarks";
import contextMenuReducer from "./contextMenu";
import historyReducer from "./history";
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

const store = configureStore({
    reducer: {
        appSettings: appSettingsReducer,
        theme: themesReducer,
        bookmarks: bookmarksReducer,
        isSettingOpen: isSettingOpenReducer,
        isReaderOpen: isReaderOpenReducer,
        isLoadingManga: isLoadingMangaReducer,
        unzipping: unzippingReducer,
        pageNumChangeDisabled: pageNumChangeDisabledReducer,
        loadingMangaPercent: loadingMangaPercentReducer,
        linkInReader: linkInReaderReducer,
        prevNextChapter: prevNextChapterReducer,
        mangaInReader: mangaInReaderReducer,
        history: historyReducer,
        shortcuts: shortcutsReducer,
        contextMenu: contextMenuReducer,
        bookInReader: bookInReaderReducer,
        anilistToken: anilistTokenReducer,
        isAniLoginOpen: isAniLoginOpenReducer,
    },
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
