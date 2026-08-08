import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeMangaPathSegment, resolveMangaChapterPath } from "./mangaChapterPath";

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
});
