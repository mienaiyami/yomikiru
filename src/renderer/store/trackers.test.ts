import path from "node:path";
import type { ItemTracker } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import { onInvoke } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import trackersReducer, { removeTracker, updateTrackerSnapshot, upsertTracker } from "./trackers";

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
        preloadedState: { trackers: { entries } },
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
});
