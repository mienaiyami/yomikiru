import type { ItemTracker, LibraryItemMetadata } from "@common/types/db";
import { describe, expect, it } from "vitest";
import {
    formatGenreList,
    hasTrackerMediaFacts,
    libraryItemSearchText,
    parseGenreList,
    resolveAllItemMetadata,
    resolveItemMetadata,
    trackerByItemLink,
    trackerExternalOpenLabelKey,
    trackerMediaHref,
    trackerMediaPageUrl,
} from "./libraryMetadata";

const overlay = (
    source: LibraryItemMetadata["source"],
    patch: Partial<LibraryItemMetadata>,
): LibraryItemMetadata => ({
    itemLink: "x",
    source,
    title: null,
    author: null,
    description: null,
    genres: null,
    tags: null,
    publisher: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...patch,
});

const tracker = (patch: Partial<ItemTracker> = {}): ItemTracker => ({
    id: 1,
    itemLink: "x",
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

describe("resolveItemMetadata", () => {
    it("prefers tracker author over the library item when overlays omit it", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Base", author: "Folder Author" },
            overlays: [],
            tracker: tracker({ media: { author: "Staff Author" } }),
        });
        expect(resolved.author).toBe("Staff Author");
    });

    it("uses library title and author when no overlays exist", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Folder Title", author: "File Author" },
            overlays: [],
        });
        expect(resolved.title).toBe("Folder Title");
        expect(resolved.originalTitle).toBeNull();
        expect(resolved.searchTitles).toEqual(["Folder Title"]);
        expect(resolved.author).toBe("File Author");
        expect(resolved.description).toBeNull();
        expect(resolved.genres).toEqual([]);
    });

    it("prefers user overlay over tracker and file and keeps the library title as original", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Base", author: "Base Author" },
            overlays: [
                overlay("user", { title: "User Title", description: "User about", genres: ["Drama"] }),
                overlay("file", { title: "File Title", description: "File about", genres: ["Action"] }),
            ],
            tracker: tracker({
                media: { title: "Tracker Title", description: "Tracker about", genres: ["Comedy"] },
            }),
        });
        expect(resolved.title).toBe("User Title");
        expect(resolved.originalTitle).toBe("Base");
        expect(resolved.searchTitles).toEqual(["User Title", "Tracker Title", "File Title", "Base"]);
        expect(resolved.description).toBe("User about");
        expect(resolved.genres).toEqual(["Drama"]);
    });

    it("shows the library title as original when only the tracker title differs", () => {
        const resolved = resolveItemMetadata({
            item: { title: "folder-name", author: null },
            overlays: [],
            tracker: tracker({ media: { title: "Tracker" } }),
        });
        expect(resolved.title).toBe("Tracker");
        expect(resolved.originalTitle).toBe("folder-name");
    });

    it("omits original when the user title matches the library row ignoring case", () => {
        const resolved = resolveItemMetadata({
            item: { title: "One Piece", author: null },
            overlays: [overlay("user", { title: "one piece" })],
        });
        expect(resolved.title).toBe("one piece");
        expect(resolved.originalTitle).toBeNull();
    });

    it("prefers tracker over file when user does not supply the field", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Base", author: null },
            overlays: [overlay("file", { description: "File about", genres: ["Action"] })],
            tracker: tracker({
                media: { description: "Tracker about", genres: ["Comedy"], status: "RELEASING" },
                listState: { status: "CURRENT", score: 80 },
            }),
        });
        expect(resolved.description).toBe("Tracker about");
        expect(resolved.genres).toEqual(["Comedy"]);
        expect(resolved.mediaStatus).toBe("RELEASING");
        expect(resolved.mediaScore).toBeNull();
    });

    it("treats empty string and empty arrays as missing", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Base", author: "Keep" },
            overlays: [overlay("user", { title: "", author: "", description: "", genres: [], tags: [] })],
            tracker: tracker({ media: { title: "Tracker", description: "About", genres: ["Action"] } }),
        });
        expect(resolved.title).toBe("Tracker");
        expect(resolved.author).toBe("Keep");
        expect(resolved.description).toBe("About");
        expect(resolved.genres).toEqual(["Action"]);
    });

    it("keeps tracker catalog fields on the media snapshot, not list-entry state", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Base", author: null },
            overlays: [overlay("user", { description: "User about" })],
            tracker: tracker({
                listState: { status: "PAUSED", score: 40 },
                media: {
                    siteUrl: "https://a",
                    totalChapters: 12,
                    score: 78,
                    status: "RELEASING",
                    format: "MANGA",
                },
            }),
        });
        expect(resolved.description).toBe("User about");
        expect(resolved.mediaStatus).toBe("RELEASING");
        expect(resolved.mediaScore).toBe(78);
        expect(resolved.mediaFormat).toBe("MANGA");
        expect(resolved.siteUrl).toBe("https://a");
        expect(resolved.totalChapters).toBe(12);
    });
});

