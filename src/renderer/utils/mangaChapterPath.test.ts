import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    findLibraryItemKeyForOpenPath,
    MANGA_ROOT_CHAPTER_NAME,
    normalizeMangaPathSegment,
    resolveMangaChapterPath,
    resolveMangaOpenSeries,
} from "./mangaChapterPath";

describe("normalizeMangaPathSegment", () => {
    it("normalizes and strips a trailing separator", () => {
        const root = path.join("testdata", "manga", "series");
        const withSep = root + path.sep;
        expect(normalizeMangaPathSegment(withSep)).toBe(root);
        expect(normalizeMangaPathSegment(root)).toBe(root);
    });
});

describe("resolveMangaChapterPath", () => {
    it("joins itemLink and chapterName after normalizing the root", () => {
        const root = path.join("testdata", "manga", "series") + path.sep;
        expect(resolveMangaChapterPath(root, "ch1")).toBe(path.join("testdata", "manga", "series", "ch1"));
    });

    it("returns the series folder for the root-chapter token or an empty name", () => {
        const root = path.join("testdata", "manga", "oneshot");
        expect(resolveMangaChapterPath(root, MANGA_ROOT_CHAPTER_NAME)).toBe(root);
        expect(resolveMangaChapterPath(root, "")).toBe(root);
    });
});

describe("resolveMangaOpenSeries", () => {
    it("uses the opened path when it is already the library link", () => {
        const oneshot = path.join("testdata", "Oneshot");
        expect(resolveMangaOpenSeries(oneshot, oneshot)).toEqual({
            itemLink: oneshot,
            chapterName: MANGA_ROOT_CHAPTER_NAME,
        });
    });

    it("uses dirname when the opened path is a chapter under the series", () => {
        const series = path.join("testdata", "Series A");
        const chapter = path.join(series, "Ch01");
        expect(resolveMangaOpenSeries(chapter, series)).toEqual({
            itemLink: series,
            chapterName: "Ch01",
        });
    });

    it("treats a packed file as the series even without a catalogue row", () => {
        const packed = path.join("testdata", "title.cbz");
        expect(resolveMangaOpenSeries(packed, null)).toEqual({
            itemLink: packed,
            chapterName: MANGA_ROOT_CHAPTER_NAME,
        });
    });
});

describe("findLibraryItemKeyForOpenPath", () => {
    it("returns the exact path when it is in the map", () => {
        const oneshot = path.join("testdata", "Oneshot");
        const items = new Set([oneshot]);
        expect(findLibraryItemKeyForOpenPath(oneshot, (link) => items.has(link))).toBe(oneshot);
    });

    it("falls back to the parent for a chapter folder", () => {
        const series = path.join("testdata", "Series A");
        const chapter = path.join(series, "Ch01");
        const items = new Set([series]);
        expect(findLibraryItemKeyForOpenPath(chapter, (link) => items.has(link))).toBe(series);
    });

    it("does not dirname a packed file missing from the map", () => {
        const packed = path.join("testdata", "title.cbz");
        expect(findLibraryItemKeyForOpenPath(packed, () => false)).toBeNull();
    });
});
