import { createSlice, current, original, PayloadAction } from "@reduxjs/toolkit";
import { historyPath, saveJSONfile } from "../MainImports";

const initialState: HistoryItem[] = [];

/**
 * updating from old schema to new to support epub
 */
const updateHistory = (data: any): HistoryItem[] => {
    window.logger.log("Upadting bookmark to support EPUB.", data);
    const newHistory: HistoryItem[] = [];
    data.forEach((e: any) => {
        if (e.type) newHistory.push(e);
        else
            newHistory.push({
                type: "image",
                data: e,
            });
    });
    saveJSONfile(historyPath, newHistory);
    return newHistory;
};

const readHistory = (): HistoryItem[] => {
    if (window.fs.existsSync(historyPath)) {
        const raw = window.fs.readFileSync(historyPath, "utf8");
        if (raw) {
            try {
                const data = JSON.parse(raw);
                // if (data[0] && !data[0].chaptersRead) throw new Error("History format changed.");

                if (data.length === 0 || data[0].type) return data;
                else return updateHistory(data);
            } catch (err) {
                // if ((err as Error).message === "History format changed.")
                //     window.dialog.customError({
                //         message: "History format changed.\nSorry for the inconvenience.",
                //     });
                // else
                window.dialog.customError({
                    message: "Unable to parse " + historyPath + "\nMaking new history.json...",
                });
                window.logger.error(err);
                window.fs.writeFileSync(historyPath, "[]");
                return [];
            }
        } else return [];
    } else {
        window.fs.writeFileSync(historyPath, "[]");
        return [];
    }
};

const historyData = readHistory();
// if (historyData.length === 0) window.fs.writeFileSync(historyPath, "[]");
initialState.push(...historyData);

type NewHistoryData =
    | {
          type: "image";
          data: { mangaOpened: MangaItem; page: number; recordChapter: boolean };
      }
    | {
          type: "book";
          data: {
              bookOpened: BookItem;
              /**
               * css query string of element to focus on load
               */
              elementQueryString: string;
          };
      };
/**
 * ! im not returning state as it auto refresh on saveJSONfile
 */
