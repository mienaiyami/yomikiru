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
    type ReaderPreset,
    type ReaderPresetsState,
    resolveLibraryItemReaderPresetId,
    USER_PRESET_BOOK_ID,
    USER_PRESET_MANGA_ID,
} from "../utils/readerPresets";
import type { BookReaderSettings, MangaReaderSettings } from "../utils/readerSettingsSchema";
import { readJsonFileWithRetrySync } from "../utils/readJsonFileWithRetry";

import { parseAppSettings } from "../utils/settingsSchema";
import { setAppSettings, setEpubReaderSettings, setReaderSettings } from "./appSettings";
import type { AppDispatch, RootState } from "./index";
import { patchLibraryItemExtra } from "./library";
import {
    patchPresetSessionSettings,
    selectLiveBookPresetId,
    selectLiveMangaPresetId,
    setPresetSession,
} from "./reader";

const log = createRendererLogger("store/readerPresets");

/** library_items.type / open reader type; selects the matching preset catalog. */
type ReaderItemType = "manga" | "book";

/** Detach session settings from the catalog blob so live patches do not mutate the preset until autosave. */
const clonePresetSettings = <T>(settings: T): T => structuredClone(settings);

/**
 * Catalog preset whose id and {@link ReaderItemType} both match, or undefined when the pin is stale.
 */
const presetOfType = (
    presets: readonly ReaderPreset[],
    itemType: ReaderItemType,
    presetId: string,
): ReaderPreset | undefined => presets.find((preset) => preset.id === presetId && preset.type === itemType);

/**
 * Replaces the window-local session with a cloned catalog preset. Does not write extra.
 *
 * @param itemLink Library row path bound to this session (manga series, not a chapter folder).
 */
const setSessionFromPreset = (dispatch: AppDispatch, itemLink: string, preset: ReaderPreset): void => {
    dispatch(
        setPresetSession({
            itemLink,
            presetId: preset.id,
            settings: clonePresetSettings(preset.data),
        }),
    );
};

/**
 * Session plus {@link patchLibraryItemExtra} so extra.readerPresetId matches the live preset.
 *
 * @param itemLink Library row path bound to this session.
 */
const bindItemToPreset = (dispatch: AppDispatch, itemLink: string, preset: ReaderPreset): void => {
    setSessionFromPreset(dispatch, itemLink, preset);
    void dispatch(patchLibraryItemExtra({ link: itemLink, extra: { readerPresetId: preset.id } }));
};

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
 * Highlighted {@link ReaderPreset.id} for this window: session pin when it matches itemType, else the global selected id.
 */
const livePresetIdForType = (state: RootState, itemType: ReaderItemType): string =>
    itemType === "manga" ? selectLiveMangaPresetId(state) : selectLiveBookPresetId(state);

/**
 * Applies a catalog preset. With an active per-item session, updates that session.
 * Writes extra.readerPresetId only while rememberReaderPresetPerItem is enabled.
 * With no session, delegates to {@link selectReaderPreset}.
 *
 * @param presetId {@link ReaderPreset.id} in the in-memory catalog.
 */
export const selectPresetInContext =
    (presetId: string) =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        const state = getState();
        const session = state.reader.presetSession;
        if (!session || state.reader.type === null) {
            dispatch(selectReaderPreset(presetId));
            return;
        }
        const itemType = state.reader.type;
        const preset = presetOfType(state.readerPresets.presets, itemType, presetId);
        if (!preset) {
            log.warn("selectPresetInContext: catalog id does not match open reader type", { presetId, itemType });
            return;
        }
        if (state.appSettings.rememberReaderPresetPerItem) {
            bindItemToPreset(dispatch, session.itemLink, preset);
            return;
        }
        setSessionFromPreset(dispatch, session.itemLink, preset);
    };

/**
 * Live manga settings patch: session merge while a manga session is active, else {@link setReaderSettings}.
 *
 * @param settingsPatch Fields to merge into the live manga reader blob.
 */
