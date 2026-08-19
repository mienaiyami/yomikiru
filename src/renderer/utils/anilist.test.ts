import { http } from "@common/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    anilistRequest,
    setAnilistClientToken,
    setAnilistStorageToken,
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

describe("toTrackerMediaSnapshot", () => {
    it("copies publication status and format from the AniList media payload", () => {
        const snapshot = toTrackerMediaSnapshot(media());
        expect(snapshot.status).toBe("RELEASING");
        expect(snapshot.format).toBe("MANGA");
        expect(snapshot.title).toBe("English");
        expect(snapshot.totalChapters).toBe(12);
        expect(snapshot.score).toBe(80);
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

describe("toTrackerListState", () => {
    it("copies list-entry status and scores", () => {
        const state = toTrackerListState({
            id: 1,
            mediaId: 2,
            status: "CURRENT",
            progress: 4,
            progressVolumes: 1,
            score: 70,
            repeat: 0,
            private: false,
            startedAt: { year: null, month: null, day: null },
            completedAt: { year: null, month: null, day: null },
            media: media(),
        });
        expect(state).toEqual({ status: "CURRENT", progress: 4, progressVolumes: 1, score: 70 });
    });
});
