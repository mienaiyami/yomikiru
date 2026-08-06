import { createSelector, createSlice, current, type PayloadAction } from "@reduxjs/toolkit";
import { dialogUtils } from "@utils/dialog";
import { readerPresetsPath, saveJSONfile } from "../utils/file";
import { createRendererLogger } from "../utils/logger";
import {
    type BookReaderPreset,
    buildFirstRunPresets,
    initReaderPresets,
    isUserPresetId,
    type MangaReaderPreset,
    parseReaderPresetsStateWithMeta,
    type ReaderPresetsState,
    USER_PRESET_BOOK_ID,
    USER_PRESET_MANGA_ID,
} from "../utils/readerPresets";
import type { BookReaderSettings, MangaReaderSettings } from "../utils/readerSettingsSchema";
import { readJsonFileWithRetrySync } from "../utils/readJsonFileWithRetry";

const log = createRendererLogger("store/readerPresets");

import { parseAppSettings } from "../utils/settingsSchema";
import { setAppSettings, setEpubReaderSettings, setReaderSettings } from "./appSettings";
import type { AppDispatch, RootState } from "./index";

let initialState: ReaderPresetsState = initReaderPresets;
// TODO: normalize reader settings + presets; remove duplications and only keep IDs in appSettings?

if (window.fs.existsSync(readerPresetsPath)) {
    try {
        const parsed = readJsonFileWithRetrySync(readerPresetsPath, {
            maxAttempts: 10,
            onRetry: (attempt, error) => {
                log.log(`readerPresets.json read retry ${attempt}/10`, error);
            },
        });
        const { state, didNormalize } = parseReaderPresetsStateWithMeta(parsed);
        initialState = state;
        if (didNormalize) {
            saveJSONfile(readerPresetsPath, state);
            dialogUtils.warn({
                message: "Some reader preset fields were missing or invalid; filled from defaults.",
            });
        }
    } catch (err) {
        log.error("readerPresets.json unreadable; rebuilding from app settings", err);
        const appSettings = parseAppSettings();
        const firstRun = buildFirstRunPresets(appSettings.readerSettings, appSettings.epubReaderSettings);
        saveJSONfile(readerPresetsPath, firstRun);
        initialState = firstRun;
        dialogUtils.warn({
            message: "Reader presets file was unreadable; recreated presets from your current reader settings.",
        });
    }
} else {
    const appSettings = parseAppSettings();
    initialState = buildFirstRunPresets(appSettings.readerSettings, appSettings.epubReaderSettings);
    saveJSONfile(readerPresetsPath, initialState);
}

const saveReaderPresets = (state: ReaderPresetsState) => {
    saveJSONfile(readerPresetsPath, current(state));
};

