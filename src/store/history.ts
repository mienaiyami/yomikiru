import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { historyPath, saveJSONfile } from "../MainImports";

const initialState: HistoryItem[] = [];

if (window.fs.existsSync(historyPath)) {
    const raw = window.fs.readFileSync(historyPath, "utf8");
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if (data[0] && !data[0].chaptersRead) throw new Error("History format changed.");
            initialState.push(...data);
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
        }
    }
} else {
    window.fs.writeFileSync(historyPath, "[]");
}

const history = createSlice({
    name: "history",
    initialState,
    reducers: {
        newHistory: (state, action: PayloadAction<{ mangaOpened: ListItem; page: number }>) => {
            const { mangaOpened, page } = action.payload;
            const link = mangaOpened.link;
            let index = -1;
            if (state.length > 0) index = state.findIndex((e) => e.mangaLink === window.path.dirname(link));
            let chaptersRead = new Set<string>();
            if (index > -1) {
                chaptersRead = new Set(state[index].chaptersRead);
                state.splice(index, 1);
            }
            chaptersRead.add(mangaOpened.chapterName);
            state.unshift({
                ...mangaOpened,
                page: page,
                mangaLink: window.path.dirname(link),
                chaptersRead: Array.from(chaptersRead),
            });
        },
        // todo: getlink from state directly;
        updateLastHistoryPage: (state, action: PayloadAction<{ linkInReader: string }>) => {
            if (
                (state.length > 0 && state[0] && state[0].link && state[0].link === action.payload.linkInReader) ||
                action.payload.linkInReader === ""
            ) {
                state[0].page = window.app.currentPageNumber;
                saveJSONfile(historyPath, state);
            }
            return state;
        },
        removeHistory: (state, action: PayloadAction<number>) => {
            state.splice(action.payload, 1);
        },
        deleteAllHistory: (state) => {
            state = [];
            saveJSONfile(historyPath, state);
            return state;
        },
    },
});

export const { newHistory, updateLastHistoryPage, deleteAllHistory, removeHistory } = history.actions;

export default history.reducer;
