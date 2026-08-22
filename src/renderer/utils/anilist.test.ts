import path from "node:path";
import { HttpStatusError, http } from "@common/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    anilistRequest,
    authorFromAnilistStaff,
    getAnilistViewer,
    searchAnilistMedia,
    setAnilistClientToken,
    setAnilistStorageToken,
    toAnilistTrackerSnapshotUpdate,
    toTrackerListState,
    toTrackerMediaSnapshot,
} from "./anilist";

const media = (patch: Partial<Anilist.ListEntry["media"]> = {}): Anilist.ListEntry["media"] => ({
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
    status: "RELEASING",
    format: "MANGA",
    ...patch,
});

/** GraphQL list-entry fixture for mapping tests. */
const listEntry = (patch: Partial<Anilist.ListEntry> = {}): Anilist.ListEntry => ({
    id: 42,
    mediaId: 99,
    status: "CURRENT",
    progress: 4,
    progressVolumes: 1,
    score: 70,
    repeat: 0,
    private: false,
    startedAt: { year: null, month: null, day: null },
    completedAt: { year: null, month: null, day: null },
    media: media(),
    ...patch,
});

describe("toTrackerMediaSnapshot", () => {
    it("copies publication status and format from the AniList media payload", () => {
        const snapshot = toTrackerMediaSnapshot(media());
        expect(snapshot.status).toBe("RELEASING");
        expect(snapshot.format).toBe("MANGA");
        expect(snapshot.title).toBe("English");
        expect(snapshot.totalChapters).toBe(12);
        expect(snapshot.score).toBe(80);
        expect(snapshot.author).toBeNull();
    });

    it("copies the preferred staff names as author", () => {
        const snapshot = toTrackerMediaSnapshot(
            media({
                staff: {
                    edges: [
                        { role: "Art", node: { name: { full: "Artist" } } },
                        { role: "Story & Art", node: { name: { full: "Author One" } } },
                        { role: "Story", node: { name: { full: "Author Two" } } },
                    ],
                },
            }),
        );
        expect(snapshot.author).toBe("Author One, Author Two");
    });

    it("stores null status and format when the payload omits them", () => {
        const snapshot = toTrackerMediaSnapshot(media({ status: undefined, format: undefined }));
        expect(snapshot.status).toBeNull();
        expect(snapshot.format).toBeNull();
    });
});

describe("anilistRequest token", () => {
    beforeEach(() => {
        localStorage.clear();
        setAnilistClientToken("");
        vi.spyOn(http, "postJson").mockResolvedValue({ data: { Viewer: { name: "alice" } } });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        setAnilistClientToken("");
    });

    it("uses the stored token when the in-memory client token is not set yet", async () => {
        setAnilistStorageToken("stored-token");
        const data = await anilistRequest("query { Viewer { name } }");
        expect(http.postJson).toHaveBeenCalledOnce();
        expect(vi.mocked(http.postJson).mock.calls[0]?.[2]).toEqual(
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer stored-token",
                }),
            }),
        );
        expect(data?.Viewer?.name).toBe("alice");
    });

    it("skips the request when neither memory nor storage has a token", async () => {
        await anilistRequest("query { Viewer { name } }");
        expect(http.postJson).not.toHaveBeenCalled();
    });
});

describe("getAnilistViewer", () => {
    beforeEach(() => {
        localStorage.clear();
        setAnilistClientToken("");
        vi.spyOn(http, "postJson").mockResolvedValue({
            data: { Viewer: { name: "alice", options: { displayAdultContent: true } } },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        setAnilistClientToken("");
    });

    it("loads the username and adult-content preference from one Viewer request", async () => {
        const viewer = await getAnilistViewer("viewer-token");

        expect(viewer).toEqual({ name: "alice", options: { displayAdultContent: true } });
        expect(http.postJson).toHaveBeenCalledWith(
            "https://graphql.anilist.co",
            expect.objectContaining({
                query: expect.stringContaining("displayAdultContent"),
            }),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer viewer-token" }),
            }),
        );

        setAnilistClientToken("viewer-token");
        await searchAnilistMedia("title");
        expect(vi.mocked(http.postJson).mock.calls[1]?.[1]).toEqual(
            expect.objectContaining({ variables: { search: "title" } }),
        );
    });

    it("returns undefined when AniList rejects the token", async () => {
        vi.mocked(http.postJson).mockRejectedValue(
            new HttpStatusError("https://graphql.anilist.co", 401, "Unauthorized", {}),
        );

        await expect(getAnilistViewer("viewer-token")).resolves.toBeUndefined();
    });
});

describe("authorFromAnilistStaff", () => {
    it("falls back to named staff when no story or creator role exists", () => {
        expect(
            authorFromAnilistStaff({
                edges: [{ role: "Art", node: { name: { full: "Artist" } } }],
            }),
        ).toBe("Artist");
    });
});

describe("toTrackerListState", () => {
    it("copies list-entry status and scores", () => {
        expect(toTrackerListState(listEntry())).toEqual({
            status: "CURRENT",
            progress: 4,
            progressVolumes: 1,
            score: 70,
        });
    });
});

describe("toAnilistTrackerSnapshotUpdate", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("maps a list entry to AniList provider snapshot IPC args", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
        const itemLink = path.join("library", "tracked");
        const update = toAnilistTrackerSnapshotUpdate(itemLink, listEntry());
        expect(update).toEqual({
            itemLink,
            provider: "anilist",
            remoteListId: "42",
            remoteUrl: "https://example.test",
            media: {
                title: "English",
                author: null,
                coverImage: "l",
                bannerImage: "b",
                description: "About",
                genres: ["Drama"],
                status: "RELEASING",
                format: "MANGA",
                totalChapters: 12,
                siteUrl: "https://example.test",
                score: 80,
            },
            listState: { status: "CURRENT", progress: 4, progressVolumes: 1, score: 70 },
            syncedAt: new Date("2026-01-15T12:00:00.000Z"),
        });
    });
});
