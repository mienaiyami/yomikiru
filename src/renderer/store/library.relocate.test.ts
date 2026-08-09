import path from "node:path";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import bookmarksReducer from "./bookmarks";
import bookNotesReducer from "./bookNotes";
import libraryReducer, { relocateLibraryItem } from "./library";

describe("relocateLibraryItem fulfilled (optimistic keys)", () => {
    it("renames library, bookmark, and note maps before refetch", () => {
        const oldLink = path.join("library", "old");
        const newLink = path.join("library", "new");
        const store = configureStore({
            reducer: {
                library: libraryReducer,
                bookmarks: bookmarksReducer,
                bookNotes: bookNotesReducer,
            },
            preloadedState: {
                library: {
                    items: {
                        [oldLink]: {
                            id: 7,
                            link: oldLink,
                            title: "Series",
                            type: "manga" as const,
                            author: null,
                            cover: null,
                            createdAt: new Date(0),
                            updatedAt: new Date(0),
                            progress: {
                                itemLink: oldLink,
                                chapterName: "ch1",
                                currentPage: 2,
                                totalPages: 10,
                                chaptersRead: [],
                                lastReadAt: new Date(0),
                            },
                        },
                    },
                    loading: false,
                    error: null,
                },
                bookmarks: {
                    manga: {
                        [oldLink]: [
                            {
                                id: 1,
                                itemLink: oldLink,
                                chapterName: "ch1",
                                page: 2,
                                note: "",
                                createdAt: new Date(0),
                            },
                        ],
                    },
                    book: {},
                    loading: false,
                    error: null,
                },
                bookNotes: {
                    book: {
                        [oldLink]: [
                            {
                                id: 3,
                                itemLink: oldLink,
                                chapterId: "c1",
                                chapterName: "c1",
                                range: {
                                    startPath: "p",
                                    startOffset: 0,
                                    endPath: "p",
                                    endOffset: 1,
                                },
                                content: "n",
                                selectedText: "hi",
                                color: "#fff",
                                createdAt: new Date(0),
                                updatedAt: new Date(0),
                            },
                        ],
                    },
                    loading: false,
                    error: null,
                },
            },
        });

        store.dispatch(
            relocateLibraryItem.fulfilled(
                {
                    id: 7,
                    link: newLink,
                    title: "Series",
                    type: "manga",
                    author: null,
                    cover: null,
                    createdAt: new Date(0),
                    updatedAt: new Date(0),
                },
                "req",
                { oldLink, newLink },
            ),
        );

        const state = store.getState();
        expect(state.library.items[oldLink]).toBeUndefined();
        expect(state.library.items[newLink]?.link).toBe(newLink);
        expect(state.library.items[newLink]?.progress?.itemLink).toBe(newLink);
        expect(state.bookmarks.manga[oldLink]).toBeUndefined();
        expect(state.bookmarks.manga[newLink]?.[0]?.itemLink).toBe(newLink);
        expect(state.bookNotes.book[oldLink]).toBeUndefined();
        expect(state.bookNotes.book[newLink]?.[0]?.itemLink).toBe(newLink);
    });
});
