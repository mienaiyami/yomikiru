import type { LibraryItemWithProgress } from "@common/types/db";
import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import i18n from "../i18n";
import type { BookReaderSettings, MangaReaderSettings } from "../utils/readerSettingsSchema";
import type { RootState } from ".";
import { selectResolvedItemMetadata, updateChaptersRead, updateChaptersReadAll } from "./library";

// ! ReaderState.content.progress is not linked to libraryItem.progress
// ! both are independent to prevent issues with multiple windows

/** Window-local live preset while rememberReaderPresetPerItem is applying a title pin. */
export type ReaderPresetSession = {
    itemLink: string;
    presetId: string;
    settings: MangaReaderSettings | BookReaderSettings;
};

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
    /**
     * Live layout for this window when a per-item preset session is active.
     * Not written to settings.json.
     */
    presetSession: ReaderPresetSession | null;
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
    presetSession: null,
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
        /**
         * Replaces the window-local per-item preset session. `null` returns to global live settings.
         */
        setPresetSession: (state, action: PayloadAction<ReaderPresetSession | null>) => {
            state.presetSession = action.payload;
        },
        /**
         * Merges live reader settings into the active session. No-op when no session.
         * Callers ({@link patchLiveMangaReaderSettings} / {@link patchLiveBookReaderSettings})
         * only dispatch a patch that matches the open reader type; this is a shallow merge.
         */
        patchPresetSessionSettings: (
            state,
            action: PayloadAction<Partial<MangaReaderSettings> | Partial<BookReaderSettings>>,
        ) => {
            if (!state.presetSession) return;
            /* payload is trusted to match the open session blob; splitting on reader.type was only for TypeScript */
            state.presetSession.settings = {
                ...state.presetSession.settings,
                ...action.payload,
            } as MangaReaderSettings | BookReaderSettings;
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
    setPresetSession,
    patchPresetSessionSettings,
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
 * The object stays referentially stable until its content or resolved metadata changes, so
 * AniList search and similar Redux subscribers do not rerender for unrelated reader state.
 */
export const getReaderContent = createSelector(
    [
        (state: RootState) => state.reader.content?.link,
        (state: RootState) => state.reader.content?.title,
        (state: RootState) => selectResolvedItemMetadata(state, state.reader.content?.link),
    ],
    (link, title, resolved): { link: string; title: string } | null => {
        if (!link) return null;
        return { link, title: resolved?.title ?? title ?? "" };
    },
);
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

/**
 * Manga reader layout for this window: session copy when a manga session is active, else settings.json.
 */
export const selectLiveMangaReaderSettings = (state: RootState): MangaReaderSettings => {
    const session = state.reader.presetSession;
    if (state.reader.type === "manga" && session) {
        return session.settings as MangaReaderSettings;
    }
    return state.appSettings.readerSettings;
};

/**
 * Book reader layout for this window: session copy when a book session is active, else settings.json.
 */
export const selectLiveBookReaderSettings = (state: RootState): BookReaderSettings => {
    const session = state.reader.presetSession;
    if (state.reader.type === "book" && session) {
        return session.settings as BookReaderSettings;
    }
    return state.appSettings.epubReaderSettings;
};

/**
 * Highlighted manga preset in the reader: session pin, else {@link RootState.appSettings.mangaReaderPresetId}.
 */
export const selectLiveMangaPresetId = (state: RootState): string => {
    const session = state.reader.presetSession;
    if (state.reader.type === "manga" && session) return session.presetId;
    return state.appSettings.mangaReaderPresetId;
};

/**
 * Highlighted book preset in the reader: session pin, else {@link RootState.appSettings.bookReaderPresetId}.
 */
export const selectLiveBookPresetId = (state: RootState): string => {
    const session = state.reader.presetSession;
    if (state.reader.type === "book" && session) return session.presetId;
    return state.appSettings.bookReaderPresetId;
};
