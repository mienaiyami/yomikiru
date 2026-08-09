import path from "node:path";
import type { LibraryItem } from "@common/types/db";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import {
    doesRelocateNameMatch,
    findLibraryItemForPath,
    libraryPathDisplayName,
    mapOpenPathAfterRelocate,
    shouldOfferLibraryRelocate,
} from "./libraryMissingPath";

const mangaItem = (link: string): LibraryItem =>
    ({
        id: 1,
        link,
        title: "Series",
        type: "manga",
        author: null,
        cover: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    }) as LibraryItem;

describe("libraryMissingPath", () => {
    describe("libraryPathDisplayName / doesRelocateNameMatch", () => {
        it("uses folder basename for manga dirs and stem for books/archives", () => {
            const mangaDir = path.join("library", "One Piece");
            const mangaArchive = path.join("library", "One Piece.cbz");
            const bookFile = path.join("library", "Novel.epub");
            expect(libraryPathDisplayName(mangaDir, "manga")).toBe("One Piece");
            expect(libraryPathDisplayName(mangaArchive, "manga")).toBe("One Piece");
            expect(libraryPathDisplayName(bookFile, "book")).toBe("Novel");
        });

        it("matches on previous basename or library title", () => {
            const oldLink = path.join("old", "Series A");
            const sameName = path.join("new", "Series A");
            const titleOnly = path.join("new", "Custom Title");
            const mismatch = path.join("new", "Other");

            expect(doesRelocateNameMatch(oldLink, sameName, "Anything", "manga")).toBe(true);
            expect(doesRelocateNameMatch(oldLink, titleOnly, "Custom Title", "manga")).toBe(true);
            expect(doesRelocateNameMatch(oldLink, mismatch, "Series A", "manga")).toBe(false);
        });

        it("matches folder title to archive stem", () => {
            const oldDir = path.join("old", "Series A");
            const newArchive = path.join("new", "Series A.cbz");
            expect(doesRelocateNameMatch(oldDir, newArchive, "Other Title", "manga")).toBe(true);
        });
    });

    describe("shouldOfferLibraryRelocate", () => {
        it("is true only when the library root path is missing", () => {
            const root = path.join("library", "series");
            stubFs({
                existsSync: (p) => p !== root,
            });
            expect(shouldOfferLibraryRelocate(root)).toBe(true);

            stubFs({
                existsSync: () => true,
            });
            expect(shouldOfferLibraryRelocate(root)).toBe(false);
        });
    });

    describe("findLibraryItemForPath / mapOpenPathAfterRelocate", () => {
        it("matches exact library roots and chapter paths under the longest root", () => {
            const root = path.join("library", "series");
            const nested = path.join(root, "ch01");
            const other = path.join("library", "other");
            const items = {
                [root]: mangaItem(root),
                [other]: mangaItem(other),
            };
            expect(findLibraryItemForPath(items, root)?.link).toBe(root);
            expect(findLibraryItemForPath(items, nested)?.link).toBe(root);
            expect(findLibraryItemForPath(items, path.join("nowhere", "x"))).toBeNull();
        });

        it("remaps chapter opens onto the new library root after relocate", () => {
            const oldRoot = path.join("old", "series");
            const newRoot = path.join("new", "series");
            const chapter = path.join(oldRoot, "ch01");
            expect(mapOpenPathAfterRelocate(oldRoot, newRoot, oldRoot)).toBe(newRoot);
            expect(mapOpenPathAfterRelocate(oldRoot, newRoot, chapter)).toBe(path.join(newRoot, "ch01"));
        });
    });
});
