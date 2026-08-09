import path from "node:path";
import type { LibraryItem } from "@common/types/db";
import type { AppDispatch } from "@store/index";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import {
    doesRelocateNameMatch,
    findLibraryItemForPath,
    libraryPathDisplayName,
    mangaPageForMissingKind,
    mapOpenPathAfterRelocate,
    pickFirstMangaChapterUnderRoot,
    resolveMissingOpenPath,
    shouldOfferLibraryRelocate,
    shouldOfferMissingMangaChapterActions,
} from "./libraryMissingPath";

const noopDispatch = vi.fn() as unknown as AppDispatch;
const okBox = (response: number) => ({ response, checkboxChecked: false });

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

const bookItem = (link: string): LibraryItem =>
    ({
        ...mangaItem(link),
        type: "book",
        title: "Novel",
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

    describe("shouldOfferLibraryRelocate / shouldOfferMissingMangaChapterActions", () => {
        it("offers relocate only when the library root path is missing", () => {
            const root = path.join("library", "series");
            stubFs({
                existsSync: (p: string) => p !== root,
                isDir: () => true,
            });
            expect(shouldOfferLibraryRelocate(root)).toBe(true);
            expect(shouldOfferMissingMangaChapterActions(mangaItem(root), path.join(root, "ch01"))).toBe(false);
        });

        it("offers manga chapter actions only when the series folder exists and open path is a child", () => {
            const root = path.join("library", "series");
            stubFs({
                existsSync: () => true,
                isDir: (p: string) => p === root,
            });
            expect(shouldOfferLibraryRelocate(root)).toBe(false);
            expect(shouldOfferMissingMangaChapterActions(mangaItem(root), path.join(root, "ch01"))).toBe(true);
            expect(shouldOfferMissingMangaChapterActions(mangaItem(root), root)).toBe(false);
            expect(shouldOfferMissingMangaChapterActions(bookItem(path.join("library", "a.epub")), root)).toBe(
                false,
            );
        });
    });

    describe("pickFirstMangaChapterUnderRoot", () => {
        it("never returns the series root even when it has cover images", async () => {
            const root = path.join("library", "series");
            const ch01 = path.join(root, "ch01");
            stubFs({
                existsSync: (p: string) => [root, ch01, path.join(root, "cover.jpg")].includes(p) || p === root,
                isDir: (p: string) => p === root || p === ch01,
                readdir: async (dir: string) => {
                    if (dir === root) return ["cover.jpg", "ch01"];
                    if (dir === ch01) return ["page.png"];
                    return [];
                },
            });
            await expect(pickFirstMangaChapterUnderRoot(root)).resolves.toBe(ch01);
        });

        it("returns the first listable chapter folder and skips empty dirs", async () => {
            const root = path.join("library", "series");
            const ch01 = path.join(root, "ch01");
            const ch02 = path.join(root, "ch02");
            const empty = path.join(root, "empty");
            stubFs({
                existsSync: (p: string) => [root, ch01, ch02, empty].includes(p),
                isDir: (p: string) => [root, ch01, ch02, empty].includes(p),
                readdir: async (dir: string) => {
                    if (dir === root) return ["empty", "ch02", "ch01"];
                    if (dir === ch01 || dir === ch02) return ["page.png"];
                    if (dir === empty) return [];
                    return [];
                },
            });
            await expect(pickFirstMangaChapterUnderRoot(root)).resolves.toBe(ch01);
        });

        it("returns null when only cover art remains at the series root", async () => {
            const root = path.join("library", "series");
            stubFs({
                existsSync: (p: string) => p === root,
                isDir: (p: string) => p === root,
                readdir: async () => ["cover.jpg", "notes.txt"],
            });
            await expect(pickFirstMangaChapterUnderRoot(root)).resolves.toBeNull();
        });
    });

    describe("mangaPageForMissingKind", () => {
        it("starts open-first at page 0 and keeps bookmark page for locate chapter", () => {
            expect(mangaPageForMissingKind("openFirstChapter", 12)).toBe(0);
            expect(mangaPageForMissingKind("locateChapter", 12)).toBe(12);
            expect(mangaPageForMissingKind("locateChapter")).toBe(0);
            expect(mangaPageForMissingKind("relocate", 12)).toBeUndefined();
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

    /**
     * Flow tests: stub dialog IPC + fs, assert resolveMissingOpenPath glue
     * (kind, callbacks). Prefer this over Playwright for native dialogs.
     */
    describe("resolveMissingOpenPath (chapter miss flows)", () => {
        const root = path.join("library", "series");
        const missingChapter = path.join(root, "gone");
        const ch01 = path.join(root, "ch01");
        const ch02 = path.join(root, "ch02");

        /** Series root exists with ch01/ch02; missingChapter does not. */
        const stubSeriesWithChapters = () => {
            stubFs({
                existsSync: (p: string) => p === root || p === ch01 || p === ch02,
                isDir: (p: string) => p === root || p === ch01 || p === ch02,
                readdir: async (dir: string) => {
                    if (dir === root) return ["ch02", "ch01"];
                    if (dir === ch01 || dir === ch02) return ["page.png"];
                    return [];
                },
            });
        };

        it("open first chapter returns first chapter and skips onLocateChapter", async () => {
            stubSeriesWithChapters();
            onInvoke("dialog:confirm", async () => okBox(0));
            const onLocateChapter = vi.fn();

            const resolved = await resolveMissingOpenPath(noopDispatch, missingChapter, {
                libraryItem: mangaItem(root),
                offerLocate: false,
                offerRemove: false,
                onLocateChapter,
            });

            expect(resolved).toEqual({ openPath: ch01, kind: "openFirstChapter" });
            expect(onLocateChapter).not.toHaveBeenCalled();
            expect(resolved && mangaPageForMissingKind(resolved.kind, 9)).toBe(0);
        });

        it("locate chapter picks a path and calls onLocateChapter", async () => {
            stubSeriesWithChapters();
            /* buttons: Open first, Locate chapter, Cancel -> response 1 */
            onInvoke("dialog:confirm", async () => okBox(1));
            onInvoke("dialog:showOpenDialog", async () => ({
                canceled: false,
                filePaths: [ch02],
            }));
            const onLocateChapter = vi.fn(async () => undefined);

            const resolved = await resolveMissingOpenPath(noopDispatch, missingChapter, {
                libraryItem: mangaItem(root),
                offerLocate: false,
                offerRemove: false,
                onLocateChapter,
            });

            expect(resolved).toEqual({ openPath: ch02, kind: "locateChapter" });
            expect(onLocateChapter).toHaveBeenCalledWith(ch02);
            expect(resolved && mangaPageForMissingKind(resolved.kind, 9)).toBe(9);
        });

        it("does not offer chapter actions when the library root is missing", async () => {
            stubFs({
                existsSync: () => false,
                isDir: () => false,
            });
            onInvoke("dialog:confirm", async (req) => {
                /* locate-root dialog: Locate on disk, Cancel (no remove) */
                expect(req.buttons?.length).toBe(2);
                return okBox(1);
            });

            const resolved = await resolveMissingOpenPath(noopDispatch, missingChapter, {
                libraryItem: mangaItem(root),
                offerLocate: true,
                offerRemove: false,
            });
            expect(resolved).toBeNull();
        });

        it("aborts when onLocateChapter throws", async () => {
            stubSeriesWithChapters();
            onInvoke("dialog:confirm", async () => okBox(1));
            onInvoke("dialog:showOpenDialog", async () => ({
                canceled: false,
                filePaths: [ch02],
            }));
            onInvoke("dialog:error", async () => okBox(0));

            const resolved = await resolveMissingOpenPath(noopDispatch, missingChapter, {
                libraryItem: mangaItem(root),
                offerLocate: false,
                offerRemove: false,
                onLocateChapter: async () => {
                    throw new Error("bookmark conflict");
                },
            });
            expect(resolved).toBeNull();
        });
    });
});