const history = createSlice({
    name: "history",
    initialState,
    reducers: {
        newHistory: (state, action: PayloadAction<NewHistoryData>) => {
            const { type, data } = action.payload;
            const stateDup: HistoryItem[] = JSON.parse(JSON.stringify(state));
            if (type === "image") {
                const link = data.mangaOpened.link;
                let index = -1;
                if (stateDup.length > 0)
                    index = stateDup.findIndex(
                        (e) => (e as MangaHistoryItem).data.mangaLink === window.path.dirname(link)
                    );
                let chaptersRead = new Set<string>();
                if (index > -1) {
                    chaptersRead = new Set(
                        data.recordChapter ? (stateDup[index] as MangaHistoryItem).data.chaptersRead : []
                    );
                    stateDup.splice(index, 1);
                }
                chaptersRead.add(data.mangaOpened.chapterName);
                stateDup.unshift({
                    type: "image",
                    data: {
                        ...data.mangaOpened,
                        page: data.page,
                        mangaLink: window.path.dirname(link),
                        chaptersRead: Array.from(chaptersRead),
                    },
                });
            }
            if (type === "book") {
                const link = data.bookOpened.link;
                let index = -1;
                if (stateDup.length > 0)
                    index = stateDup.findIndex((e) => (e as BookHistoryItem).data.link === link);
                if (index > -1) {
                    stateDup.splice(index, 1);
                }
                stateDup.unshift({
                    type: "book",
                    data: {
                        ...data.bookOpened,
                        elementQueryString: data.elementQueryString,
                    },
                });
            }
            saveJSONfile(historyPath, stateDup);
        },
        // todo: getlink from state directly;
        // todo: fix; when called in App.tsx linkInReader is initialVlue even if changed
        // updateLastHistoryPage: (state, action: PayloadAction<{ linkInReader: string }>) => {
        //     const index = state.findIndex((e) => e.link === action.payload.linkInReader);
        //     // todo : removed ` || action.payload.linkInReader === ""`; check consequences
        //     // not working on closing window
        //     // use sth like window.lastMangaOpened;
        //     window.logger.log("asking to save ", action.payload);
        //     if (index > -1) {
        //         console.log(`Updating ${state[index].mangaName} to page ${window.app.currentPageNumber}`);
        //         state[index].page = window.app.currentPageNumber;
        //         saveJSONfile(historyPath, state);
        //     }
        // },

        /**
         * only for manga/image reader
         */
        updateCurrentHistoryPage: (state) => {
            const stateDup: HistoryItem[] = JSON.parse(JSON.stringify(state));
            const link = window.app.linkInReader.link;
            const index = stateDup.findIndex((e) => e.data.link === link);
            if (index > -1) {
                // console.log(
                //     `Updating ${(stateDup[index] as MangaHistoryItem).data.mangaName} to page ${
                //         window.app.currentPageNumber
                //     }`
                // );
                (stateDup[index] as MangaHistoryItem).data.page = window.app.currentPageNumber;
                saveJSONfile(historyPath, stateDup);
            }
        },
        /**
         * only for epub reader
         */
        updateCurrentBookHistory: (state) => {
            const stateDup: HistoryItem[] = JSON.parse(JSON.stringify(state));
            const link = window.app.linkInReader.link;
            const index = stateDup.findIndex((e) => e.data.link === link);
            if (index > -1 && window.app.epubHistorySaveData) {
                const oldData = stateDup[index];
                stateDup.splice(index, 1);
                (oldData as BookHistoryItem).data.chapter = window.app.epubHistorySaveData.chapter;
                (oldData as BookHistoryItem).data.chapterURL = window.app.epubHistorySaveData.chapterURL;
                (oldData as BookHistoryItem).data.elementQueryString = window.app.epubHistorySaveData.queryString;
                (oldData as BookHistoryItem).data.date = new Date().toLocaleString("en-UK", { hour12: true });
                stateDup.unshift(oldData);
                saveJSONfile(historyPath, stateDup);
            }
        },
        readChapter: (state, action: PayloadAction<{ mangaIndex: number; chapters: string[] }>) => {
            const { mangaIndex, chapters } = action.payload;
            if (mangaIndex >= 0 && chapters.length > 0) {
                try {
                    const stateDup: HistoryItem[] = JSON.parse(JSON.stringify(state));
                    const chaptersRead = (stateDup[mangaIndex] as MangaHistoryItem).data.chaptersRead;
                    chaptersRead.push(...chapters);
                    (stateDup[mangaIndex] as MangaHistoryItem).data.chaptersRead = Array.from(
                        new Set(chaptersRead)
                    );
                    saveJSONfile(historyPath, stateDup);
                } catch (reason) {
                    window.logger.error("Unable to mark chapter as read.", reason);
                }
            }
        },
        unreadAllChapter: (state, action: PayloadAction<number>) => {
            if (action.payload >= 0) {
                try {
                    const stateDup: HistoryItem[] = JSON.parse(JSON.stringify(state));
                    (stateDup[action.payload] as MangaHistoryItem).data.chaptersRead = [];
                    saveJSONfile(historyPath, stateDup);
                } catch (reason) {
                    window.logger.error("Unable to mark chapter as Unread.", reason);
                }
            }
        },
        unreadChapter: (state, action: PayloadAction<[number, number]>) => {
            if (action.payload[0] >= 0 && action.payload[1] >= 0) {
                try {
                    const stateDup: HistoryItem[] = JSON.parse(JSON.stringify(state));
                    (stateDup[action.payload[0]] as MangaHistoryItem).data.chaptersRead.splice(
                        action.payload[1],
                        1
                    );
                    saveJSONfile(historyPath, stateDup);
                } catch (reason) {
                    window.logger.error("Unable to mark chapter as Unread.", reason);
                }
            }
        },
        refreshHistory: () => {
            let newState = readHistory();
            if (newState.length === 0) newState = readHistory();
            return newState;
        },
        removeHistory: (state, action: PayloadAction<string>) => {
            const index = state.findIndex((e) => e.data.link.toLowerCase() === action.payload.toLowerCase());
            if (index >= 0) {
                state.splice(index, 1);
                saveJSONfile(historyPath, current(state));
            }
        },
        deleteAllHistory: () => {
            saveJSONfile(historyPath, []);
            return [];
        },
    },
});

export const {
    newHistory,
    updateCurrentHistoryPage,
    updateCurrentBookHistory,
    deleteAllHistory,
    removeHistory,
    unreadChapter,
    refreshHistory,
    readChapter,
    unreadAllChapter,
} = history.actions;

export default history.reducer;
