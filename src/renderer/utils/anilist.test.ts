import { describe, expect, it } from "vitest";
import { toTrackerListState, toTrackerMediaSnapshot } from "./anilist";

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
