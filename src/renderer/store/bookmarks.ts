// import { createSlice, current, PayloadAction } from "@reduxjs/toolkit";
// import { bookmarksPath, saveJSONfile } from "../utils/paths";

// const initialState: Manga_BookItem[] = [];
// /**
//  * updating from old schema to new to support epub
//  */
// const updateBookmarks = (data: any): Manga_BookItem[] => {
//     window.logger.log("Upadting bookmark to support EPUB.", data);
//     const newBk: Manga_BookItem[] = [];
//     data.forEach((e: any) => {
//         if (e.type) newBk.push(e);
//         else
//             newBk.push({
//                 type: "image",
//                 data: e,
//             });
//     });
//     saveJSONfile(bookmarksPath, newBk);
//     return newBk;
// };
// /**
//  * 13/05/2024
//  * changes made to remove bookmarks.json and adding dependency on history.json
//  */
// const updateBookmarksV2 = (data: unknown) => {};

// const readBookmark = (): Manga_BookItem[] => {
//     if (window.fs.existsSync(bookmarksPath)) {
//         const raw = window.fs.readFileSync(bookmarksPath, "utf8");
//         if (raw) {
//             try {
//                 const data = JSON.parse(raw);
//                 if (data.length === 0 || data[0].type) return data;
//                 else return updateBookmarks(data);
//             } catch (err) {
//                 dialogUtils.customError({
//                     message: "Unable to parse " + bookmarksPath + "\nMaking new bookmarks.json.",
//                 });
//                 window.logger.error(err);
//                 window.fs.writeFileSync(bookmarksPath, "[]");
//                 return [];
//             }
//         } else return [];
//     } else {
//         window.fs.writeFileSync(bookmarksPath, "[]");
//         return [];
//     }
// };

// const bookmarkData = readBookmark();
// // if (bookmarkData.length === 0) window.fs.writeFileSync(bookmarksPath, "[]");
// initialState.push(...bookmarkData);

// const bookmarks = createSlice({
//     name: "bookmarks",
//     initialState,
//     reducers: {
//         addBookmark: (state, action: PayloadAction<Manga_BookItem | Manga_BookItem[]>) => {
//             if (action.payload instanceof Array) {
//                 const newBks = action.payload.reverse();
//                 newBks.forEach((newBk) => {
//                     const existingBookmark = state.findIndex((e) => e.data.link === newBk.data.link);
//                     if (existingBookmark > -1) state.splice(existingBookmark, 1);
//                     state.unshift(newBk);
//                 });
//                 // state.unshift(...action.payload);
//             } else {
//                 const newBk = action.payload;

//                 const existingBookmark = state.findIndex((e) => e.data.link === newBk.data.link);
//                 if (existingBookmark > -1) {
//                     // if (state[existingBookmark].page === newBk.page){
//                     //     dialogUtils.warn({
//                     //         title: "Bookmark Already Exist",
//                     //         message: "Bookmark Already Exist",
//                     //     });
//                     // }
//                     // else
//                     state.splice(existingBookmark, 1);
//                 }
//                 state.unshift(newBk);
//             }
//             saveJSONfile(bookmarksPath, current(state));
//         },

//         updateBookmark: (state, action: PayloadAction<{ link: string; page: number }>) => {
//             const index = state.findIndex((e) => e.data.link === action.payload.link);
//             if (index > -1) {
//                 if (
//                     window.fs.lstatSync(action.payload.link).isFile() &&
//                     window.path.extname(action.payload.link).toLowerCase() === ".epub"
//                 ) {
//                     console.error("Use `updateEPUBBookmark`");
//                 } else {
//                     (state[index].data as ChapterItem).page = action.payload.page;
//                 }
//                 saveJSONfile(bookmarksPath, current(state));
//             }
//             return state;
//         },
//         updateEPUBBookmark: (state, action: PayloadAction<{ link: string }>) => {
//             const index = state.findIndex((e) => e.data.link === action.payload.link);
//             if (index > -1 && window.app.epubHistorySaveData) {
//                 (state[index].data as BookItem).chapterData = {
//                     ...window.app.epubHistorySaveData,
//                 };
//                 saveJSONfile(bookmarksPath, current(state));
//             }
//             return state;
//         },
//         refreshBookmark: () => {
//             return readBookmark();
//         },
//         // action.payload : link of chapter
//         removeBookmark: (state, action: PayloadAction<string>) => {
//             const newState = state.filter((e) => e.data.link !== action.payload);
//             saveJSONfile(bookmarksPath, newState);
//             return newState;
//         },
//         removeAllBookmarks: () => {
//             saveJSONfile(bookmarksPath, []);
//             return [];
//         },
//     },
// });

// export const {
//     addBookmark,
//     removeAllBookmarks,
//     removeBookmark,
//     updateEPUBBookmark,
//     updateBookmark,
//     refreshBookmark,
// } = bookmarks.actions;

