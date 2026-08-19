import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    AddToLibrarySchema,
    RemoveItemTrackerSchema,
    SetLibraryItemMetadataSchema,
    UpdateBookProgressSchema,
    UpdateLibraryItemSchema,
    UpdateMangaProgressSchema,
    UpsertItemTrackerSchema,
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

    it("accepts optional note and favouritedAt on library item updates", () => {
        expect(UpdateLibraryItemSchema.safeParse({ link: "a", note: "hello" }).success).toBe(true);
        expect(UpdateLibraryItemSchema.safeParse({ link: "a", note: null }).success).toBe(true);
        expect(UpdateLibraryItemSchema.safeParse({ link: "a", favouritedAt: null }).success).toBe(true);
        expect(
            UpdateLibraryItemSchema.safeParse({ link: "a", favouritedAt: new Date().toISOString() }).success,
        ).toBe(true);
    });
});

describe("tracker and metadata schemas", () => {
    it("requires itemLink, provider, and remoteId on upsert", () => {
        expect(
            UpsertItemTrackerSchema.safeParse({
                itemLink: mangaLink,
                provider: "anilist",
                remoteId: "123",
            }).success,
        ).toBe(true);
        expect(UpsertItemTrackerSchema.safeParse({ itemLink: mangaLink, provider: "anilist" }).success).toBe(
            false,
        );
        expect(RemoveItemTrackerSchema.safeParse({ itemLink: mangaLink, provider: "anilist" }).success).toBe(true);
    });

    it("treats omitted metadata fields as absent, not cleared", () => {
        const parsed = SetLibraryItemMetadataSchema.parse({
            itemLink: mangaLink,
            source: "user",
            description: "hello",
        });
        expect(parsed.description).toBe("hello");
        expect(parsed.author).toBeUndefined();
        expect(
            SetLibraryItemMetadataSchema.parse({
                itemLink: mangaLink,
                source: "user",
                author: null,
            }).author,
        ).toBeNull();
    });

    it("accepts nested tracker media snapshots on upsert", () => {
        expect(
            UpsertItemTrackerSchema.safeParse({
                itemLink: mangaLink,
                provider: "anilist",
                remoteId: "123",
                media: { title: "T", genres: ["Action"] },
                listState: { progress: 2 },
            }).success,
        ).toBe(true);
        expect(
            UpsertItemTrackerSchema.safeParse({
                itemLink: mangaLink,
                provider: "anilist",
                remoteId: "123",
                media: { genres: "not-an-array" },
            }).success,
        ).toBe(false);
    });
});
