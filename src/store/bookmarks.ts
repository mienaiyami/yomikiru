import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { bookmarksPath, saveJSONfile } from "../MainImports";

const initialState: ChapterItem[] = [];

const readBookmark = (): ChapterItem[] => {
    if (window.fs.existsSync(bookmarksPath)) {
        const raw = window.fs.readFileSync(bookmarksPath, "utf8");
        if (raw) {
            try {
                const data = JSON.parse(raw);
                return data;
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + bookmarksPath + "\nMaking new bookmarks.json.",
                });
                window.logger.error(err);
                return [];
            }
        } else return [];
    } else {
        return [];
    }
};

const bookmarkData = readBookmark();
if (bookmarkData.length === 0) window.fs.writeFileSync(bookmarksPath, "[]");
initialState.push(...bookmarkData);

const bookmarks = createSlice({
    name: "bookmarks",
    initialState,
    reducers: {
        addBookmark: (state, action: PayloadAction<ChapterItem | ChapterItem[]>) => {
            if (action.payload instanceof Array) {
                const newBks = action.payload.reverse();
                newBks.forEach((newBk) => {
                    const existingBookmark = state.findIndex((e) => e.link === newBk.link);
                    if (existingBookmark > -1) state.splice(existingBookmark, 1);
                    state.unshift(newBk);
                });
                state.unshift(...action.payload);
            } else {
                const newBk = action.payload;
                const existingBookmark = state.findIndex((e) => e.link === newBk.link);
                if (existingBookmark > -1) {
                    // if (state[existingBookmark].page === newBk.page){
                    //     window.dialog.warn({
                    //         title: "Bookmark Already Exist",
                    //         message: "Bookmark Already Exist",
                    //     });
                    // }
                    // else
                    state.splice(existingBookmark, 1);
                }
                state.unshift(newBk);
            }
            saveJSONfile(bookmarksPath, state);
        },

        updateBookmark: (state, action: PayloadAction<{ link: string; page: number }>) => {
            const index = state.findIndex((e) => e.link === action.payload.link);
            if (index > -1) {
                state[index].page = action.payload.page;
                saveJSONfile(bookmarksPath, state);
            }
            return state;
        },
        refreshBookmark: () => {
            return readBookmark();
        },
        // action.payload : link of chapter
        removeBookmark: (state, action: PayloadAction<string>) => {
            const newState = state.filter((e) => e.link !== action.payload);
            saveJSONfile(bookmarksPath, newState);
            return newState;
        },
        removeAllBookmarks: () => {
            saveJSONfile(bookmarksPath, []);
            return [];
        },
    },
});

export const { addBookmark, removeAllBookmarks, removeBookmark, updateBookmark, refreshBookmark } =
    bookmarks.actions;

export default bookmarks.reducer;