// export default bookmarks.reducer;

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { MangaBookmark, BookBookmark } from "@common/types/db";
import { DatabaseChannels } from "@common/types/ipc";

type BookmarksState = {
    // map of key:itemLink value: bookmarks
    manga: Record<string, MangaBookmark[]>;
    book: Record<string, BookBookmark[]>;
    loading: boolean;
    error: string | null;
};
const initialState: BookmarksState = {
    manga: {},
    book: {},
    loading: false,
    error: null,
};
export const fetchAllBookmarks = createAsyncThunk("bookmarks/fetchAll", async () => {
    const bookmarks = await window.electron.invoke("db:library:getAllBookmarks");
    console.log({ bookmarks });
    return bookmarks;
});

// export const fetchBookmarks = createAsyncThunk(
//     "bookmarks/fetch",
//     async ({ itemLink, type }: { itemLink: string; type: "manga" | "book" }) => {
//         const bookmarks = await ipc.invoke(`db:${type}:getBookmarks`, { itemLink });
//         return bookmarks;
//     }
// );

export const addBookmark = createAsyncThunk(
    "bookmarks/add",
    async ({
        data,
        type,
    }: {
        data: DatabaseChannels["db:book:addBookmark" | "db:manga:addBookmark"]["request"];
        type: "manga" | "book";
    }) => {
        const bookmark = await window.electron.invoke(`db:${type}:addBookmark`, data);
        console.log({ bookmark });
        if (!bookmark) throw new Error("Failed to add bookmark");
        return { bookmark, type };
    }
);
export const removeBookmark = createAsyncThunk(
    "bookmarks/remove",
    async ({ itemLink, type, ids }: { itemLink: string; type: "manga" | "book"; ids: number[] }) => {
        const res = await window.electron.invoke(`db:${type}:deleteBookmarks`, { itemLink, ids });
        return { itemLink, type, ids };
    }
);
export const removeAllBookmarks = createAsyncThunk(
    "bookmarks/removeAll",
    async ({ itemLink, type }: { itemLink: string; type: "manga" | "book" }) => {
        await window.electron.invoke(`db:${type}:deleteBookmarks`, { itemLink, ids: [] });
        return { itemLink, type };
    }
);

const bookmarksSlice = createSlice({
    name: "bookmarks",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        setBookmarks: (state, action: PayloadAction<BookmarksState>) => {
            return action.payload;
        },
    },

    extraReducers: (builder) => {
        builder
            .addCase(fetchAllBookmarks.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchAllBookmarks.fulfilled, (state, action) => {
                state.manga = {};
                for (const mangaBookmark of action.payload.mangaBookmarks) {
                    if (!state.manga[mangaBookmark.itemLink]) {
                        state.manga[mangaBookmark.itemLink] = [];
                    }
                    state.manga[mangaBookmark.itemLink].push(mangaBookmark);
                }
                state.book = {};
                for (const bookBookmark of action.payload.bookBookmarks) {
                    if (!state.book[bookBookmark.itemLink]) {
                        state.book[bookBookmark.itemLink] = [];
                    }
                    state.book[bookBookmark.itemLink].push(bookBookmark);
                }
                state.loading = false;
            });
        // for now just refetch all bookmarks on event

        // .addCase(addBookmark.fulfilled, (state, action) => {
        //     const bookmark = action.payload.bookmark;
        //     if (action.payload.type === "manga") {
        //         if (!state.manga[bookmark.itemLink]) {
        //             state.manga[bookmark.itemLink] = [];
        //         }
        //         state.manga[bookmark.itemLink].push(bookmark as MangaBookmark);
        //     } else {
        //         if (!state.book[bookmark.itemLink]) {
        //             state.book[bookmark.itemLink] = [];
        //         }
        //         state.book[bookmark.itemLink].push(bookmark as BookBookmark);
        //     }
        // })
        // .addCase(removeBookmark.fulfilled, (state, action) => {
        //     const { itemLink, type, ids } = action.payload;
        //     if (!ids) {
        //         console.error("ids not returned from db");
        //         return;
        //     }
        //     if (type === "manga") {
        //         state.manga[itemLink] = state.manga[itemLink].filter((b) => !ids.includes(b.id));
        //     } else {
        //         state.book[itemLink] = state.book[itemLink].filter((b) => !ids.includes(b.id));
        //     }
        // })
        // .addCase(removeAllBookmarks.fulfilled, (state, action) => {
        //     const { itemLink, type } = action.payload;
        //     if (type === "manga") {
        //         state.manga[itemLink] = [];
        //     } else {
        //         state.book[itemLink] = [];
        //     }
        // });
    },
});

export const { clearError: clearError_bookmark, setBookmarks } = bookmarksSlice.actions;

export default bookmarksSlice.reducer;
