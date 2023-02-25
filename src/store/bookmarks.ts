import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { bookmarksPath, saveJSONfile } from "../MainImports";

const initialState: ChapterItem[] = [];

if (window.fs.existsSync(bookmarksPath)) {
    const raw = window.fs.readFileSync(bookmarksPath, "utf8");
    if (raw) {
        try {
            const data = JSON.parse(raw);
            initialState.push(...data);
        } catch (err) {
            window.dialog.customError({
                message: "Unable to parse " + bookmarksPath + "\nMaking new bookmarks.json.",
            });
            window.logger.error(err);
            window.fs.writeFileSync(bookmarksPath, "[]");
        }
    }
} else {
    window.fs.writeFileSync(bookmarksPath, "[]");
}

const bookmarks = createSlice({
    name: "bookmarks",
    initialState,
    reducers: {
        addBookmark: (state, action: PayloadAction<ChapterItem | ChapterItem[]>) => {
            if (action.payload instanceof Array) {
                state.unshift(...action.payload);
            } else {
                state.unshift(action.payload);
            }
            saveJSONfile(bookmarksPath, state);
            return state;

            // if (newBk) {
            //     // replace same link with updated pagenumber
            //     const existingBookmark = bookmarks.findIndex((e) => e.link === newBk.link);
            //     if (-1 < existingBookmark) {
            //         if (bookmarks[existingBookmark].page === newBk.page)
            //             return window.dialog.warn({
            //                 title: "Bookmark Already Exist",
            //                 message: "Bookmark Already Exist",
            //             });
            //     }
            //     setBookmarks((init) => [newBk, ...init]);
            // }
        },

        updateBookmark: (state, action: PayloadAction<{ link: string; page: number }>) => {
            const index = state.findIndex((e) => e.link === action.payload.link);
            if (index > -1) {
                state[index].page = action.payload.page;
                saveJSONfile(bookmarksPath, state);
            }
            return state;
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

export const { addBookmark, removeAllBookmarks, removeBookmark, updateBookmark } = bookmarks.actions;

export default bookmarks.reducer;
