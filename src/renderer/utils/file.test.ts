import path from "node:path";
import { onInvoke } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import { fileSrcToImagePath, formatUtils, makeFileSafe, promptSelectDir, unzip } from "./file";

describe("formatUtils", () => {
    it("detects image / packed manga / book / archive extensions", () => {
        expect(formatUtils.image.test("a.PNG")).toBe(true);
        expect(formatUtils.image.test("a.txt")).toBe(false);
        expect(formatUtils.packedManga.test("x.cbz")).toBe(true);
        expect(formatUtils.book.test("n.epub")).toBe(true);
        expect(formatUtils.files.test("n.pdf")).toBe(true);
        expect(formatUtils.files.test("")).toBe(false);
    });

    it("getName / getExt only strip known archive-like extensions", () => {
        expect(formatUtils.files.getName("Story.cbz")).toBe("Story");
        expect(formatUtils.files.getName("cover.jpg")).toBe("cover.jpg");
        expect(formatUtils.files.getExt("Story.epub")).toBe("EPUB");
        expect(formatUtils.files.getExt("cover.jpg")).toBe("");
    });
});

describe("makeFileSafe", () => {
    it("strips filesystem-forbidden characters", () => {
        expect(makeFileSafe("a:b\\c/d|e<f>g*h?i")).toBe("abcdefghi");
    });
});

describe("fileSrcToImagePath", () => {
    it("strips file:// and decodes %23", () => {
        expect(fileSrcToImagePath("file:///tmp/a%23b.png")).toBe("/tmp/a#b.png");
    });

    it("strips a leading slash before a Windows drive letter", () => {
        expect(fileSrcToImagePath("file:///C:/manga/cover.png")).toBe("C:/manga/cover.png");
    });
});

describe("promptSelectDir / unzip", () => {
    it("invokes showOpenDialog and calls back with the first path", async () => {
        const chosen = path.join("testdata", "picked");
        onInvoke("dialog:showOpenDialog", async () => ({
            canceled: false,
            filePaths: [chosen],
        }));
        const cb = vi.fn();
        await promptSelectDir(cb, false);
        expect(cb).toHaveBeenCalledWith(path.normalize(chosen));
    });

    it("no-ops when the dialog is canceled", async () => {
        onInvoke("dialog:showOpenDialog", async () => ({
            canceled: true,
            filePaths: [],
        }));
        const cb = vi.fn();
        await promptSelectDir(cb);
        expect(cb).not.toHaveBeenCalled();
    });

    it("forwards unzip to fs:unzip", async () => {
        onInvoke("fs:unzip", async (req) => ({
            ok: true as const,
            source: req.source,
            destination: req.destination,
        }));
        const src = path.join("a", "b.cbz");
        const dest = path.join("out", "b");
        await expect(unzip(src, dest)).resolves.toEqual({
            ok: true,
            source: src,
            destination: dest,
        });
    });
});