export const patchLiveMangaReaderSettings =
    (settingsPatch: Partial<MangaReaderSettings>) =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        const state = getState();
        if (state.reader.presetSession && state.reader.type === "manga") {
            dispatch(patchPresetSessionSettings(settingsPatch));
            return;
        }
        dispatch(setReaderSettings(settingsPatch));
    };

/**
 * Live book settings patch: session merge while a book session is active, else {@link setEpubReaderSettings}.
 *
 * @param settingsPatch Fields to merge into the live book reader blob.
 */
export const patchLiveBookReaderSettings =
    (settingsPatch: Partial<BookReaderSettings>) =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        const state = getState();
        if (state.reader.presetSession && state.reader.type === "book") {
            dispatch(patchPresetSessionSettings(settingsPatch));
            return;
        }
        dispatch(setEpubReaderSettings(settingsPatch));
    };

/**
 * Starts or keeps a per-item preset session for the library row at `opts.itemLink`.
 * Stamps extra.readerPresetId when the stored id is missing or stale.
 *
 * @param opts.itemLink Library row path (manga series folder, not a chapter path).
 * @param opts.itemType {@link ReaderItemType} of that row; must match library_items.type.
 */
export const ensureReaderPresetSession =
    (opts: { itemLink: string; itemType: ReaderItemType }) =>
    async (dispatch: AppDispatch, getState: () => RootState): Promise<void> => {
        const { itemLink, itemType } = opts;
        const state = getState();
        const session = state.reader.presetSession;
        const rememberPerItem = state.appSettings.rememberReaderPresetPerItem;

        if (!rememberPerItem) {
            if (session && session.itemLink !== itemLink) {
                dispatch(setPresetSession(null));
            }
            return;
        }

        const libraryItem = state.library.items[itemLink];
        if (!libraryItem || libraryItem.type !== itemType) return;

        /* same library row: keep live tweaks; heal extra if the pin vanished */
        if (session?.itemLink === itemLink && state.reader.type === itemType) {
            const extraPresetId = resolveLibraryItemReaderPresetId(
                libraryItem.extra,
                itemType,
                state.readerPresets.presets,
            );
            if (extraPresetId === session.presetId) return;
            if (!extraPresetId) {
                await dispatch(
                    patchLibraryItemExtra({ link: itemLink, extra: { readerPresetId: session.presetId } }),
                );
            }
            return;
        }

        const catalog = state.readerPresets.presets;
        let catalogPresetId = resolveLibraryItemReaderPresetId(libraryItem.extra, itemType, catalog);
        if (!catalogPresetId) {
            const globalPresetId =
                itemType === "manga"
                    ? state.appSettings.mangaReaderPresetId
                    : state.appSettings.bookReaderPresetId;
            catalogPresetId =
                presetOfType(catalog, itemType, globalPresetId)?.id ??
                catalog.find((preset) => preset.type === itemType)?.id ??
                undefined;
            if (!catalogPresetId) {
                log.warn("ensureReaderPresetSession: no preset to stamp", { itemLink, itemType });
                return;
            }
            await dispatch(patchLibraryItemExtra({ link: itemLink, extra: { readerPresetId: catalogPresetId } }));
        }
        const preset = presetOfType(getState().readerPresets.presets, itemType, catalogPresetId);
        if (!preset) {
            log.warn("ensureReaderPresetSession: stamp id missing from catalog", { itemLink, catalogPresetId });
            return;
        }
        setSessionFromPreset(dispatch, itemLink, preset);
    };

/**
 * Cycles to the next catalog preset of the given item type. Dispatches {@link selectPresetInContext}.
 *
 * @param itemType Which preset catalog to walk.
 * @returns That preset's display name for shortcut feedback, or null when the catalog is empty.
 */
