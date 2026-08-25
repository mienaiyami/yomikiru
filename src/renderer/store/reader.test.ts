import { configureStore } from "@reduxjs/toolkit";
import { makeMangaItem } from "@test/fixtures/libraryItem";
import { describe, expect, it } from "vitest";
import libraryReducer from "./library";
import readerReducer, { getReaderContent, setReaderState, updateReaderMangaCurrentPage } from "./reader";
import trackersReducer from "./trackers";

describe("updateReaderMangaCurrentPage", () => {
    it("updates session progress without changing the chapter open target", () => {
        const content = makeMangaItem();
        const opened = readerReducer(
            undefined,
            setReaderState({
                type: "manga",
                link: content.link,
                content,
                mangaPageNumber: content.progress?.currentPage ?? 1,
            }),
        );
        const next = readerReducer(opened, updateReaderMangaCurrentPage(8));

        expect(next.content).not.toBe(opened.content);
        expect(next.content?.progress?.currentPage).toBe(8);
        expect(next.mangaPageNumber).toBe(content.progress?.currentPage);
    });
});

describe("getReaderContent", () => {
    it("keeps the display result stable while the reader content is unchanged", () => {
        const content = makeMangaItem();
        const store = configureStore({
            reducer: { library: libraryReducer, reader: readerReducer, trackers: trackersReducer },
            preloadedState: {
                library: {
                    items: { [content.link]: content },
                    metadata: {},
                    loading: false,
                    error: null,
                },
                trackers: { entries: [], coverCacheGeneration: 0 },
            },
        });
        store.dispatch(
            setReaderState({
                type: "manga",
                link: content.link,
                content,
                mangaPageNumber: content.progress?.currentPage ?? 1,
            }),
        );
        const beforePageChange = getReaderContent(store.getState() as Parameters<typeof getReaderContent>[0]);
        store.dispatch(updateReaderMangaCurrentPage(8));
        const afterPageChange = getReaderContent(store.getState() as Parameters<typeof getReaderContent>[0]);

        expect(afterPageChange).toBe(beforePageChange);
    });
});
