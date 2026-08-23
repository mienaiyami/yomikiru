import path from "node:path";
import { configureStore } from "@reduxjs/toolkit";
import { makeBookItem, makeMangaItem } from "@test/fixtures/libraryItem";
import { onInvoke } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import libraryReducer, { deleteProgressForLinks, updateCurrentItemProgress } from "./library";
import readerReducer, { setReaderState, updateReaderMangaCurrentPage } from "./reader";

const mangaLink = path.join("library", "series");
const bookLink = path.join("library", "novel.epub");
const unreadLink = path.join("library", "unread");

/** Isolated library store for progress-delete thunk tests. */
const makeStore = () =>
    configureStore({
        reducer: { library: libraryReducer },
        preloadedState: {
            library: {
                items: {
                    [mangaLink]: makeMangaItem({ link: mangaLink, id: 1 }),
                    [bookLink]: makeBookItem({ link: bookLink, id: 2 }),
                    [unreadLink]: makeMangaItem({ link: unreadLink, id: 3 }, null),
                },
                metadata: {},
                loading: false,
                error: null,
            },
        },
    });

describe("deleteProgressForLinks", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("clears manga and book progress and keeps catalogue rows", async () => {
        onInvoke("db:library:deleteProgressForLinks", async ({ links }) => ({ deleted: links.length }));
        const store = makeStore();

        const result = await store.dispatch(deleteProgressForLinks({ links: [mangaLink, bookLink] })).unwrap();

        expect(result.deleted).toBe(2);
        const items = store.getState().library.items;
        expect(items[mangaLink]?.title).toBe("Test Manga");
        expect(items[mangaLink]?.progress).toBeNull();
        expect(items[bookLink]?.title).toBe("Test Book");
        expect(items[bookLink]?.progress).toBeNull();
        expect(items[unreadLink]?.progress).toBeNull();
    });

    it("is a no-op for an empty link list", async () => {
        const invoke = vi.fn(async () => ({ deleted: 0 }));
        onInvoke("db:library:deleteProgressForLinks", invoke);
        const store = makeStore();

        const result = await store.dispatch(deleteProgressForLinks({ links: [] })).unwrap();

        expect(result.deleted).toBe(0);
        expect(invoke).not.toHaveBeenCalled();
        expect(store.getState().library.items[mangaLink]?.progress).not.toBeNull();
    });

    it("dedupes links before IPC", async () => {
        const invoke = vi.fn(async ({ links }) => ({ deleted: links.length }));
        onInvoke("db:library:deleteProgressForLinks", invoke);
        const store = makeStore();

        await store.dispatch(deleteProgressForLinks({ links: [mangaLink, mangaLink] })).unwrap();

        expect(invoke).toHaveBeenCalledWith({ links: [mangaLink] });
        expect(store.getState().library.items[mangaLink]?.progress).toBeNull();
    });
});

describe("updateCurrentItemProgress", () => {
    it("persists current session progress without changing the chapter open target", async () => {
        const store = configureStore({
            reducer: { library: libraryReducer, reader: readerReducer },
        });
        const content = makeMangaItem({ link: mangaLink });
        const updateProgress = vi.fn(async (progress: NonNullable<typeof content.progress>) => progress);
        onInvoke("db:manga:updateProgress", updateProgress);

        store.dispatch(
            setReaderState({
                type: "manga",
                link: mangaLink,
                content,
                mangaPageNumber: content.progress?.currentPage ?? 1,
            }),
        );
        store.dispatch(updateReaderMangaCurrentPage(8));

        await store.dispatch(updateCurrentItemProgress()).unwrap();

        expect(store.getState().reader.content?.progress?.currentPage).toBe(8);
        expect(store.getState().reader.mangaPageNumber).toBe(content.progress?.currentPage);
        expect(updateProgress).toHaveBeenCalledWith(expect.objectContaining({ currentPage: 8 }));
    });
});