describe("hasTrackerMediaFacts", () => {
    it("is false when every catalog field is empty", () => {
        expect(
            hasTrackerMediaFacts({
                mediaStatus: null,
                mediaScore: null,
                mediaFormat: null,
                totalChapters: null,
            }),
        ).toBe(false);
    });

    it("is true when score is zero", () => {
        expect(
            hasTrackerMediaFacts({
                mediaStatus: null,
                mediaScore: 0,
                mediaFormat: null,
                totalChapters: null,
            }),
        ).toBe(true);
    });
});

describe("trackerMediaPageUrl", () => {
    it("builds the AniList manga page from the remote id", () => {
        expect(trackerMediaPageUrl("anilist", "12345")).toBe("https://anilist.co/manga/12345");
    });

    it("returns null when the remote id is empty", () => {
        expect(trackerMediaPageUrl("anilist", "")).toBeNull();
        expect(trackerMediaPageUrl("anilist", "   ")).toBeNull();
        expect(trackerMediaPageUrl("anilist", null)).toBeNull();
    });
});

describe("trackerExternalOpenLabelKey", () => {
    it("maps anilist to the Open on AniList details key", () => {
        expect(trackerExternalOpenLabelKey("anilist")).toBe("gallery.details.openOnAnilist");
    });
});

describe("trackerMediaHref", () => {
    it("prefers the stored remote page URL", () => {
        expect(trackerMediaHref(tracker({ remoteId: "99", remoteUrl: " https://anilist.co/manga/99 " }))).toBe(
            "https://anilist.co/manga/99",
        );
    });

    it("falls back to provider + remote id when remoteUrl is empty", () => {
        expect(trackerMediaHref(tracker({ remoteId: " 99 ", remoteUrl: null }))).toBe(
            "https://anilist.co/manga/99",
        );
    });

    it("returns null when neither remoteUrl nor remote id is usable", () => {
        expect(trackerMediaHref(tracker({ remoteId: "  ", remoteUrl: "  " }))).toBeNull();
    });
});

describe("libraryItemSearchText", () => {
    it("joins title layers and appends extra tokens", () => {
        expect(libraryItemSearchText(["User", "Folder"], "manga|comic")).toBe("User Foldermanga|comic");
    });
});

describe("trackerByItemLink / resolveAllItemMetadata", () => {
    it("keeps the first tracker row per path", () => {
        const first = tracker({ id: 1, itemLink: "a", media: { title: "One" } });
        const second = tracker({ id: 2, itemLink: "a", media: { title: "Two" } });
        const map = trackerByItemLink([first, second]);
        expect(map.a?.id).toBe(1);
    });

    it("resolves each library item against its overlays and tracker", () => {
        const resolved = resolveAllItemMetadata(
            [{ link: "a", title: "Folder", author: null }],
            { a: [overlay("user", { itemLink: "a", title: "Edited" })] },
            { a: tracker({ itemLink: "a", media: { title: "Tracker" } }) },
        );
        expect(resolved.a?.title).toBe("Edited");
        expect(resolved.a?.originalTitle).toBe("Folder");
        expect(resolved.a?.searchTitles).toEqual(["Edited", "Tracker", "Folder"]);
    });
});

describe("parseGenreList / formatGenreList", () => {
    it("splits, trims, and drops empty tokens", () => {
        expect(parseGenreList(" Adventure,  Drama, ,Comedy ")).toEqual(["Adventure", "Drama", "Comedy"]);
    });

    it("joins genres for the editor input", () => {
        expect(formatGenreList(["Adventure", "Drama"])).toBe("Adventure, Drama");
    });
});