export const cyclePresetNext =
    (itemType: ReaderItemType) =>
    (dispatch: AppDispatch, getState: () => RootState): string | null => {
        const state = getState();
        const catalog = state.readerPresets.presets.filter((preset) => preset.type === itemType);
        if (catalog.length === 0) return null;
        const livePresetId = livePresetIdForType(state, itemType);
        const liveIndex = catalog.findIndex((preset) => preset.id === livePresetId);
        const nextIndex = liveIndex < 0 ? 0 : (liveIndex + 1) % catalog.length;
        const nextPreset = catalog[nextIndex];
        dispatch(selectPresetInContext(nextPreset.id));
        return nextPreset.name;
    };

/**
 * Cycles to the previous catalog preset of the given item type. Dispatches {@link selectPresetInContext}.
 *
 * @param itemType Which preset catalog to walk.
 * @returns That preset's display name for shortcut feedback, or null when the catalog is empty.
 */
export const cyclePresetPrev =
    (itemType: ReaderItemType) =>
    (dispatch: AppDispatch, getState: () => RootState): string | null => {
        const state = getState();
        const catalog = state.readerPresets.presets.filter((preset) => preset.type === itemType);
        if (catalog.length === 0) return null;
        const livePresetId = livePresetIdForType(state, itemType);
        const liveIndex = catalog.findIndex((preset) => preset.id === livePresetId);
        const prevIndex = liveIndex <= 0 ? catalog.length - 1 : liveIndex - 1;
        const prevPreset = catalog[prevIndex];
        dispatch(selectPresetInContext(prevPreset.id));
        return prevPreset.name;
    };

/**
 * Selects the catalog preset at a 0-based index among presets of the given item type.
 * Dispatches {@link selectPresetInContext}.
 *
 * @param itemType Which preset catalog to index.
 * @param slotIndex 0-based index in that filtered catalog (shortcut slot).
 * @returns That preset's display name for shortcut feedback, or null when the index is out of range.
 */
export const selectPresetSlot =
    (itemType: ReaderItemType, slotIndex: number) =>
    (dispatch: AppDispatch, getState: () => RootState): string | null => {
        const catalog = getState().readerPresets.presets.filter((preset) => preset.type === itemType);
        if (slotIndex < 0 || slotIndex >= catalog.length) return null;
        const preset = catalog[slotIndex];
        dispatch(selectPresetInContext(preset.id));
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
 * Copies the catalog preset's data into the global reader blob and sets the matching
 * appSettings selected-preset id. Does not write library extra or the window session.
 *
 * @param presetId {@link ReaderPreset.id}.
 */
export const selectReaderPreset =
    (presetId: string) =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        const preset = getState().readerPresets.presets.find((entry) => entry.id === presetId);
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
 * Deletes a catalog preset and heals global selection plus any window session that used it.
 *
 * @param presetId {@link ReaderPreset.id} to remove (User presets are rejected).
 */
export const deleteReaderPresetWithFallback =
    (presetId: string) =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        if (isUserPresetId(presetId)) {
            dialogUtils.warn({ message: "Cannot delete the User preset." });
            return;
        }
        const state = getState();
        const preset = state.readerPresets.presets.find((entry) => entry.id === presetId);
        const itemType = preset?.type;
        const globalPresetIdKey = itemType === "manga" ? "mangaReaderPresetId" : "bookReaderPresetId";
        const wasGlobalSelected = Boolean(itemType && state.appSettings[globalPresetIdKey] === presetId);
        const fallbackPreset = itemType
            ? state.readerPresets.presets.find((entry) => entry.type === itemType && entry.id !== presetId)
            : undefined;
        const userPresetId = itemType === "manga" ? USER_PRESET_MANGA_ID : USER_PRESET_BOOK_ID;

        if (itemType === "manga") dispatch(deleteMangaPreset(presetId));
        else if (itemType === "book") dispatch(deleteBookPreset(presetId));

        const session = state.reader.presetSession;
        if (session?.presetId === presetId && fallbackPreset) {
            bindItemToPreset(dispatch, session.itemLink, fallbackPreset);
        }

        if (wasGlobalSelected && fallbackPreset) {
            dispatch(selectReaderPreset(fallbackPreset.id));
        } else if (wasGlobalSelected && itemType) {
            dispatch(setAppSettings({ [globalPresetIdKey]: userPresetId }));
        }
    };