const readerPresets = createSlice({
    name: "readerPresets",
    initialState,
    reducers: {
        addMangaPreset: (state, action: PayloadAction<MangaReaderPreset>) => {
            if (state.presets.some((p) => p.id === action.payload.id)) {
                log.error(`addMangaPreset: id already exists (${action.payload.id})`);
                return;
            }
            state.presets.push(action.payload);
            saveReaderPresets(state);
        },
        addBookPreset: (state, action: PayloadAction<BookReaderPreset>) => {
            if (state.presets.some((p) => p.id === action.payload.id)) {
                log.error(`addBookPreset: id already exists (${action.payload.id})`);
                return;
            }
            state.presets.push(action.payload);
            saveReaderPresets(state);
        },
        addMangaPresets: (state, action: PayloadAction<MangaReaderPreset[]>) => {
            const existingIds = new Set(state.presets.map((p) => p.id));
            action.payload.forEach((p) => {
                if (!existingIds.has(p.id)) {
                    state.presets.push(p);
                    existingIds.add(p.id);
                }
            });
            saveReaderPresets(state);
        },
        addBookPresets: (state, action: PayloadAction<BookReaderPreset[]>) => {
            const existingIds = new Set(state.presets.map((p) => p.id));
            action.payload.forEach((p) => {
                if (!existingIds.has(p.id)) {
                    state.presets.push(p);
                    existingIds.add(p.id);
                }
            });
            saveReaderPresets(state);
        },
        updateMangaPreset: (state, action: PayloadAction<{ id: string; data: MangaReaderPreset["data"] }>) => {
            const idx = state.presets.findIndex((p) => p.type === "manga" && p.id === action.payload.id);
            if (idx >= 0) {
                (state.presets[idx] as MangaReaderPreset).data = action.payload.data;
                saveReaderPresets(state);
            }
        },
        updateBookPreset: (state, action: PayloadAction<{ id: string; data: BookReaderPreset["data"] }>) => {
            const idx = state.presets.findIndex((p) => p.type === "book" && p.id === action.payload.id);
            if (idx >= 0) {
                (state.presets[idx] as BookReaderPreset).data = action.payload.data;
                saveReaderPresets(state);
            }
        },
        /**
         * NOTE: prefer using deleteReaderPresetWithFallback instead.
         */
        deleteMangaPreset: (state, action: PayloadAction<string>) => {
            if (action.payload === USER_PRESET_MANGA_ID) {
                dialogUtils.warn({ message: "Cannot delete the User preset." });
                return;
            }
            let mangaCount = 0;
            let deleteIdx = -1;
            for (let i = 0; i < state.presets.length; ++i) {
                if (state.presets[i].type === "manga") {
                    if (state.presets[i].id === action.payload) {
                        deleteIdx = i;
                    }
                    mangaCount++;
                }
            }
            if (mangaCount === 1) {
                dialogUtils.warn({ message: "Cannot delete last manga preset." });
                return;
            }
            if (deleteIdx >= 0) {
                state.presets.splice(deleteIdx, 1);
                saveReaderPresets(state);
            }
        },
        /**
         * NOTE: prefer using deleteReaderPresetWithFallback instead.
         */
        deleteBookPreset: (state, action: PayloadAction<string>) => {
            if (action.payload === USER_PRESET_BOOK_ID) {
                dialogUtils.warn({ message: "Cannot delete the User preset." });
                return;
            }
            let bookCount = 0;
            let deleteIdx = -1;
            for (let i = 0; i < state.presets.length; ++i) {
                if (state.presets[i].type === "book") {
                    if (state.presets[i].id === action.payload) {
                        deleteIdx = i;
                    }
                    bookCount++;
                }
            }
            if (bookCount === 1) {
                dialogUtils.warn({ message: "Cannot delete last book preset." });
                return;
            }
            if (deleteIdx >= 0) {
                state.presets.splice(deleteIdx, 1);
                saveReaderPresets(state);
            }
        },
        /**
         * Restores bundled default presets to their shipped definitions and ensures User presets exist (created from
         * payload when missing). Custom presets are left unchanged.
         */
        resetToDefaults: (
            state,
            action: PayloadAction<{ mangaData: MangaReaderSettings; bookData: BookReaderSettings }>,
        ) => {
            const { mangaData, bookData } = action.payload;
            const existingIds = new Set(state.presets.map((p) => p.id));
            initReaderPresets.presets.forEach((p) => {
                if (!existingIds.has(p.id)) {
                    state.presets.push(p);
                    existingIds.add(p.id);
                } else {
                    const idx = state.presets.findIndex((x) => x.id === p.id);
                    if (idx >= 0) state.presets[idx] = p;
                }
            });
            const userPresetsFromFirstRun = buildFirstRunPresets(mangaData, bookData).presets.filter(
                (p) => p.id === USER_PRESET_MANGA_ID || p.id === USER_PRESET_BOOK_ID,
            );
            for (const p of userPresetsFromFirstRun) {
                if (!existingIds.has(p.id)) {
                    state.presets.push(p);
                    existingIds.add(p.id);
                    log.log(`resetToDefaults: restored missing User preset (${p.type}, ${p.id})`);
                }
            }
            saveReaderPresets(state);
        },
        /**
         * Moves preset up or down within same-type presets. Swaps with previous/next same-type preset in the shared array.
         */
        movePreset: (state, action: PayloadAction<{ id: string; direction: "up" | "down" }>) => {
            const { id, direction } = action.payload;
            const idx = state.presets.findIndex((p) => p.id === id);
            if (idx < 0) return;
            const preset = state.presets[idx];
            const type = preset.type;
            const sameTypeIndices = state.presets.map((p, i) => (p.type === type ? i : -1)).filter((i) => i >= 0);
            const sameTypeIndex = sameTypeIndices.indexOf(idx);
            let swapIdx = -1;
            if (direction === "up") {
                if (sameTypeIndex > 0) {
                    swapIdx = sameTypeIndices[sameTypeIndex - 1];
                }
            } else {
                if (sameTypeIndex < sameTypeIndices.length - 1) {
                    swapIdx = sameTypeIndices[sameTypeIndex + 1];
                }
            }
            if (swapIdx >= 0) {
                [state.presets[idx], state.presets[swapIdx]] = [state.presets[swapIdx], state.presets[idx]];
                saveReaderPresets(state);
            }
        },
        /**
         * NOTE: prefer using refreshReaderPresetsWithReconcile instead.
         * Applies in-memory normalization only - does not re-save on normalize, to avoid
         * fs:fileChanged <-> refresh loops when another window (or self) already wrote the file.
         */
        refreshReaderPresets: (state) => {
            try {
                const data = readJsonFileWithRetrySync(readerPresetsPath, {
                    maxAttempts: 8,
                    onRetry: (attempt, error) => {
                        log.log(`readerPresets.json refresh retry ${attempt}/8`, error);
                    },
                });
                const { state: next } = parseReaderPresetsStateWithMeta(data);
                return next;
            } catch {
                log.error("refreshReaderPresets: could not read readerPresets.json; keeping in-memory state");
                return state;
            }
        },
        setPresetAutosave: (state, action: PayloadAction<{ id: string; autosave: boolean }>) => {
            const idx = state.presets.findIndex((p) => p.id === action.payload.id);
            if (idx >= 0) {
                state.presets[idx].autosave = action.payload.autosave;
                saveReaderPresets(state);
            }
        },
    },
});

