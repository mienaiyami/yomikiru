import path from "node:path";
import type { ItemTracker } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RootState } from ".";
import trackersReducer, {
    removeTracker,
    selectTracker,
    trackerCoverCached,
    updateTrackerSnapshot,
    upsertTracker,
} from "./trackers";

const itemLink = path.join("library", "tracked");

/** Tracker row for thunk merge tests. */
const trackerRow = (patch: Partial<ItemTracker> = {}): ItemTracker => ({
    id: 1,
    itemLink,
    provider: "anilist",
    remoteId: "1",
    remoteListId: null,
    remoteUrl: null,
    media: null,
    listState: null,
    syncedAt: null,
    createdAt: new Date(0),
    ...patch,
});

/** Isolated trackers store. */
const makeStore = (entries: ItemTracker[] = []) =>
    configureStore({
        reducer: { trackers: trackersReducer },
        preloadedState: { trackers: { entries, coverCacheGeneration: 0 } },
    });

describe("trackers thunks", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("merges upsertTracker into entries by itemLink and provider", async () => {
        const row = trackerRow({ remoteId: "99" });
        onInvoke("db:trackers:upsert", async () => row);
        const store = makeStore();
        await store.dispatch(upsertTracker({ itemLink, provider: "anilist", remoteId: "99" }));
        expect(store.getState().trackers.entries).toEqual([row]);
    });

    it("removes the matching tracker row on removeTracker", async () => {
        onInvoke("db:trackers:remove", async () => true);
        const store = makeStore([trackerRow(), trackerRow({ id: 2, itemLink: path.join("library", "other") })]);
        await store.dispatch(removeTracker({ itemLink, provider: "anilist" }));
        expect(store.getState().trackers.entries).toHaveLength(1);
        expect(store.getState().trackers.entries[0]?.itemLink).toBe(path.join("library", "other"));
    });

    it("replaces cache fields on updateTrackerSnapshot", async () => {
        const updated = trackerRow({
            media: { title: "Cached", status: "RELEASING", format: "MANGA" },
            syncedAt: new Date(1),
        });
        onInvoke("db:trackers:updateSnapshot", async () => updated);
        const store = makeStore([trackerRow()]);
        await store.dispatch(
            updateTrackerSnapshot({
                itemLink,
                provider: "anilist",
                media: updated.media,
                syncedAt: updated.syncedAt ?? undefined,
            }),
        );
        expect(store.getState().trackers.entries[0]?.media?.title).toBe("Cached");
        expect(store.getState().trackers.entries[0]?.media?.status).toBe("RELEASING");
    });

    it("bumps coverCacheGeneration after a successful tracker cover download", async () => {
        const row = trackerRow({ media: { coverImage: "https://example.test/c.jpg" } });
        onInvoke("db:trackers:upsert", async () => row);
        onInvoke("covers:materializeFromUrl", async () => ({ ok: true as const }));
        stubFs({ isFile: () => false });
        const store = configureStore({
            reducer: {
                trackers: trackersReducer,
                library: (state = { items: { [itemLink]: { id: 42 } } }) => state,
            },
            preloadedState: {
                trackers: { entries: [], coverCacheGeneration: 0 },
                library: { items: { [itemLink]: { id: 42 } } },
            },
        });
        await store.dispatch(upsertTracker({ itemLink, provider: "anilist", remoteId: "1" }));
        await vi.waitFor(() => {
            expect(store.getState().trackers.coverCacheGeneration).toBe(1);
        });
    });
});

describe("selectTracker", () => {
    /** Minimal root state so {@link selectTracker} can read `trackers.entries`. */
    const asRoot = (entries: ItemTracker[]): RootState =>
        ({ trackers: { entries, coverCacheGeneration: 0 } }) as RootState;

    it("returns the row for the library path and provider", () => {
        const row = trackerRow({ remoteId: "99" });
        expect(selectTracker(asRoot([row]), itemLink, "anilist")).toEqual(row);
    });

    it("returns undefined when the library path does not match", () => {
        expect(selectTracker(asRoot([trackerRow()]), path.join("library", "other"), "anilist")).toBeUndefined();
    });

    it("returns undefined when itemLink is missing", () => {
        expect(selectTracker(asRoot([trackerRow()]), undefined, "anilist")).toBeUndefined();
    });
});

describe("trackerCoverCached", () => {
    it("increments coverCacheGeneration", () => {
        const store = makeStore();
        store.dispatch(trackerCoverCached());
        expect(store.getState().trackers.coverCacheGeneration).toBe(1);
    });
});
