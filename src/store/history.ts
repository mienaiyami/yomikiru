import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { historyPath, saveJSONfile } from "../MainImports";

const initialState: HistoryItem[] = [];

const readHistory = (): HistoryItem[] => {
    if (window.fs.existsSync(historyPath)) {
        const raw = window.fs.readFileSync(historyPath, "utf8");
        if (raw) {
            try {
                const data = JSON.parse(raw);
                if (data[0] && !data[0].chaptersRead) throw new Error("History format changed.");
                return data;
            } catch (err) {
                if ((err as Error).message === "History format changed.")
                    window.dialog.customError({
                        message: "History format changed.\nSorry for the inconvenience.",
                    });
                else
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

const history = createSlice({
    name: "history",
    initialState,
    reducers: {
        newHistory: (
            state,
            action: PayloadAction<{ mangaOpened: ListItem; page: number; recordChapter: boolean }>
        ) => {
            const { mangaOpened, page, recordChapter } = action.payload;
            const link = mangaOpened.link;
            let index = -1;
            if (state.length > 0) index = state.findIndex((e) => e.mangaLink === window.path.dirname(link));
            let chaptersRead = new Set<string>();
            if (index > -1) {
                chaptersRead = new Set(recordChapter ? state[index].chaptersRead : []);
                state.splice(index, 1);
            }
            chaptersRead.add(mangaOpened.chapterName);
            state.unshift({
                ...mangaOpened,
                page: page,
                mangaLink: window.path.dirname(link),
                chaptersRead: Array.from(chaptersRead),
            });
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
            const index = stateDup.findIndex((e) => e.link === link);
            // not working on closing window
            // use sth like window.lastMangaOpened;
            // window.logger.log("asking to save ", link);
            if (index > -1) {
                // console.log(`Updating ${stateDup[index].mangaName} to page ${window.app.currentPageNumber}`);
                stateDup[index].page = window.app.currentPageNumber;
                saveJSONfile(historyPath, stateDup);
            }
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
