import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { bookmarksPath, saveJSONfile } from "../MainImports";

const initialState: Manga_BookItem[] = [];
/**
 * updating from old schema to new to support epub
 */
const updateBookmarks = (data: any): Manga_BookItem[] => {
    window.logger.log("Upadting bookmark to support EPUB.", data);
    const newBk: Manga_BookItem[] = [];
    data.forEach((e: any) => {
        if (e.type) newBk.push(e);
        else
            newBk.push({
                type: "image",
                data: e,
            });
    });
    saveJSONfile(bookmarksPath, newBk, true);
    return newBk;
};

const readBookmark = (): Manga_BookItem[] => {
    if (window.fs.existsSync(bookmarksPath)) {
        const raw = window.fs.readFileSync(bookmarksPath, "utf8");
        if (raw) {
            try {
                const data = JSON.parse(raw);
                if (data.length === 0 || data[0].type) return data;
                else return updateBookmarks(data);
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + bookmarksPath + "\nMaking new bookmarks.json.",
                });
                window.logger.error(err);
                window.fs.writeFileSync(bookmarksPath, "[]");
                return [];
            }
        } else return [];
    } else {
        window.fs.writeFileSync(bookmarksPath, "[]");
        return [];
    }
};

const bookmarkData = readBookmark();
// if (bookmarkData.length === 0) window.fs.writeFileSync(bookmarksPath, "[]");
initialState.push(...bookmarkData);

const bookmarks = createSlice({
    name: "bookmarks",
    initialState,
    reducers: {
        addBookmark: (state, action: PayloadAction<Manga_BookItem | Manga_BookItem[]>) => {
            if (action.payload instanceof Array) {
                const newBks = action.payload.reverse();
                newBks.forEach((newBk) => {
                    const existingBookmark = state.findIndex((e) => e.data.link === newBk.data.link);
                    if (existingBookmark > -1) state.splice(existingBookmark, 1);
                    state.unshift(newBk);
                });
                state.unshift(...action.payload);
            } else {
                const newBk = action.payload;
                const existingBookmark = state.findIndex((e) => e.data.link === newBk.data.link);
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
            const index = state.findIndex((e) => e.data.link === action.payload.link);
            if (index > -1) {
                if (
                    window.fs.lstatSync(action.payload.link).isFile() &&
                    window.path.extname(action.payload.link).toLowerCase() === ".epub"
                ) {
                    console.error("Bookmarking epub not yet supported");
                } else {
                    (state[index].data as ChapterItem).page = action.payload.page;
                }
                saveJSONfile(bookmarksPath, state);
            }
            return state;
        },
        refreshBookmark: () => {
            return readBookmark();
        },
        // action.payload : link of chapter
        removeBookmark: (state, action: PayloadAction<string>) => {
            const newState = state.filter((e) => e.data.link !== action.payload);
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
