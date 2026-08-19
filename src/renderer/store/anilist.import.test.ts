import path from "node:path";
import type { ItemTracker } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import { makeMangaItem } from "@test/fixtures/libraryItem";
import { onInvoke } from "@test/mocks/preload";
import { STORAGE_KEYS } from "@utils/localStorage";
import { afterEach, describe, expect, it, vi } from "vitest";
import anilistReducer, { importAnilistTrackingFromStorage, relocateGalleryTrackContext } from "./anilist";
import libraryReducer, { relocateLibraryItem } from "./library";
import trackersReducer from "./trackers";

const itemLink = path.join("library", "tracked");
const orphanLink = path.join("library", "gone");

/** Tracker row returned by the upsert stub. */
const trackerRow = (link: string, remoteId: string): ItemTracker => ({
    id: 1,
    itemLink: link,
    provider: "anilist",
    remoteId,
    remoteListId: null,
    remoteUrl: null,
    media: null,
    listState: null,
    syncedAt: null,
    createdAt: new Date(0),
});

/** Isolated library + anilist + trackers store for import / relocate tests. */
const makeStore = () =>
    configureStore({
        reducer: {
            library: libraryReducer,
            anilist: anilistReducer,
            trackers: trackersReducer,
        },
        preloadedState: {
            library: {
                items: { [itemLink]: makeMangaItem({ link: itemLink }) },
                metadata: {},
                loading: false,
                error: null,
            },
            anilist: {
                token: null,
                currentListEntry: null,
                galleryTrackContext: { link: itemLink, title: "Tracked" },
            },
            trackers: {
                entries: [trackerRow(itemLink, "1")],
            },
        },
    });

describe("importAnilistTrackingFromStorage", () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("upserts matching links, skips orphans, sets the marker, and keeps the original key", async () => {
        const payload: Anilist.TrackStore = [
            { localURL: itemLink, anilistMediaId: 42 },
            { localURL: orphanLink, anilistMediaId: 7 },
        ];
        localStorage.setItem(STORAGE_KEYS.ANILIST_TRACKING, JSON.stringify(payload));
        const upsert = vi.fn(async (req: { itemLink: string; remoteId: string }) =>
            trackerRow(req.itemLink, req.remoteId),
        );
        onInvoke("db:trackers:upsert", upsert);

        const store = makeStore();
        await store.dispatch(importAnilistTrackingFromStorage());

        expect(upsert).toHaveBeenCalledTimes(1);
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({ itemLink, provider: "anilist", remoteId: "42" }),
        );
        expect(localStorage.getItem(STORAGE_KEYS.ANILIST_TRACKING)).toBe(JSON.stringify(payload));
        expect(localStorage.getItem(STORAGE_KEYS.ANILIST_TRACKING_IMPORTED)).toBe("1");

        upsert.mockClear();
        await store.dispatch(importAnilistTrackingFromStorage());
        expect(upsert).not.toHaveBeenCalled();
        expect(localStorage.getItem(STORAGE_KEYS.ANILIST_TRACKING)).toBe(JSON.stringify(payload));
    });
});

describe("tracker relocate extraReducer", () => {
    it("rewrites tracking itemLink and session gallery context", () => {
        const newLink = path.join("library", "moved");
        const store = makeStore();
        store.dispatch(relocateGalleryTrackContext({ oldLink: itemLink, newLink }));
        store.dispatch(
            relocateLibraryItem.fulfilled(
                {
                    id: 1,
                    link: newLink,
                    title: "Tracked",
                    type: "manga",
                    author: null,
                    cover: null,
                    favouritedAt: null,
                    note: null,
                    extra: {},
                    createdAt: new Date(0),
                    updatedAt: new Date(0),
                },
                "req",
                { oldLink: itemLink, newLink },
            ),
        );
        const state = store.getState();
        expect(state.anilist.galleryTrackContext?.link).toBe(newLink);
        expect(state.trackers.entries[0]?.itemLink).toBe(newLink);
    });
});
