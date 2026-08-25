import path from "node:path";
import { HttpNetworkError, HttpStatusError, http } from "@common/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    anilistCoverImageSrc,
    anilistRequest,
    authorFromAnilistStaff,
    getAnilistListEntry,
    getAnilistViewer,
    initAnilist,
    searchAnilistMedia,
    setAnilistClientToken,
    setAnilistStorageToken,
    toAnilistTrackerSnapshotUpdate,
    toTrackerListState,
    toTrackerMediaSnapshot,
} from "./anilist";
import { hexToSvgDataUri } from "./color";
import { dialogUtils } from "./dialog";

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

    it("stores the resolved AniList cover URL on the snapshot", () => {
        expect(
            toTrackerMediaSnapshot(media({ coverImage: { extraLarge: "xl", large: "l", medium: "m" } }))
                .coverImage,
        ).toBe("xl");
        expect(toTrackerMediaSnapshot(media({ coverImage: { medium: "m", color: "#112233" } })).coverImage).toBe(
            "m",
        );
    });
});

describe("anilistCoverImageSrc", () => {
    it("prefers extraLarge, then large, then medium, then a hex SVG", () => {
        expect(anilistCoverImageSrc({ extraLarge: "xl", large: "l", medium: "m", color: "#112233" })).toBe("xl");
        expect(anilistCoverImageSrc({ extraLarge: "  ", large: "l", medium: "m" })).toBe("l");
        expect(anilistCoverImageSrc({ medium: "m", color: "#112233" })).toBe("m");
        expect(anilistCoverImageSrc({ color: "#112233" })).toBe(hexToSvgDataUri("#112233"));
        expect(anilistCoverImageSrc({})).toBeNull();
        expect(anilistCoverImageSrc({ color: "not-hex" })).toBeNull();
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

describe("searchAnilistMedia coverImage fields", () => {
    beforeEach(() => {
        localStorage.clear();
        setAnilistClientToken("token");
        vi.spyOn(http, "postJson").mockResolvedValue({ data: { Page: { media: [] } } });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        setAnilistClientToken("");
    });

    it("requests extraLarge, large, medium, and color on coverImage", async () => {
        await searchAnilistMedia("title");
        const payload = vi.mocked(http.postJson).mock.calls[0]?.[1] as { query: string };
        expect(payload.query).toMatch(/coverImage\{\s*extraLarge\s+large\s+medium\s+color/);
    });
});

describe("getAnilistListEntry coverImage fields", () => {
    beforeEach(() => {
        localStorage.clear();
        setAnilistClientToken("token");
        vi.spyOn(http, "postJson").mockResolvedValue({ data: {} });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        setAnilistClientToken("");
    });

    it("requests extraLarge, large, medium, and color on coverImage", async () => {
        await getAnilistListEntry(1);
        const payload = vi.mocked(http.postJson).mock.calls[0]?.[1] as { query: string };
        expect(payload.query).toMatch(/coverImage\{\s*extraLarge\s+large\s+medium\s+color/);
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
        const result = await getAnilistViewer("viewer-token");

        expect(result).toEqual({
            ok: true,
            viewer: { name: "alice", options: { displayAdultContent: true } },
        });
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

    it("returns unauthorized on 401 and does not open a dialog", async () => {
        const customError = vi.spyOn(dialogUtils, "customError").mockResolvedValue({
            response: 0,
            checkboxChecked: false,
        });
        vi.mocked(http.postJson).mockRejectedValue(
            new HttpStatusError("https://graphql.anilist.co", 401, "Unauthorized", {}),
        );

        await expect(getAnilistViewer("viewer-token")).resolves.toEqual({
            ok: false,
            reason: "unauthorized",
        });
        expect(customError).not.toHaveBeenCalled();
    });

    it("returns unavailable on network failure and does not open a dialog", async () => {
        const customError = vi.spyOn(dialogUtils, "customError").mockResolvedValue({
            response: 0,
            checkboxChecked: false,
        });
        vi.mocked(http.postJson).mockRejectedValue(
            new HttpNetworkError("https://graphql.anilist.co", new Error("ECONNREFUSED")),
        );

        await expect(getAnilistViewer("viewer-token")).resolves.toEqual({
            ok: false,
            reason: "unavailable",
        });
        expect(customError).not.toHaveBeenCalled();
    });
});

describe("initAnilist", () => {
    beforeEach(() => {
        localStorage.clear();
        setAnilistClientToken("");
        vi.spyOn(dialogUtils, "customError").mockResolvedValue({ response: 0, checkboxChecked: false });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        setAnilistClientToken("");
    });

    it("opens the login-failed dialog only when the stored token is unauthorized", async () => {
        setAnilistStorageToken("stored-token");
        vi.spyOn(http, "postJson").mockRejectedValue(
            new HttpStatusError("https://graphql.anilist.co", 401, "Unauthorized", {}),
        );
        initAnilist();
        await vi.waitFor(() => {
            expect(dialogUtils.customError).toHaveBeenCalledTimes(1);
        });
    });

    it("does not open a dialog when AniList is unreachable", async () => {
        setAnilistStorageToken("stored-token");
        vi.spyOn(http, "postJson").mockRejectedValue(
            new HttpNetworkError("https://graphql.anilist.co", new Error("ECONNREFUSED")),
        );
        initAnilist();
        await Promise.resolve();
        await Promise.resolve();
        expect(dialogUtils.customError).not.toHaveBeenCalled();
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
