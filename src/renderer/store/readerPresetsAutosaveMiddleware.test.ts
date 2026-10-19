import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initReaderPresets, USER_PRESET_MANGA_ID } from "../utils/readerPresets";
import { defaultMangaReaderSettings } from "../utils/readerSettingsSchema";
import { defaultSettings } from "../utils/settingsSchema";
import appSettingsReducer, { setReaderSettings } from "./appSettings";
import readerReducer, { patchPresetSessionSettings, setPresetSession, setReaderState } from "./reader";
import readerPresetsReducer from "./readerPresets";
import { readerPresetsAutosaveMiddleware } from "./readerPresetsAutosaveMiddleware";

/** Catalog id of the bundled long-strip manga preset (autosave off). */
const LONG_STRIP_ID = "manga-preset-long-strip";
/** Past the autosave middleware debounce so the write has run. */
const AUTOSAVE_WAIT_MS = 500;

/** Store with autosave middleware for session vs global targeting tests. */
const makeStore = () =>
    configureStore({
        reducer: {
            appSettings: appSettingsReducer,
            reader: readerReducer,
            readerPresets: readerPresetsReducer,
        },
        preloadedState: {
            appSettings: {
                ...defaultSettings,
                mangaReaderPresetId: USER_PRESET_MANGA_ID,
            },
            readerPresets: structuredClone(initReaderPresets),
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({ serializableCheck: false }).concat(readerPresetsAutosaveMiddleware),
    });

describe("readerPresetsAutosaveMiddleware", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it("writes session patches into the session preset when that preset has autosave", () => {
        const store = makeStore();
        store.dispatch(
            setReaderState({
                type: "manga",
                link: "item",
                content: null,
                mangaPageNumber: 1,
            }),
        );
        store.dispatch(
            setPresetSession({
                itemLink: "item",
                presetId: USER_PRESET_MANGA_ID,
                settings: { ...defaultMangaReaderSettings, readerWidth: 40 },
            }),
        );
        store.dispatch(patchPresetSessionSettings({ readerWidth: 33 }));
        vi.advanceTimersByTime(AUTOSAVE_WAIT_MS);
        const userPreset = store
            .getState()
            .readerPresets.presets.find((preset) => preset.id === USER_PRESET_MANGA_ID);
        expect(userPreset?.type === "manga" && userPreset.data.readerWidth).toBe(33);
    });

    it("does not copy a session blob into the global User preset via setReaderSettings", () => {
        const store = makeStore();
        const longStrip = initReaderPresets.presets.find((preset) => preset.id === LONG_STRIP_ID);
        expect(longStrip?.type).toBe("manga");
        if (!longStrip || longStrip.type !== "manga") return;
        store.dispatch(
            setReaderState({
                type: "manga",
                link: "item",
                content: null,
                mangaPageNumber: 1,
            }),
        );
        store.dispatch(
            setPresetSession({
                itemLink: "item",
                presetId: LONG_STRIP_ID,
                settings: { ...longStrip.data, readerWidth: 55 },
            }),
        );
        store.dispatch(patchPresetSessionSettings({ readerWidth: 55 }));
        store.dispatch(setReaderSettings({ readerWidth: 12 }));
        vi.advanceTimersByTime(AUTOSAVE_WAIT_MS);
        const catalog = store.getState().readerPresets.presets;
        const sessionPreset = catalog.find((preset) => preset.id === LONG_STRIP_ID);
        const globalUser = catalog.find((preset) => preset.id === USER_PRESET_MANGA_ID);
        expect(sessionPreset?.type === "manga" && sessionPreset.data.readerWidth).toBe(longStrip.data.readerWidth);
        expect(globalUser?.type === "manga" && globalUser.data.readerWidth).toBe(12);
    });
});
