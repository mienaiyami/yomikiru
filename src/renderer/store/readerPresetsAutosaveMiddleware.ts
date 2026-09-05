import type { Middleware, MiddlewareAPI } from "@reduxjs/toolkit";
import type { BookReaderSettings, MangaReaderSettings } from "../utils/readerSettingsSchema";
import { setEpubReaderSettings, setReaderSettings } from "./appSettings";
import type { AppDispatch, RootState } from "./index";
import { patchPresetSessionSettings } from "./reader";
import { updateBookPreset, updateMangaPreset } from "./readerPresets";

const AUTOSAVE_DEBOUNCE_MS = 400;

type DebounceTimer = { current: ReturnType<typeof setTimeout> | null };

/* session vs global must not share a timer: a later Other Settings patch would cancel an in-flight session write */
const mangaSessionTimer: DebounceTimer = { current: null };
const mangaGlobalTimer: DebounceTimer = { current: null };
const bookSessionTimer: DebounceTimer = { current: null };
const bookGlobalTimer: DebounceTimer = { current: null };

type MangaAutosaveTarget = { presetId: string; data: MangaReaderSettings };
type BookAutosaveTarget = { presetId: string; data: BookReaderSettings };

/**
 * Debounced write of a manga preset blob when that preset has autosave enabled.
 */
const scheduleMangaAutosave = (
    store: MiddlewareAPI<AppDispatch, RootState>,
    timer: DebounceTimer,
    pick: (state: RootState) => MangaAutosaveTarget | null,
): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
        timer.current = null;
        const state = store.getState();
        const target = pick(state);
        if (!target) return;
        const preset = state.readerPresets.presets.find((p) => p.type === "manga" && p.id === target.presetId);
        if (preset?.autosave) {
            store.dispatch(updateMangaPreset({ id: preset.id, data: target.data }));
        }
    }, AUTOSAVE_DEBOUNCE_MS);
};

/**
 * Debounced write of a book preset blob when that preset has autosave enabled.
 */
const scheduleBookAutosave = (
    store: MiddlewareAPI<AppDispatch, RootState>,
    timer: DebounceTimer,
    pick: (state: RootState) => BookAutosaveTarget | null,
): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
        timer.current = null;
        const state = store.getState();
        const target = pick(state);
        if (!target) return;
        const preset = state.readerPresets.presets.find((p) => p.type === "book" && p.id === target.presetId);
        if (preset?.autosave) {
            store.dispatch(updateBookPreset({ id: preset.id, data: target.data }));
        }
    }, AUTOSAVE_DEBOUNCE_MS);
};

const mangaSessionTarget = (state: RootState): MangaAutosaveTarget | null => {
    const live = state.reader.presetSession;
    if (!live || state.reader.type !== "manga") return null;
    return { presetId: live.presetId, data: live.settings as MangaReaderSettings };
};

const bookSessionTarget = (state: RootState): BookAutosaveTarget | null => {
    const live = state.reader.presetSession;
    if (!live || state.reader.type !== "book") return null;
    return { presetId: live.presetId, data: live.settings as BookReaderSettings };
};

/**
 * Middleware that auto-updates the current preset when reader settings change and the preset has autosave enabled.
 * Debounces rapid changes to avoid excessive file writes.
 * Session patches write the session preset; {@link setReaderSettings} / {@link setEpubReaderSettings} still write the global selected id.
 */
export const readerPresetsAutosaveMiddleware: Middleware =
    (store: MiddlewareAPI<AppDispatch, RootState>) => (next) => (action) => {
        const result = next(action);

        if (patchPresetSessionSettings.match(action)) {
            const after = store.getState();
            if (after.reader.type === "manga" && after.reader.presetSession) {
                scheduleMangaAutosave(store, mangaSessionTimer, mangaSessionTarget);
            } else if (after.reader.type === "book" && after.reader.presetSession) {
                scheduleBookAutosave(store, bookSessionTimer, bookSessionTarget);
            }
        }

        if (setReaderSettings.match(action)) {
            scheduleMangaAutosave(store, mangaGlobalTimer, (state) => ({
                presetId: state.appSettings.mangaReaderPresetId,
                data: state.appSettings.readerSettings,
            }));
        }

        if (setEpubReaderSettings.match(action)) {
            scheduleBookAutosave(store, bookGlobalTimer, (state) => ({
                presetId: state.appSettings.bookReaderPresetId,
                data: state.appSettings.epubReaderSettings,
            }));
        }

        return result;
    };
