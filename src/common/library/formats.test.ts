import { describe, expect, it } from "vitest";
import {
    formatUtils,
    hasListedExt,
    isBookFileName,
    isImageFileName,
    isMangaFileName,
    isPackedMangaFileName,
    isPdfFileName,
    OPENABLE_FILE_EXTS,
    openableFileExtLabel,
    openableFileStem,
    toDialogExtensions,
} from "./formats";

/**
 * Basename extension of `filePath` without Node (`a.PNG` -> `.PNG`).
 */
const extname = (filePath: string): string => {
    const sep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    const base = sep >= 0 ? filePath.slice(sep + 1) : filePath;
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(dot) : "";
};

/**
 * Basename of `filePath`, optionally stripping `ext` (matches `path.basename` for these tests).
 */
const basename = (filePath: string, ext?: string): string => {
    const sep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    const base = sep >= 0 ? filePath.slice(sep + 1) : filePath;
    if (ext && base.toLowerCase().endsWith(ext.toLowerCase())) return base.slice(0, -ext.length);
    return base;
};

describe("format testers", () => {
    it("detects image / packed manga / pdf / book / archive extensions via installed io", () => {
        expect(formatUtils.image.test("a.PNG")).toBe(true);
        expect(formatUtils.image.test("a.txt")).toBe(false);
        expect(formatUtils.packedManga.test("x.cbz")).toBe(true);
        expect(formatUtils.pdf.test("n.pdf")).toBe(true);
        expect(formatUtils.pdf.test("n.cbz")).toBe(false);
        expect(formatUtils.mangaFile.test("n.pdf")).toBe(true);
        expect(formatUtils.mangaFile.test("n.cbz")).toBe(true);
        expect(formatUtils.mangaFile.test("n.epub")).toBe(false);
        expect(formatUtils.book.test("n.epub")).toBe(true);
        expect(formatUtils.files.test("n.pdf")).toBe(true);
        expect(formatUtils.files.test("n.epub")).toBe(true);
        expect(formatUtils.files.test("n.html")).toBe(false);
        expect(formatUtils.files.getName("Story.cbz")).toBe("Story");
        expect(formatUtils.files.getExt("Story.epub")).toBe("EPUB");
        expect(formatUtils.dialogFilters.book()[0]?.extensions).toEqual(["epub"]);
        expect(isImageFileName("a.PNG")).toBe(true);
        expect(isMangaFileName("n.pdf")).toBe(true);
        expect(isBookFileName("n.epub")).toBe(true);
        expect(hasListedExt("", OPENABLE_FILE_EXTS)).toBe(false);
    });

    it("still accepts an explicit extname / basename override", () => {
        expect(isImageFileName("a.PNG", extname)).toBe(true);
        expect(isPackedMangaFileName("x.cbz", extname)).toBe(true);
        expect(isPdfFileName("n.pdf", extname)).toBe(true);
        expect(isMangaFileName("n.epub", extname)).toBe(false);
        expect(isBookFileName("n.html", extname)).toBe(false);
        expect(openableFileStem("Story.cbz", extname, basename)).toBe("Story");
        expect(openableFileStem("cover.jpg", extname, basename)).toBe("cover.jpg");
        expect(openableFileExtLabel("cover.jpg", extname)).toBe("");
    });

    it("builds dialog filter extensions from an ext list", () => {
        expect(toDialogExtensions([".pdf", "epub"])).toEqual(["pdf", "epub"]);
    });
});
