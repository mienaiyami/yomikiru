import path from "node:path";
import { configureStore } from "@reduxjs/toolkit";
import { makeMangaItem } from "@test/fixtures/libraryItem";
import { onInvoke } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import libraryReducer, {
    fetchAllMetadata,
    selectResolvedItemMetadata,
    setLibraryItemDetailsCoverSource,
    setLibraryItemFavourite,
    setLibraryItemMetadata,
    setLibraryItemNote,
} from "./library";
import trackersReducer from "./trackers";

const itemLink = path.join("library", "series");

/** Isolated library store for thunk IPC tests. */
const makeStore = () => {
    const item = makeMangaItem({ link: itemLink });
    return configureStore({
        reducer: { library: libraryReducer },
        preloadedState: {
            library: {
                items: { [itemLink]: item },
                metadata: {},
                loading: false,
                error: null,
            },
        },
    });
};

describe("library metadata thunks", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("favourites by writing favouritedAt and merges the row into the store", async () => {
        const updateItem = vi.fn(async (req: { link: string; favouritedAt?: Date | null }) => ({
            ...makeMangaItem({ link: req.link, favouritedAt: req.favouritedAt ?? null }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore();
        await store.dispatch(setLibraryItemFavourite({ link: itemLink, favourite: true }));
        expect(updateItem).toHaveBeenCalledWith(
            expect.objectContaining({ link: itemLink, favouritedAt: expect.any(Date) }),
        );
        expect(store.getState().library.items[itemLink]?.favouritedAt).toBeInstanceOf(Date);
        await store.dispatch(setLibraryItemFavourite({ link: itemLink, favourite: false }));
        expect(updateItem).toHaveBeenCalledWith(expect.objectContaining({ link: itemLink, favouritedAt: null }));
        expect(store.getState().library.items[itemLink]?.favouritedAt).toBeNull();
    });

    it("persists a trimmed note and stores empty as null", async () => {
        const updateItem = vi.fn(async (req: { link: string; note?: string | null }) => ({
            ...makeMangaItem({ link: req.link, note: req.note ?? null }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        const store = makeStore();
        await store.dispatch(setLibraryItemNote({ link: itemLink, note: "  keep  " }));
        expect(updateItem).toHaveBeenCalledWith(expect.objectContaining({ link: itemLink, note: "keep" }));
        expect(store.getState().library.items[itemLink]?.note).toBe("keep");
        await store.dispatch(setLibraryItemNote({ link: itemLink, note: "   " }));
        expect(updateItem).toHaveBeenCalledWith(expect.objectContaining({ link: itemLink, note: null }));
        expect(store.getState().library.items[itemLink]?.note).toBeNull();
    });

    it("merges detailsCoverSource into extra without dropping other keys", async () => {
        const item = makeMangaItem({ link: itemLink, extra: { keep: true } });
        const store = configureStore({
            reducer: { library: libraryReducer },
            preloadedState: {
                library: {
                    items: { [itemLink]: item },
                    metadata: {},
                    loading: false,
                    error: null,
                },
            },
        });
        const updateItem = vi.fn(async (req: { link: string; extra?: Record<string, unknown> }) => ({
            ...makeMangaItem({ link: req.link, extra: req.extra ?? {} }),
        }));
        onInvoke("db:library:updateItem", updateItem);
        await store.dispatch(setLibraryItemDetailsCoverSource({ link: itemLink, source: "tracker" }));
        expect(updateItem).toHaveBeenCalledWith(
            expect.objectContaining({
                link: itemLink,
                extra: { keep: true, detailsCoverSource: "tracker" },
            }),
        );
        expect(store.getState().library.items[itemLink]?.extra).toEqual({
            keep: true,
            detailsCoverSource: "tracker",
        });
    });

    it("groups fetchAllMetadata rows by itemLink", async () => {
        const otherLink = path.join("library", "other");
        const rows = [
            {
                itemLink,
                source: "user" as const,
                title: "A",
                author: null,
                description: null,
                genres: null,
                tags: null,
                publisher: null,
                createdAt: new Date(0),
                updatedAt: new Date(0),
            },
            {
                itemLink: otherLink,
                source: "user" as const,
                title: "B",
                author: null,
                description: null,
                genres: null,
                tags: null,
                publisher: null,
                createdAt: new Date(0),
                updatedAt: new Date(0),
            },
        ];
        onInvoke("db:library:getAllMetadata", async () => rows);
        const store = makeStore();
        await store.dispatch(fetchAllMetadata());
        expect(store.getState().library.metadata[itemLink]).toEqual([rows[0]]);
        expect(store.getState().library.metadata[otherLink]).toEqual([rows[1]]);
    });

    it("merges a metadata overlay patch into the store", async () => {
        const row = {
            itemLink,
            source: "user" as const,
            title: null,
            author: null,
            description: "About",
            genres: null,
            tags: null,
            publisher: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
        };
        const setMetadata = vi.fn(async (req: { itemLink: string; source: "user" | "file" }) => ({
            ...row,
            itemLink: req.itemLink,
            source: req.source,
        }));
        onInvoke("db:library:setMetadata", setMetadata);
        const store = makeStore();
        await store.dispatch(setLibraryItemMetadata({ itemLink, source: "user", description: "About" }));
        expect(setMetadata).toHaveBeenCalledWith(
            expect.objectContaining({ itemLink, source: "user", description: "About" }),
        );
        expect(store.getState().library.metadata[itemLink]).toEqual([row]);
    });
});

describe("selectResolvedItemMetadata", () => {
    it("prefers the user overlay title over the library row", () => {
        const item = makeMangaItem({ link: itemLink, title: "Folder" });
        const overlay = {
            itemLink,
            source: "user" as const,
            title: "Edited",
            author: null,
            description: null,
            genres: null,
            tags: null,
            publisher: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
        };
        const store = configureStore({
            reducer: { library: libraryReducer, trackers: trackersReducer },
            preloadedState: {
                library: {
                    items: { [itemLink]: item },
                    metadata: { [itemLink]: [overlay] },
                    loading: false,
                    error: null,
                },
                trackers: { entries: [], coverCacheGeneration: 0 },
            },
        });
        const resolved = selectResolvedItemMetadata(
            store.getState() as Parameters<typeof selectResolvedItemMetadata>[0],
            itemLink,
        );
        expect(resolved?.title).toBe("Edited");
        expect(resolved?.originalTitle).toBe("Folder");
    });

    it("returns the cached display metadata while source rows are unchanged", () => {
        const item = makeMangaItem({ link: itemLink });
        const store = configureStore({
            reducer: { library: libraryReducer, trackers: trackersReducer },
            preloadedState: {
                library: {
                    items: { [itemLink]: item },
                    metadata: {},
                    loading: false,
                    error: null,
                },
                trackers: { entries: [], coverCacheGeneration: 0 },
            },
        });
        const state = store.getState() as Parameters<typeof selectResolvedItemMetadata>[0];

        const first = selectResolvedItemMetadata(state, itemLink);
        const second = selectResolvedItemMetadata(state, itemLink);

        expect(second).toBe(first);
    });
});
