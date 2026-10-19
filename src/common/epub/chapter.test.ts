import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    findSpineIndexByHref,
    isExternalEpubReference,
    resolveEpubChapterReference,
    stripEpubInlineEventHandlers,
} from "./chapter";

describe("EPUB chapter references", () => {
    it("keeps web and fragment references while resolving package-relative paths", () => {
        const chapter = path.join("book", "Text", "chapter.xhtml");
        expect(isExternalEpubReference("HTTPS://example.test/page")).toBe(true);
        expect(resolveEpubChapterReference("#note", chapter, path)).toBe("#note");
        expect(resolveEpubChapterReference("https://example.test/image.jpg", chapter, path)).toBe(
            "https://example.test/image.jpg",
        );
        expect(resolveEpubChapterReference("../Images/page.jpg", chapter, path)).toBe(
            path.join("book", "Images", "page.jpg"),
        );
    });

    it("removes quoted and unquoted inline event handlers without truncating nearby markup", () => {
        const markup = `<p class="safe" onclick="run with spaces()" onfocus='focus()'>Text</p><img onload=load() src="a.jpg">`;
        expect(stripEpubInlineEventHandlers(markup)).toBe(`<p class="safe">Text</p><img src="a.jpg">`);
    });

    it("maps package hrefs to spine index and treats fragment-only as current chapter", () => {
        const spine = [{ href: path.join("book", "a.xhtml") }, { href: path.join("book", "b.xhtml") }];
        expect(findSpineIndexByHref(spine, `${spine[1].href}#note`)).toBe(1);
        expect(findSpineIndexByHref(spine, "#note")).toBe(-1);
        expect(findSpineIndexByHref(spine, "missing.xhtml")).toBe(-1);
    });
});
