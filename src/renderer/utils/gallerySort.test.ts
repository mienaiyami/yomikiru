import { makeBookItem, makeMangaItem } from "@test/fixtures/libraryItem";
import { describe, expect, it } from "vitest";
import {
    type GalleryBookmarkMaps,
    selectBookmarkedItems,
    selectFavouritedItems,
    sortContinueReadingItems,
    sortGalleryItems,
} from "./gallerySort";

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
    it("sorts by lastReadAt descending", () => {
        const items = [
            makeMangaItem({ title: "Z", link: "z" }, { lastReadAt: new Date("2024-01-01") }),
            makeMangaItem({ id: 2, title: "A", link: "a" }, { lastReadAt: new Date("2024-02-01") }),
            makeMangaItem({ id: 3, title: "None", link: "n" }, null),
        ];
        expect(sortContinueReadingItems(items).map((i) => i.link)).toEqual(["a", "z", "n"]);
    });
});

describe("selectBookmarkedItems", () => {
    const mangaA = makeMangaItem({ title: "Alpha", link: "a" }, null);
    const mangaB = makeMangaItem({ id: 2, title: "Beta", link: "b" }, { lastReadAt: new Date("2024-06-01") });
    const bookC = makeBookItem({ id: 3, title: "Gamma", link: "c" }, null);
    const mangaEmpty = makeMangaItem({ id: 4, title: "Empty", link: "empty" }, null);
    const items = [mangaA, mangaB, bookC, mangaEmpty];

    const bookmarks: GalleryBookmarkMaps = {
        manga: {
            a: [{ createdAt: new Date("2024-01-01") }],
            b: [{ createdAt: new Date("2024-03-01") }, { createdAt: new Date("2024-02-01") }],
            empty: [],
            nullish: null,
        },
        book: {
            c: [{ createdAt: new Date("2024-02-15") }],
        },
    };

    it("keeps items with at least one bookmark, including no-progress titles", () => {
        expect(selectBookmarkedItems(items, bookmarks).map((i) => i.link)).toEqual(["a", "b", "c"]);
    });

    it("drops empty and null bookmark lists", () => {
        const onlyEmpty = selectBookmarkedItems([mangaEmpty], {
            manga: { empty: [], gone: null },
            book: {},
        });
        expect(onlyEmpty).toEqual([]);
    });
});

describe("selectFavouritedItems", () => {
    it("keeps only items with favouritedAt set", () => {
        const starred = makeMangaItem(
            { title: "Starred", link: "star", favouritedAt: new Date("2024-01-01") },
            null,
        );
        const plain = makeMangaItem({ id: 2, title: "Plain", link: "plain" }, null);
        expect(selectFavouritedItems([starred, plain]).map((item) => item.link)).toEqual(["star"]);
    });
});