export const {
    addMangaPreset,
    addBookPreset,
    addMangaPresets,
    addBookPresets,
    updateMangaPreset,
    updateBookPreset,
    deleteMangaPreset,
    deleteBookPreset,
    movePreset,
    refreshReaderPresets,
    resetToDefaults,
    setPresetAutosave,
} = readerPresets.actions;

/**
 * Cycles to next preset of given type. Dispatches selectReaderPreset. Returns preset name for shortcut feedback.
 */
export const cyclePresetNext =
    (type: "manga" | "book") =>
    (dispatch: AppDispatch, getState: () => RootState): string | null => {
        const state = getState();
        const presets = state.readerPresets.presets.filter((p) => p.type === type);
        if (presets.length === 0) return null;
        const currentId =
            type === "manga" ? state.appSettings.mangaReaderPresetId : state.appSettings.bookReaderPresetId;
        const currIdx = presets.findIndex((p) => p.id === currentId);
        const nextIdx = currIdx < 0 ? 0 : (currIdx + 1) % presets.length;
        const next = presets[nextIdx];
        dispatch(selectReaderPreset(next.id));
        return next.name;
    };

/**
 * Cycles to previous preset of given type. Dispatches selectReaderPreset. Returns preset name for shortcut feedback.
 */
export const cyclePresetPrev =
    (type: "manga" | "book") =>
    (dispatch: AppDispatch, getState: () => RootState): string | null => {
        const state = getState();
        const presets = state.readerPresets.presets.filter((p) => p.type === type);
        if (presets.length === 0) return null;
        const currentId =
            type === "manga" ? state.appSettings.mangaReaderPresetId : state.appSettings.bookReaderPresetId;
        const currIdx = presets.findIndex((p) => p.id === currentId);
        const nextIdx = currIdx <= 0 ? presets.length - 1 : currIdx - 1;
        const next = presets[nextIdx];
        dispatch(selectReaderPreset(next.id));
        return next.name;
    };

/**
 * Selects preset at slot (0-based) for given type. Dispatches selectReaderPreset. Returns preset name for shortcut feedback.
 */
export const selectPresetSlot =
    (type: "manga" | "book", slot: number) =>
    (dispatch: AppDispatch, getState: () => RootState): string | null => {
        const presets = getState().readerPresets.presets.filter((p) => p.type === type);
        if (slot < 0 || slot >= presets.length) return null;
        const preset = presets[slot];
        dispatch(selectReaderPreset(preset.id));
        return preset.name;
    };

/**
 * Resets bundled default presets and creates missing User presets using current app reader settings (same as first run).
 */
export const resetReaderPresetsToDefaults =
    () =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        const { readerSettings, epubReaderSettings } = getState().appSettings;
        dispatch(
            resetToDefaults({
                mangaData: readerSettings,
                bookData: epubReaderSettings,
            }),
        );
    };

