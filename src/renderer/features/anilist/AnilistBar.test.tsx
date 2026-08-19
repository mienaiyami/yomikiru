import path from "node:path";
import type { ItemTracker } from "@common/types/db";
import { onInvoke } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, waitFor } from "@testing-library/react";
import { getAnilistListEntry } from "@utils/anilist";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnilistBar from "./AnilistBar";

vi.mock("@utils/anilist", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@utils/anilist")>();
    return {
        ...actual,
        getAnilistListEntry: vi.fn(),
    };
});

const itemLink = path.join("library", "tracked");

/** Tracker row used to mount a compact bar as already-linked. */
const trackerRow = (patch: Partial<ItemTracker> = {}): ItemTracker => ({
    id: 1,
    itemLink,
    provider: "anilist",
    remoteId: "99",
    remoteListId: null,
    remoteUrl: null,
    media: null,
    listState: null,
    syncedAt: null,
    createdAt: new Date(0),
    ...patch,
});

/** GraphQL list-entry payload returned by the mocked list-entry fetch. */
const listEntry = {
    id: 1,
    mediaId: 99,
    status: "CURRENT" as const,
    progress: 2,
    progressVolumes: 0,
    score: 0,
    repeat: 0,
    private: false,
    startedAt: { year: null, month: null, day: null },
    completedAt: { year: null, month: null, day: null },
    media: {
        title: { english: "English", romaji: "Romaji", native: "Native" },
        coverImage: { medium: "m", large: "l" },
        bannerImage: "b",
        siteUrl: "https://example.test",
        description: "About",
        genres: ["Drama"],
        chapters: 12,
        volumes: 3,
        averageScore: 80,
        idMal: 1,
        status: "RELEASING" as const,
        format: "MANGA" as const,
    },
};

describe("AnilistBar", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("does not refetch when a list-entry cache write replaces the tracker row", async () => {
        vi.mocked(getAnilistListEntry).mockResolvedValue(listEntry);
        onInvoke("db:trackers:updateSnapshot", async (req) =>
            trackerRow({
                media: req.media ?? null,
                listState: req.listState ?? null,
                remoteListId: req.remoteListId ?? null,
                remoteUrl: req.remoteUrl ?? null,
                syncedAt: req.syncedAt ?? null,
            }),
        );

        const { store } = renderWithProviders(<AnilistBar localLibraryLink={itemLink} variant="compact" />, {
            preloadedState: {
                anilist: { token: "token", currentListEntry: null, galleryTrackContext: null },
                trackers: { entries: [trackerRow()] },
            },
        });

        await waitFor(() => {
            expect(store.getState().trackers.entries[0]?.media?.description).toBe("About");
        });
        expect(getAnilistListEntry).toHaveBeenCalledTimes(1);
        expect(getAnilistListEntry).toHaveBeenCalledWith(99);
    });
});
