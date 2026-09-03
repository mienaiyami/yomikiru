import path from "node:path";
import type { BookProgress, LibraryItem, MangaProgress } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import store, { type AppDispatch, rootReducer } from "@store/index";
import { setLibrary } from "@store/library";
import { makeBookItem } from "@test/fixtures/libraryItem";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import {
    chaptersReadForOpenedManga,
    doesRelocateNameMatch,
    findLibraryItemForPath,
    findMissingSameNameCandidates,
    libraryPathDisplayName,
    mangaPageForMissingKind,
    mapOpenPathAfterRelocate,
    maybeRelocateMissingSameNameOnOpen,
    pickFirstMangaChapterUnderRoot,
    resolveMissingOpenPath,
    shouldOfferLibraryRelocate,
    shouldOfferMissingMangaChapterActions,
    syncBookLibraryOnReaderOpen,
    syncMangaLibraryOnReaderOpen,
} from "./libraryMissingPath";
import { MANGA_ROOT_CHAPTER_NAME } from "./mangaChapterPath";

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
            const mangaDir = path.join("library", "manga-folder");
            const mangaArchive = path.join("library", "manga-archive.cbz");
            const bookFile = path.join("library", "Novel.epub");
            expect(libraryPathDisplayName(mangaDir, "manga")).toBe("manga-folder");
            expect(libraryPathDisplayName(mangaArchive, "manga")).toBe("manga-archive");
            expect(libraryPathDisplayName(bookFile, "book")).toBe("Novel");
        });

        it("matches on previous basename or library title", () => {
            const oldLink = path.join("old", "series-root");
            const sameName = path.join("new", "series-root");
            const titleOnly = path.join("new", "Custom Title");
            const mismatch = path.join("new", "Other");

            expect(doesRelocateNameMatch(oldLink, sameName, "Anything", "manga")).toBe(true);
            expect(doesRelocateNameMatch(oldLink, titleOnly, "Custom Title", "manga")).toBe(true);
            expect(doesRelocateNameMatch(oldLink, mismatch, "series-root", "manga")).toBe(false);
        });

        it("matches folder title to archive stem", () => {
            const oldDir = path.join("old", "series-root");
            const newArchive = path.join("new", "series-root.cbz");
            expect(doesRelocateNameMatch(oldDir, newArchive, "Other Title", "manga")).toBe(true);
        });
    });

    describe("findMissingSameNameCandidates", () => {
        it("returns missing same-name rows only, not live paths or other types", () => {
            const missing = path.join("old", "series-root");
            const live = path.join("live", "series-root");
            const otherType = path.join("old", "series-root.epub");
            const target = path.join("new", "series-root");
            stubFs({
                existsSync: (p: string) => p === live || p === target,
            });
            const items = {
                [missing]: mangaItem(missing),
                [live]: mangaItem(live),
                [otherType]: bookItem(otherType),
            };
            const found = findMissingSameNameCandidates(items, target, "manga");
            expect(found.map((i) => i.link)).toEqual([missing]);
        });

        it("returns no candidates when the new path is already the only row", () => {
            const target = path.join("new", "series-root");
            stubFs({ existsSync: () => true });
            expect(findMissingSameNameCandidates({ [target]: mangaItem(target) }, target, "manga")).toEqual([]);
        });

        it("matches missing books by file stem", () => {
            const missing = path.join("old", "Novel.epub");
            const target = path.join("new", "Novel.epub");
            stubFs({ existsSync: (p: string) => p === target });
            const found = findMissingSameNameCandidates({ [missing]: bookItem(missing) }, target, "book");
            expect(found.map((i) => i.link)).toEqual([missing]);
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

        /**
         * A book file next to chapter folders is not a readable manga chapter.
         */
        it("skips EPUB files sitting beside manga chapters", async () => {
            const root = path.join("library", "series");
            const epub = path.join(root, "bonus.epub");
            const ch01 = path.join(root, "ch01");
            stubFs({
                existsSync: (p: string) => [root, epub, ch01].includes(p),
                isDir: (p: string) => p === root || p === ch01,
                readdir: async (dir: string) => {
                    if (dir === root) return ["bonus.epub", "ch01"];
                    if (dir === ch01) return ["page.png"];
                    return [];
                },
            });
            await expect(pickFirstMangaChapterUnderRoot(root)).resolves.toBe(ch01);
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

    describe("chaptersReadForOpenedManga", () => {
        it("does not store the root-chapter token", () => {
            expect(chaptersReadForOpenedManga(["ch1"], MANGA_ROOT_CHAPTER_NAME)).toEqual(["ch1"]);
            expect(chaptersReadForOpenedManga(["ch1"], "")).toEqual(["ch1"]);
        });

        it("appends a child chapter name", () => {
            expect(chaptersReadForOpenedManga(["ch1"], "ch2")).toEqual(["ch1", "ch2"]);
        });
    });

    describe("maybeRelocateMissingSameNameOnOpen", () => {
        /** Store with library slice so relocate IPC can run through the thunk. */
        const makeStore = () =>
            configureStore({
                reducer: rootReducer,
                middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
            });

        it("relocates one missing same-name book when confirmed", async () => {
            const oldLink = path.join("old", "Novel.epub");
            const newLink = path.join("new", "Novel.epub");
            stubFs({ existsSync: (p: string) => p === newLink });
            const missing = bookItem(oldLink);
            const store = makeStore();
            onInvoke("dialog:confirm", async () => okBox(0));
            onInvoke("db:library:relocateItem", async () => ({ ...missing, link: newLink }));

            const result = await maybeRelocateMissingSameNameOnOpen(
                store.dispatch,
                { [oldLink]: missing },
                newLink,
                "book",
            );
            expect(result?.link).toBe(newLink);
        });

        it("does not relocate when the user cancels", async () => {
            const oldLink = path.join("old", "Novel.epub");
            const newLink = path.join("new", "Novel.epub");
            stubFs({ existsSync: (p: string) => p === newLink });
            const relocate = vi.fn();
            onInvoke("dialog:confirm", async () => okBox(1));
            onInvoke("db:library:relocateItem", relocate);

            const result = await maybeRelocateMissingSameNameOnOpen(
                noopDispatch,
                { [oldLink]: bookItem(oldLink) },
                newLink,
                "book",
            );
            expect(result).toBeNull();
            expect(relocate).not.toHaveBeenCalled();
        });

        it("warns then skips relocate when several missing books share the name", async () => {
            const first = path.join("old", "a", "Novel.epub");
            const second = path.join("old", "b", "Novel.epub");
            const newLink = path.join("new", "Novel.epub");
            stubFs({ existsSync: (p: string) => p === newLink });
            const warn = vi.fn(async () => okBox(0));
            const relocate = vi.fn();
            onInvoke("dialog:warn", warn);
            onInvoke("db:library:relocateItem", relocate);

            const result = await maybeRelocateMissingSameNameOnOpen(
                noopDispatch,
                {
                    [first]: bookItem(first),
                    [second]: { ...bookItem(second), id: 2 },
                },
                newLink,
                "book",
            );
            expect(result).toBeNull();
            expect(warn).toHaveBeenCalled();
            expect(relocate).not.toHaveBeenCalled();
        });

        it("returns null without a dialog when nothing matches", async () => {
            const newLink = path.join("new", "Novel.epub");
            stubFs({ existsSync: () => true });
            const confirm = vi.fn();
            onInvoke("dialog:confirm", confirm);

            const result = await maybeRelocateMissingSameNameOnOpen(noopDispatch, {}, newLink, "book");
            expect(result).toBeNull();
            expect(confirm).not.toHaveBeenCalled();
        });
    });

    describe("syncMangaLibraryOnReaderOpen", () => {
        /** Store with library slice so archive-row repair uses the relocation thunk. */
        const makeStore = () =>
            configureStore({
                reducer: rootReducer,
                middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
            });

        it("rekeys a scanned archive row to its parent before saving chapter progress", async () => {
            const series = path.join("library", "series-root");
            const archive = path.join(series, "chapter-01.cbz");
            const archiveProgress: MangaProgress = {
                itemLink: archive,
                chapterName: MANGA_ROOT_CHAPTER_NAME,
                currentPage: 3,
                totalPages: 20,
                chaptersRead: [],
                lastReadAt: new Date("2024-06-01T00:00:00.000Z"),
            };
            const archiveItem = { ...mangaItem(archive), progress: archiveProgress };
            let relocatedArgs: { oldLink: string; newLink: string } | null = null;
            let savedProgress: MangaProgress | null = null;
            onInvoke("db:library:relocateItem", async (args) => {
                relocatedArgs = args;
                return { ...archiveItem, link: series };
            });
            onInvoke("db:library:addItem", async (args) => ({
                ...archiveItem,
                link: args.data.link,
                title: args.data.title,
            }));
            onInvoke("db:manga:updateProgress", async (args) => {
                savedProgress = args;
                return args;
            });

            await syncMangaLibraryOnReaderOpen({
                dispatch: makeStore().dispatch,
                openedPath: archive,
                libraryItem: archiveItem,
                images: ["data:image/png;base64,page"],
                currentPage: 4,
            });

            expect(relocatedArgs).toEqual({ oldLink: archive, newLink: series });
            expect(savedProgress).toMatchObject({
                itemLink: series,
                chapterName: "chapter-01.cbz",
                currentPage: 4,
            });
        });

        it("keeps an occupied parent series instead of merging archive metadata into it", async () => {
            const series = path.join("library", "series-root");
            const archive = path.join(series, "chapter-01.cbz");
            const parentItem = { ...mangaItem(series), title: "Parent title", progress: null };
            const archiveItem = { ...mangaItem(archive), title: "Archive title", progress: null };
            const relocate = vi.fn();
            let addedRequest: { data: { link: string }; progress: { chapterName: string } } | null = null;
            onInvoke("db:library:relocateItem", relocate);
            onInvoke("db:library:addItem", async (args) => {
                addedRequest = args;
                return parentItem;
            });
            store.dispatch(setLibrary({ [series]: parentItem }));

            try {
                await syncMangaLibraryOnReaderOpen({
                    dispatch: makeStore().dispatch,
                    openedPath: archive,
                    libraryItem: archiveItem,
                    images: ["data:image/png;base64,page"],
                    currentPage: 4,
                });

                expect(relocate).not.toHaveBeenCalled();
                expect(addedRequest).toMatchObject({
                    data: { link: series },
                    progress: { chapterName: "chapter-01.cbz" },
                });
            } finally {
                store.dispatch(setLibrary({}));
            }
        });
    });

    describe("syncBookLibraryOnReaderOpen", () => {
        /** Store with library slice so add/update/progress thunks can run. */
        const makeStore = () =>
            configureStore({
                reducer: rootReducer,
                middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
            });

        const openedProgress = (link: string): BookProgress => ({
            chapterId: "chap-1",
            chapterName: "Chapter 1",
            position: "",
            itemLink: link,
            lastReadAt: new Date("2024-06-01T00:00:00.000Z"),
        });

        /** IPC `library_items` row without the progress join. */
        const libraryRowFromBook = (item: ReturnType<typeof makeBookItem>): LibraryItem => {
            const { progress: _progress, ...row } = item;
            return row;
        };

        it("updates an existing book without re-adding it", async () => {
            const link = path.join("library", "Novel.epub");
            const libraryItem = makeBookItem({ link, title: "Old" });
            let added = false;
            let updated = false;
            let progressWritten = false;
            onInvoke("db:library:addItem", async () => {
                added = true;
                return libraryRowFromBook(libraryItem);
            });
            onInvoke("db:library:updateItem", async (req) => {
                updated = true;
                return libraryRowFromBook(makeBookItem({ link: req.link, title: req.title, author: req.author }));
            });
            onInvoke("db:book:updateProgress", async (req) => {
                progressWritten = true;
                return req;
            });

            await syncBookLibraryOnReaderOpen({
                dispatch: makeStore().dispatch,
                openedPath: link,
                libraryItem,
                progress: openedProgress(link),
                title: "From Epub",
                author: "A",
                coverAbsolutePath: null,
            });

            expect(added).toBe(false);
            expect(updated).toBe(true);
            expect(progressWritten).toBe(false);
        });

        it("writes progress when the opened position is non-empty", async () => {
            const link = path.join("library", "Novel.epub");
            const libraryItem = makeBookItem({ link, title: "Old" });
            let progressWritten = false;
            onInvoke("db:library:addItem", async () => libraryRowFromBook(libraryItem));
            onInvoke("db:library:updateItem", async (req) =>
                libraryRowFromBook(makeBookItem({ link: req.link, title: req.title, author: req.author })),
            );
            onInvoke("db:book:updateProgress", async (req) => {
                progressWritten = true;
                return req;
            });

            await syncBookLibraryOnReaderOpen({
                dispatch: makeStore().dispatch,
                openedPath: link,
                libraryItem,
                progress: { ...openedProgress(link), position: "body>p:nth-child(9)" },
                title: "From Epub",
                author: "A",
                coverAbsolutePath: null,
            });

            expect(progressWritten).toBe(true);
        });

        it("adds a book when no missing same-name row exists", async () => {
            const link = path.join("new", "Novel.epub");
            stubFs({ existsSync: () => true, isFile: () => false });
            let addedLink: string | null = null;
            onInvoke("db:library:addItem", async (req) => {
                addedLink = req.data.link;
                return libraryRowFromBook(makeBookItem({ ...req.data, id: 9, link: req.data.link }));
            });

            await syncBookLibraryOnReaderOpen({
                dispatch: makeStore().dispatch,
                openedPath: link,
                libraryItem: null,
                progress: openedProgress(link),
                title: "From Epub",
                author: "A",
                coverAbsolutePath: null,
            });

            expect(addedLink).toBe(link);
        });

        it("materializes a cover after add when the extract path is a file", async () => {
            const link = path.join("new", "Novel.epub");
            const cover = path.join("tmp", "cover.jpg");
            stubFs({
                existsSync: (p: string) => p === link || p === cover,
                isFile: (p: string) => p === cover,
            });
            onInvoke("db:library:addItem", async (req) =>
                libraryRowFromBook(makeBookItem({ ...req.data, id: 9, link: req.data.link })),
            );
            let materializeArg: { libraryId: number; sourceAbsolutePath: string } | null = null;
            onInvoke("covers:materialize", async (req) => {
                materializeArg = req;
                return { ok: true };
            });
            onInvoke("db:library:getAllAndProgress", async () => []);

            await syncBookLibraryOnReaderOpen({
                dispatch: makeStore().dispatch,
                openedPath: link,
                libraryItem: null,
                progress: openedProgress(link),
                title: "From Epub",
                author: "A",
                coverAbsolutePath: cover,
            });

            expect(materializeArg).toEqual({ libraryId: 9, sourceAbsolutePath: cover });
        });
    });
});
