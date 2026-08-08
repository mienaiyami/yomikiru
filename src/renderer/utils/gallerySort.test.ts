import { makeBookItem, makeMangaItem } from "@test/fixtures/libraryItem";
import { describe, expect, it } from "vitest";
import { sortContinueReadingItems, sortGalleryItems } from "./gallerySort";

describe("sortGalleryItems", () => {
    const items = [
        makeMangaItem({ title: "B", link: "b", updatedAt: new Date("2024-01-01") }, null),
        makeMangaItem(
            {
                id: 2,
                title: "A",
                link: "a",
                updatedAt: new Date("2024-02-01"),
            },
            null,
        ),
        makeBookItem(
            {
                id: 3,
                title: "C",
                link: "c",
                updatedAt: new Date("2024-01-15"),
            },
            { lastReadAt: new Date("2024-03-01") },
        ),
    ];

    it("sorts by name", () => {
        const sorted = sortGalleryItems(items, "name", "normal");
        expect(sorted.map((i) => i.title)).toEqual(["A", "B", "C"]);
    });

    it("inverts name sort", () => {
        const sorted = sortGalleryItems(items, "name", "inverse");
        expect(sorted.map((i) => i.title)).toEqual(["C", "B", "A"]);
    });

    it("sorts by updated date descending", () => {
        const sorted = sortGalleryItems(items, "date", "normal");
        expect(sorted.map((i) => i.link)).toEqual(["a", "c", "b"]);
    });

    it("sorts by lastRead (missing progress -> 0)", () => {
        const sorted = sortGalleryItems(items, "lastRead", "normal");
        expect(sorted[0]?.link).toBe("c");
    });
});

describe("sortContinueReadingItems", () => {
    it("sorts by name or lastRead", () => {
        const items = [
            makeMangaItem({ title: "Z", link: "z" }, { lastReadAt: new Date("2024-01-01") }),
            makeMangaItem({ id: 2, title: "A", link: "a" }, { lastReadAt: new Date("2024-02-01") }),
        ];
        expect(sortContinueReadingItems(items, "name", "normal").map((i) => i.title)).toEqual(["A", "Z"]);
        expect(sortContinueReadingItems(items, "lastRead", "normal")[0]?.link).toBe("a");
    });
});
