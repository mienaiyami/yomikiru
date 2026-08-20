import type { LibraryItemWithProgress } from "@common/types/db";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { resolveItemMetadata, trackerByItemLink } from "@utils/libraryMetadata";
import i18n from "../i18n";
import type { RootState } from ".";
import { updateChaptersRead, updateChaptersReadAll } from "./library";

// ! ReaderState.content.progress is not linked to libraryItem.progress
// ! both are independent to prevent issues with multiple windows

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
     * Page number at which chapter should be opened
     * DON'T USE THIS FOR SAVING, USE content.progress.currentPage
     */
    mangaPageNumber?: number;
    /**
     * id+query string of position at which epub chapter should be opened
     * DON'T USE THIS FOR SAVING, USE content.progress.chapterId and content.progress.position
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
        },
        updateReaderContent: (state, action: PayloadAction<ReaderState["content"]>) => {
            state.content = action.payload;
        },
        setReaderOpen: (state) => {
            state.active = true;
            // hide loading screen will cause loading screen to hide only for a moment when show up again when images starts to load.
            // state.loading = null;
        },
        /**
         * only handles status not other states
         */
        setReaderClose: (state) => {
            state.active = false;
            state.loading = null;
        },
        setReaderLoading: (state, action: PayloadAction<{ percent?: number; message?: string } | null>) => {
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
                    message:
                        action.payload.message ??
                        state.loading?.message ??
                        i18n.t("loading.default", { ns: "reader" }),
                };
            }
        },
        updateReaderMangaCurrentPage: (state, action: PayloadAction<number>) => {
            if (state.type === "manga" && state.content?.progress) {
                state.content.progress.currentPage = action.payload;
            }
        },
        /**
         * Update in memory progress of book
         * NOT SAVED TO DB, USE library.updateBookProgress instead
         */
        updateReaderBookProgress: (
            state,
            action: PayloadAction<
                Partial<{
                    chapterId: string;
                    position: string;
                    chapterName: string;
                }>
            >,
        ) => {
            const { chapterId, position, chapterName } = action.payload;
            if (state.type === "book" && state.content?.progress) {
                state.content.progress.chapterId = chapterId || state.content.progress.chapterId;
                state.content.progress.position = position || state.content.progress.position;
                state.content.progress.chapterName = chapterName || state.content.progress.chapterName;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(updateChaptersRead.fulfilled, (state, action) => {
                if (
                    state.type === "manga" &&
                    state.content?.progress &&
                    state.content.link === action.payload.itemLink
                ) {
                    state.content.progress.chaptersRead = action.payload.chapterRead;
                }
            })
            .addCase(updateChaptersReadAll.fulfilled, (state, action) => {
                if (
                    state.type === "manga" &&
                    state.content?.progress &&
                    state.content.link === action.payload.itemLink
                ) {
                    state.content.progress.chaptersRead = action.payload.chaptersRead;
                }
            });
    },
});

export const {
    setReaderState,
    setReaderLoading,
    resetReaderState,
    updateReaderContent,
    setReaderOpen,
    setReaderClose,
    updateReaderMangaCurrentPage,
    updateReaderBookProgress,
} = readerSlice.actions;
export default readerSlice.reducer;

export const getReaderManga = (state: RootState) => {
    if (state.reader.type === "manga") {
        return state.reader.content;
    }
    return null;
};

/**
 * Open reader item with the resolved display title (user overlay, else tracker, else file, else row).
 * AniList search and similar callers should use this instead of {@link LibraryItem.title}.
 */
export const getReaderContent = (state: RootState): { link: string; title: string } | null => {
    const content = state.reader.content;
    if (!content) return null;
    const resolved = resolveItemMetadata({
        item: content,
        overlays: state.library.metadata[content.link] ?? [],
        tracker: trackerByItemLink(state.trackers.entries)[content.link],
    });
    return { link: content.link, title: resolved.title };
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
