import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    AddToLibrarySchema,
    UpdateBookBookmarkSchema,
    UpdateBookProgressSchema,
    UpdateLibraryItemSchema,
    UpdateMangaBookmarkSchema,
    UpdateMangaProgressSchema,
} from "./validator";

const mangaLink = path.join("testdata", "manga", "series");
const bookLink = path.join("testdata", "books", "novel.epub");

describe("AddToLibrarySchema", () => {
    it("accepts a valid manga payload", () => {
        const parsed = AddToLibrarySchema.safeParse({
            type: "manga",
            data: {
                type: "manga",
                link: mangaLink,
                title: "Series",
            },
            progress: {
                chapterName: "ch1",
                currentPage: 1,
                totalPages: 10,
            },
        });
        expect(parsed.success).toBe(true);
    });

    it("accepts a valid book payload", () => {
        const parsed = AddToLibrarySchema.safeParse({
            type: "book",
            data: {
                type: "book",
                link: bookLink,
                title: "Novel",
            },
            progress: {
                chapterId: "c1",
                position: "p",
                chapterName: "One",
            },
        });
        expect(parsed.success).toBe(true);
    });

    it("rejects mismatched type discriminators", () => {
        const parsed = AddToLibrarySchema.safeParse({
            type: "manga",
            data: {
                type: "book",
                link: bookLink,
                title: "Novel",
            },
            progress: {
                chapterName: "ch1",
                currentPage: 1,
                totalPages: 10,
            },
        });
        expect(parsed.success).toBe(false);
    });
});

describe("Update* schemas", () => {
    it("requires link / itemLink", () => {
        expect(UpdateLibraryItemSchema.safeParse({ title: "x" }).success).toBe(false);
        expect(UpdateLibraryItemSchema.safeParse({ link: "a", title: "x" }).success).toBe(true);
        expect(UpdateMangaProgressSchema.safeParse({ currentPage: 2 }).success).toBe(false);
        expect(UpdateMangaProgressSchema.safeParse({ itemLink: "a", currentPage: 2 }).success).toBe(true);
        expect(UpdateBookProgressSchema.safeParse({ position: "p" }).success).toBe(false);
        expect(UpdateBookProgressSchema.safeParse({ itemLink: "a", position: "p" }).success).toBe(true);
    });

    it("accepts partial bookmark updates with required id", () => {
        expect(UpdateMangaBookmarkSchema.safeParse({ id: 1 }).success).toBe(false);
        expect(UpdateMangaBookmarkSchema.safeParse({ id: 1, chapterName: "ch2" }).success).toBe(true);
        expect(UpdateMangaBookmarkSchema.safeParse({ id: 1, page: 3, note: "x" }).success).toBe(true);
        expect(UpdateBookBookmarkSchema.safeParse({ id: 1 }).success).toBe(false);
        expect(UpdateBookBookmarkSchema.safeParse({ id: 1, chapterId: "c2", position: "body" }).success).toBe(
            true,
        );
    });
});
