import type { ItemTracker, LibraryItemMetadata } from "@common/types/db";
import { describe, expect, it } from "vitest";
import { formatGenreList, parseGenreList, resolveItemMetadata } from "./libraryMetadata";

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
    it("uses library title and author when no overlays exist", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Folder Title", author: "File Author" },
            overlays: [],
        });
        expect(resolved.title).toBe("Folder Title");
        expect(resolved.author).toBe("File Author");
        expect(resolved.description).toBeNull();
        expect(resolved.genres).toEqual([]);
    });

    it("prefers user overlay over tracker and file", () => {
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
        expect(resolved.description).toBe("User about");
        expect(resolved.genres).toEqual(["Drama"]);
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
        expect(resolved.status).toBe("CURRENT");
        expect(resolved.score).toBe(80);
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

    it("keeps tracker-only fields off the file/user layers", () => {
        const resolved = resolveItemMetadata({
            item: { title: "Base", author: null },
            overlays: [overlay("user", { description: "User about" })],
            tracker: tracker({
                listState: { status: "PAUSED", score: 40 },
                media: { siteUrl: "https://a", totalChapters: 12 },
            }),
        });
        expect(resolved.description).toBe("User about");
        expect(resolved.status).toBe("PAUSED");
        expect(resolved.score).toBe(40);
        expect(resolved.siteUrl).toBe("https://a");
        expect(resolved.totalChapters).toBe(12);
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