/**
 * Applies reader preset by id to reader settings and sets it as selected.
 */
export const selectReaderPreset =
    (id: string) =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        const preset = getState().readerPresets.presets.find((p) => p.id === id);
        if (!preset) {
            dialogUtils.customError({ message: "Preset not found." });
            return;
        }
        if (preset.type === "manga") {
            dispatch(setReaderSettings((preset as MangaReaderPreset).data));
            dispatch(setAppSettings({ mangaReaderPresetId: preset.id }));
        } else {
            dispatch(setEpubReaderSettings((preset as BookReaderPreset).data));
            dispatch(setAppSettings({ bookReaderPresetId: preset.id }));
        }
    };

/**
 * Deletes reader preset by id and syncs appSettings to fallback when the deleted preset was selected.
 */
export const deleteReaderPresetWithFallback =
    (id: string) =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        if (isUserPresetId(id)) {
            dialogUtils.warn({ message: "Cannot delete the User preset." });
            return;
        }
        const state = getState();
        const preset = state.readerPresets.presets.find((p) => p.id === id);
        const presetType = preset?.type;
        const presetIdKey = presetType === "manga" ? "mangaReaderPresetId" : "bookReaderPresetId";
        const wasSelected = presetType && state.appSettings[presetIdKey] === id;
        const fallback = presetType
            ? state.readerPresets.presets.find((p) => p.type === presetType && p.id !== id)
            : undefined;
        const defaultId = presetType === "manga" ? USER_PRESET_MANGA_ID : USER_PRESET_BOOK_ID;

        if (presetType === "manga") dispatch(deleteMangaPreset(id));
        else if (presetType === "book") dispatch(deleteBookPreset(id));

        if (wasSelected && fallback) {
            dispatch(selectReaderPreset(fallback.id));
        } else if (wasSelected && presetType) {
            dispatch(setAppSettings({ [presetIdKey]: defaultId }));
        }
    };

/**
 * Refreshes presets from file and reconciles appSettings if presetIds are stale.
 */
export const refreshReaderPresetsWithReconcile =
    () =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        dispatch(refreshReaderPresets());

        const state = getState();
        const presets = state.readerPresets.presets;

        const mangaId = state.appSettings.mangaReaderPresetId;
        if (!presets.some((p) => p.type === "manga" && p.id === mangaId)) {
            const fallback = presets.find((p) => p.type === "manga");
            if (fallback) {
                dispatch(selectReaderPreset(fallback.id));
                log.log(`Preset reconcile: manga active id -> "${fallback.id}"`);
            }
        }

        const bookId = state.appSettings.bookReaderPresetId;
        if (!presets.some((p) => p.type === "book" && p.id === bookId)) {
            const fallback = presets.find((p) => p.type === "book");
            if (fallback) {
                dispatch(selectReaderPreset(fallback.id));
                log.log(`Preset reconcile: book active id -> "${fallback.id}"`);
            }
        }
    };

export default readerPresets.reducer;

/**
 * Manga reader presets only. Memoized so `.filter` does not force settings UI re-renders on unrelated updates.
 */
export const getMangaPresets = createSelector([(state: RootState) => state.readerPresets.presets], (presets) =>
    presets.filter((p): p is MangaReaderPreset => p.type === "manga"),
);

/**
 * Book/EPUB reader presets only. Memoized counterpart of {@link getMangaPresets}.
 */
export const getBookPresets = createSelector([(state: RootState) => state.readerPresets.presets], (presets) =>
    presets.filter((p): p is BookReaderPreset => p.type === "book"),
);

/**
 * Display name of the active manga reader preset, or null if none.
 */
export const getActiveMangaPresetName = createSelector(
    [
        (state: RootState) => state.appSettings.mangaReaderPresetId,
        (state: RootState) => state.readerPresets.presets,
    ],
    (id, presets) => (id ? (presets.find((p) => p.id === id)?.name ?? null) : null),
);

/**
 * Display name of the active book reader preset, or null if none.
 */
export const getActiveBookPresetName = createSelector(
    [
        (state: RootState) => state.appSettings.bookReaderPresetId,
        (state: RootState) => state.readerPresets.presets,
    ],
    (id, presets) => (id ? (presets.find((p) => p.id === id)?.name ?? null) : null),
);
