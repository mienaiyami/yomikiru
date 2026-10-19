import path from "node:path";
import type { BookProgress, LibraryItemWithProgress, MangaProgress } from "@common/types/db";

/** Cross-platform sample manga library root (`path.join`, not win32-only strings). */
export const SAMPLE_MANGA_LINK = path.join("testdata", "manga", "series");

/** Cross-platform sample book library path. */
export const SAMPLE_BOOK_LINK = path.join("testdata", "books", "novel.epub");

const baseDates = {
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
};

/**
 * Minimal manga library row for unit tests.
 * Pass `progress: null` for no progress; omit or pass a partial to merge defaults.
 */
export const makeMangaItem = (
    overrides: Partial<Omit<Extract<LibraryItemWithProgress, { type: "manga" }>, "type" | "progress">> = {},
    progress: Partial<MangaProgress> | null = {},
): LibraryItemWithProgress => {
    const link = overrides.link ?? SAMPLE_MANGA_LINK;
    return {
        id: 1,
        title: "Test Manga",
        author: null,
        cover: null,
        favouritedAt: null,
        note: null,
        extra: {},
        ...baseDates,
        ...overrides,
        type: "manga",
        link,
        progress:
            progress === null
                ? null
                : {
                      itemLink: link,
                      chapterName: "ch1",
                      currentPage: 3,
                      chaptersRead: [],
                      totalPages: 20,
                      lastReadAt: new Date("2024-01-03T00:00:00.000Z"),
                      ...progress,
                  },
    };
};

/**
 * Minimal book library row for unit tests.
 * Pass `progress: null` for no progress; omit or pass a partial to merge defaults.
 */
export const makeBookItem = (
    overrides: Partial<Omit<Extract<LibraryItemWithProgress, { type: "book" }>, "type" | "progress">> = {},
    progress: Partial<BookProgress> | null = {},
): LibraryItemWithProgress => {
    const link = overrides.link ?? SAMPLE_BOOK_LINK;
    return {
        id: 2,
        title: "Test Book",
        author: null,
        cover: null,
        favouritedAt: null,
        note: null,
        extra: {},
        ...baseDates,
        ...overrides,
        type: "book",
        link,
        progress:
            progress === null
                ? null
                : {
                      itemLink: link,
                      chapterId: "chap-1",
                      chapterName: "Chapter 1",
                      position: "body>p:nth-child(1)",
                      lastReadAt: new Date("2024-01-03T00:00:00.000Z"),
                      ...progress,
                  },
    };
};
