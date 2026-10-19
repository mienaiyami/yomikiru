import path from "node:path";
import { configureStore } from "@reduxjs/toolkit";
import { makeMangaItem } from "@test/fixtures/libraryItem";
import { onInvoke } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initReaderPresets, USER_PRESET_MANGA_ID } from "../utils/readerPresets";
import { defaultSettings } from "../utils/settingsSchema";
import appSettingsReducer, { setAppSettings } from "./appSettings";
import libraryReducer from "./library";
import readerReducer, { selectLiveMangaPresetId, selectLiveMangaReaderSettings, setReaderState } from "./reader";
import readerPresetsReducer, { ensureReaderPresetSession, selectPresetInContext } from "./readerPresets";

const itemLink = path.join("library", "series");
const otherItemLink = path.join("library", "other");

/** Isolated store for per-item preset session thunks. */
const makeStore = (opts?: { remember?: boolean; extra?: Record<string, unknown> }) => {
    const item = makeMangaItem({ link: itemLink, extra: opts?.extra ?? {} });
    return configureStore({
        reducer: {
            appSettings: appSettingsReducer,
            library: libraryReducer,
            reader: readerReducer,
            readerPresets: readerPresetsReducer,
        },
        preloadedState: {
            appSettings: {
                ...defaultSettings,
                rememberReaderPresetPerItem: opts?.remember ?? true,
                mangaReaderPresetId: USER_PRESET_MANGA_ID,
            },
            library: {
                items: { [itemLink]: item },
                metadata: {},
                loading: false,
                error: null,
            },
            readerPresets: initReaderPresets,
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
};

describe("ensureReaderPresetSession", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("stamps the global preset id onto extra and starts a session without changing mangaReaderPresetId", async () => {
        const updateItem = vi.fn(async (req: { link: string; extra?: Record<string, unknown> }) => ({
            ...makeMangaItem({ link: req.link, extra: req.extra ?? {} }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore();
        store.dispatch(
            setReaderState({
                type: "manga",
                link: itemLink,
                content: makeMangaItem({ link: itemLink }),
                mangaPageNumber: 1,
            }),
        );
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        expect(updateItem).toHaveBeenCalledWith(
            expect.objectContaining({
                extra: expect.objectContaining({ readerPresetId: USER_PRESET_MANGA_ID }),
            }),
        );
        expect(store.getState().appSettings.mangaReaderPresetId).toBe(USER_PRESET_MANGA_ID);
        expect(store.getState().reader.presetSession?.presetId).toBe(USER_PRESET_MANGA_ID);
        expect(selectLiveMangaPresetId(store.getState())).toBe(USER_PRESET_MANGA_ID);
    });

    it("restores a stored catalog id into the session without changing the global selected preset", async () => {
        onInvoke("db:library:updateItem", async (req: { link: string; extra?: Record<string, unknown> }) => ({
            ...makeMangaItem({ link: req.link, extra: req.extra ?? {} }),
        }));
        const store = makeStore({ extra: { readerPresetId: "manga-preset-long-strip" } });
        store.dispatch(
            setReaderState({
                type: "manga",
                link: itemLink,
                content: makeMangaItem({ link: itemLink }),
                mangaPageNumber: 1,
            }),
        );
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        expect(store.getState().appSettings.mangaReaderPresetId).toBe(USER_PRESET_MANGA_ID);
        expect(store.getState().reader.presetSession?.presetId).toBe("manga-preset-long-strip");
        expect(selectLiveMangaPresetId(store.getState())).toBe("manga-preset-long-strip");
        const live = selectLiveMangaReaderSettings(store.getState());
        const catalog = initReaderPresets.presets.find((p) => p.id === "manga-preset-long-strip");
        expect(catalog && catalog.type === "manga").toBe(true);
        if (catalog && catalog.type === "manga") {
            expect(live.readerTypeSelected).toBe(catalog.data.readerTypeSelected);
        }
    });

    it("does not stamp extra again when the session is already bound to that item", async () => {
        const updateItem = vi.fn(async (req: { link: string; extra?: Record<string, unknown> }) => ({
            ...makeMangaItem({ link: req.link, extra: req.extra ?? {} }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore();
        store.dispatch(
            setReaderState({
                type: "manga",
                link: itemLink,
                content: makeMangaItem({ link: itemLink }),
                mangaPageNumber: 1,
            }),
        );
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        expect(updateItem).toHaveBeenCalledTimes(1);
        updateItem.mockClear();
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        expect(updateItem).not.toHaveBeenCalled();
        expect(store.getState().reader.presetSession?.itemLink).toBe(itemLink);
    });

    it("does not stamp extra when rememberReaderPresetPerItem is off", async () => {
        const updateItem = vi.fn();
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore({ remember: false });
        store.dispatch(
            setReaderState({
                type: "manga",
                link: itemLink,
                content: makeMangaItem({ link: itemLink }),
                mangaPageNumber: 1,
            }),
        );
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        expect(updateItem).not.toHaveBeenCalled();
        expect(store.getState().reader.presetSession).toBeNull();
    });

    it("clears the session when rememberReaderPresetPerItem is off and the itemLink changes", async () => {
        const updateItem = vi.fn(async (req: { link: string; extra?: Record<string, unknown> }) => ({
            ...makeMangaItem({ link: req.link, extra: req.extra ?? {} }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore();
        store.dispatch(
            setReaderState({
                type: "manga",
                link: itemLink,
                content: makeMangaItem({ link: itemLink }),
                mangaPageNumber: 1,
            }),
        );
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        expect(store.getState().reader.presetSession?.itemLink).toBe(itemLink);
        store.dispatch(setAppSettings({ rememberReaderPresetPerItem: false }));
        await store.dispatch(ensureReaderPresetSession({ itemLink: otherItemLink, itemType: "manga" }));
        expect(store.getState().reader.presetSession).toBeNull();
    });
});

describe("selectPresetInContext", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("writes extra and session without changing mangaReaderPresetId when a session is active", async () => {
        const updateItem = vi.fn(async (req: { link: string; extra?: Record<string, unknown> }) => ({
            ...makeMangaItem({ link: req.link, extra: req.extra ?? {} }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore({ extra: { readerPresetId: USER_PRESET_MANGA_ID } });
        store.dispatch(
            setReaderState({
                type: "manga",
                link: itemLink,
                content: makeMangaItem({ link: itemLink }),
                mangaPageNumber: 1,
            }),
        );
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        store.dispatch(selectPresetInContext("manga-preset-long-strip"));
        expect(store.getState().appSettings.mangaReaderPresetId).toBe(USER_PRESET_MANGA_ID);
        expect(store.getState().reader.presetSession?.presetId).toBe("manga-preset-long-strip");
        expect(updateItem).toHaveBeenCalledWith(
            expect.objectContaining({
                extra: expect.objectContaining({ readerPresetId: "manga-preset-long-strip" }),
            }),
        );
    });

    it("keeps the session switch without writing extra when rememberReaderPresetPerItem is off", async () => {
        const updateItem = vi.fn(async (req: { link: string; extra?: Record<string, unknown> }) => ({
            ...makeMangaItem({ link: req.link, extra: req.extra ?? {} }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore({ extra: { readerPresetId: USER_PRESET_MANGA_ID } });
        store.dispatch(
            setReaderState({
                type: "manga",
                link: itemLink,
                content: makeMangaItem({ link: itemLink }),
                mangaPageNumber: 1,
            }),
        );
        await store.dispatch(ensureReaderPresetSession({ itemLink, itemType: "manga" }));
        updateItem.mockClear();
        store.dispatch(setAppSettings({ rememberReaderPresetPerItem: false }));
        store.dispatch(selectPresetInContext("manga-preset-long-strip"));
        expect(store.getState().reader.presetSession?.presetId).toBe("manga-preset-long-strip");
        expect(store.getState().appSettings.mangaReaderPresetId).toBe(USER_PRESET_MANGA_ID);
        expect(updateItem).not.toHaveBeenCalled();
    });
});