/**
 * Reloads presets from disk and heals stale mangaReaderPresetId / bookReaderPresetId
 * plus the window session pin when that catalog id is gone.
 */
export const refreshReaderPresetsWithReconcile =
    () =>
    (dispatch: AppDispatch, getState: () => RootState): void => {
        dispatch(refreshReaderPresets());

        const state = getState();
        const catalog = state.readerPresets.presets;

        const mangaReaderPresetId = state.appSettings.mangaReaderPresetId;
        if (!catalog.some((preset) => preset.type === "manga" && preset.id === mangaReaderPresetId)) {
            const fallbackPreset = catalog.find((preset) => preset.type === "manga");
            if (fallbackPreset) {
                dispatch(selectReaderPreset(fallbackPreset.id));
                log.log(`Preset reconcile: manga active id -> "${fallbackPreset.id}"`);
            }
        }

        const bookReaderPresetId = state.appSettings.bookReaderPresetId;
        if (!catalog.some((preset) => preset.type === "book" && preset.id === bookReaderPresetId)) {
            const fallbackPreset = catalog.find((preset) => preset.type === "book");
            if (fallbackPreset) {
                dispatch(selectReaderPreset(fallbackPreset.id));
                log.log(`Preset reconcile: book active id -> "${fallbackPreset.id}"`);
            }
        }

        const stateAfterRefresh = getState();
        const session = stateAfterRefresh.reader.presetSession;
        if (session && stateAfterRefresh.reader.type) {
            const sessionItemType = stateAfterRefresh.reader.type;
            const sessionPresetInCatalog = stateAfterRefresh.readerPresets.presets.some(
                (preset) => preset.id === session.presetId && preset.type === sessionItemType,
            );
            if (!sessionPresetInCatalog) {
                const fallbackPreset = stateAfterRefresh.readerPresets.presets.find(
                    (preset) => preset.type === sessionItemType,
                );
                if (fallbackPreset) {
                    bindItemToPreset(dispatch, session.itemLink, fallbackPreset);
                    log.log(`Preset reconcile: session id -> "${fallbackPreset.id}"`);
                }
            }
        }
    };

export default readerPresets.reducer;

/**
 * Manga reader presets only. Memoized so `.filter` does not force settings UI re-renders on unrelated updates.
 */
export const getMangaPresets = createSelector([(state: RootState) => state.readerPresets.presets], (catalog) =>
    catalog.filter((preset): preset is MangaReaderPreset => preset.type === "manga"),
);

/**
 * Book/EPUB reader presets only. Memoized counterpart of {@link getMangaPresets}.
 */
export const getBookPresets = createSelector([(state: RootState) => state.readerPresets.presets], (catalog) =>
    catalog.filter((preset): preset is BookReaderPreset => preset.type === "book"),
);

/**
 * Display name of the live manga reader preset, or null if none.
 */
export const getActiveMangaPresetName = createSelector(
    [selectLiveMangaPresetId, (state: RootState) => state.readerPresets.presets],
    (livePresetId, catalog) =>
        livePresetId ? (catalog.find((preset) => preset.id === livePresetId)?.name ?? null) : null,
);

/**
 * Display name of the live book reader preset, or null if none.
 */
export const getActiveBookPresetName = createSelector(
    [selectLiveBookPresetId, (state: RootState) => state.readerPresets.presets],
    (livePresetId, catalog) =>
        livePresetId ? (catalog.find((preset) => preset.id === livePresetId)?.name ?? null) : null,
);
