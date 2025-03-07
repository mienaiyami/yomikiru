import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { LibraryItemWithProgress } from "@common/types/db";
import { RootState } from ".";
type ReaderState = {
    /**
     * link of either manga-chapter or whole epub
     */
    link: string;
    /**
     * whether reader is open(ui only), reader will be mounted after link is set
     */
    active: boolean;
    //todo: add type "progress"| "message"
    loading:
        | null
        | {
              percent: number;
              message?: string;
          }
        | {
              /**
               * no progress bar
               */
              message: string;
              percent: null;
          };
    /**
     * temp solution, page number at which chapter should be opened
     * as well as current page number as you scroll
     */
    mangaPageNumber?: number;
    /**
     * id+query string of position at which epub chapter should be opened
     */
    epubChapterId?: string;
    epubElementQueryString?: string;
} & (
    | {
          type: "manga";
          /**
           * will be set inside reader component when reader is opened
           */
          content: null | (LibraryItemWithProgress & { type: "manga" });
          mangaPageNumber: number;
      }
    | {
          type: "book";
          content: null | (LibraryItemWithProgress & { type: "book" });
          epubChapterId: string;
          epubElementQueryString: string;
      }
    | {
          type: null;
          content: null;
      }
);

// type OpenReaderParams = {
//     link: string;
//     source: "direct" | "bookmark" | "library";
//     metadata?: {
//         mangaPageNumber?: number;
//         epubChapterId?: string;
//         epubElementQueryString?: string;
//     };
// };
// export const openInReader = createAsyncThunk(
//     "reader/openContent",
//     async (params: OpenReaderParams, { dispatch, rejectWithValue }): Promise<ReaderState | undefined> => {
//         const { link, source, metadata } = params;
//         const normalizedLink = window.path.normalize(link);

//         window.electron.webFrame.clearCache();

//         try {
//             if (formatUtils.book.test(normalizedLink)) {
//                 // todo: maybe handle outside?
//                 dispatch(setUnzipping({ state: true, text: "PROCESSING EPUB" }));

//                 return {
//                     type: "book" as const,
//                     link: normalizedLink,
//                     loadChapterId: metadata?.epubChapterId,
//                     status: "loading",
//                     loadPosition: metadata?.epubElementQueryString,
//                     loading: null,
//                 };
//             }

//             const isValidFolder = await new Promise<{ isValid: boolean; images?: string[] }>((resolve) => {
//                 window.checkValidFolder(
//                     normalizedLink,
//                     (isValid, imgs) => {
//                         resolve({ isValid: !!isValid, images: imgs });
//                     },
//                     true
//                 );
//             });

//             if (!isValidFolder.isValid) {
//                 rejectWithValue("Invalid folder or no images found");
//                 return;
//             }

//             if (isValidFolder.images) {
//                 window.cachedImageList = {
//                     link: normalizedLink,
//                     images: isValidFolder.images,
//                 };
//             }

//             return {
//                 type: "manga" as const,
//                 link: normalizedLink,
//                 loading: null,
//                 loadPage: metadata?.mangaPageNumber || 1,
//                 status: "loading",
//             };
//         } catch (error) {
//             rejectWithValue(error instanceof Error ? error.message : "Unknown error");
//             return;
//         }
//     }
// );

const initialState = {
    active: false,
    link: "",
    loading: null,
    mangaPageNumber: undefined,
    epubChapterId: undefined,
    epubElementQueryString: undefined,

    type: null,
    content: null,
} as ReaderState;

const readerSlice = createSlice({
    name: "reader",
    initialState,
    reducers: {
        resetReaderState: () => {
            return initialState;
        },
        // handling status and loading separately because it creates issues like unattended loading state
        setReaderState: (state, action: PayloadAction<Partial<Omit<ReaderState, "status" | "loading">>>) => {
            Object.assign(state, action.payload);
            console.log("setReaderState", state);
        },
        updateReaderContent: (state, action: PayloadAction<ReaderState["content"]>) => {
            state.content = action.payload;
        },
        setReaderOpen: (state) => {
            state.active = true;
            state.loading = null;
        },
        /**
         * only handles status not other states
         */
        setReaderClose: (state) => {
            state.active = false;
            state.loading = null;
        },
        setReaderLoading: (state, action: PayloadAction<{ percent?: number; message?: string } | null>) => {
            console.log("setReaderLoading", action.payload);
            if (action.payload === null) {
                state.loading = null;
                return;
            }
            if (typeof action.payload.percent === "number") {
                if (action.payload.percent >= 100) {
                    state.loading = null;
                } else {
                    state.loading = {
                        percent: action.payload.percent,
                        message: action.payload.message ?? state.loading?.message,
                    };
                }
            } else {
                state.loading = {
                    percent: null,
                    message: action.payload.message ?? state.loading?.message ?? "Loading...",
                };
            }
        },
        setReaderMangaPageNumber: (state, action: PayloadAction<number>) => {
            if (state.type === "manga") {
                state.mangaPageNumber = action.payload;
            }
        },
        setReaderEpubChapterId: (state, action: PayloadAction<string>) => {
            if (state.type === "book") {
                state.epubChapterId = action.payload;
            }
        },
        setReaderEpubElementQueryString: (state, action: PayloadAction<string>) => {
            if (state.type === "book") {
                state.epubElementQueryString = action.payload;
            }
        },
    },
});

export const {
    setReaderState,
    setReaderLoading,
    resetReaderState,
    updateReaderContent,
    setReaderOpen,
    setReaderClose,
    setReaderMangaPageNumber,
    setReaderEpubChapterId,
    setReaderEpubElementQueryString,
} = readerSlice.actions;
export default readerSlice.reducer;

export const getReaderManga = (state: RootState) => {
    if (state.reader.type === "manga") {
        return state.reader.content;
    }
    return null;
};
export const getReaderMangaState = (state: RootState) => {
    if (state.reader.type === "manga") {
        return state.reader;
    }
    return null;
};
export const getReaderBook = (state: RootState) => {
    if (state.reader.type === "book") {
        return state.reader.content;
    }
    return null;
};

export const getReaderLink = (state: RootState) => state.reader.link;
export const getReaderProgress = (state: RootState) => state.reader.content?.progress;
