import { createSlice, PayloadAction } from "@reduxjs/toolkit";
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
    saveJSONfile(historyPath, newHistory, true);
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

const history = createSlice({
    name: "history",
    initialState,
    reducers: {
        newHistory: (state, action: PayloadAction<NewHistoryData>) => {
            const { type, data } = action.payload;
            if (type === "image") {
                const link = data.mangaOpened.link;
                let index = -1;
                if (state.length > 0)
                    index = state.findIndex(
                        (e) => (e as MangaHistoryItem).data.mangaLink === window.path.dirname(link)
                    );
                let chaptersRead = new Set<string>();
                if (index > -1) {
                    chaptersRead = new Set(
                        data.recordChapter ? (state[index] as MangaHistoryItem).data.chaptersRead : []
                    );
                    state.splice(index, 1);
                }
                chaptersRead.add(data.mangaOpened.chapterName);
                state.unshift({
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
                if (state.length > 0) index = state.findIndex((e) => (e as BookHistoryItem).data.link === link);
                if (index > -1) {
                    state.splice(index, 1);
                }
                state.unshift({
                    type: "book",
                    data: {
                        ...data.bookOpened,
                        elementQueryString: data.elementQueryString,
                    },
                });
            }
            saveJSONfile(historyPath, state);
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
        updateLastHistoryPage: (state) => {
            const stateDup = [...state];
            const link = window.app.linkInReader.link;
            // todo:
            // const index = stateDup.findIndex((e) => e.link === link);
            // // not working on closing window
            // // use sth like window.lastMangaOpened;
            // // window.logger.log("asking to save ", link);
            // if (index > -1) {
            //     // console.log(`Updating ${stateDup[index].mangaName} to page ${window.app.currentPageNumber}`);
            //     stateDup[index].page = window.app.currentPageNumber;
            //     saveJSONfile(historyPath, stateDup);
            // }
        },
        refreshHistory: () => {
            let newState = readHistory();
            if (newState.length === 0) newState = readHistory();
            return newState;
        },
        removeHistory: (state, action: PayloadAction<number>) => {
            state.splice(action.payload, 1);
            saveJSONfile(historyPath, state);
        },
        deleteAllHistory: () => {
            saveJSONfile(historyPath, []);
            return [];
        },
    },
});

export const { newHistory, updateLastHistoryPage, deleteAllHistory, removeHistory, refreshHistory } =
    history.actions;

export default history.reducer;
