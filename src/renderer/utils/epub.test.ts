import path from "node:path";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import { extractEpub, parseEpubChapter, readEpubChapter } from "./epub";

describe("extractEpub", () => {
    it("reports a structured unzip failure instead of treating it as a successful extraction", async () => {
        const showError = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("fs:unzip", async () => ({ ok: false, message: "archive is corrupt" }));
        onInvoke("dialog:error", showError);

        await expect(extractEpub("book.epub", "extracted-book", false)).resolves.toBe(false);
        expect(showError).toHaveBeenCalledWith(
            expect.objectContaining({ detail: expect.stringContaining("archive is corrupt") }),
        );
    });
});

describe("parseEpubChapter", () => {
    it("rewrites package references and removes executable chapter markup", () => {
        const chapterPath = path.join("book", "Text", "chapter.xhtml");
        const markup = parseEpubChapter(
            `<html xmlns="http://www.w3.org/1999/xhtml">
                <body onload="run with spaces()">
                    <script>unsafe()</script>
                    <img id="page" src="../Images/page.jpg" onclick="unsafe()" />
                    <a id="note" href="#footnote">Note</a>
                    <a href="HTTPS://example.test/info">Web</a>
                </body>
            </html>`,
            chapterPath,
        );
        const container = document.createElement("div");
        container.innerHTML = markup;

        const image = container.querySelector("img");
        expect(image?.getAttribute("src")).toBe(path.join("book", "Images", "page.jpg"));
        expect(image?.getAttribute("data-original-src")).toBe("../Images/page.jpg");
        expect(image?.hasAttribute("onclick")).toBe(false);
        expect(image?.getAttribute("data-epub-id")).toBe("page");
        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("[onload]")).toBeNull();
        expect(container.querySelector("a[data-epub-id='note']")?.getAttribute("data-href")).toBe("#footnote");
        expect(container.querySelectorAll("a")[1]?.getAttribute("data-href")).toBe("HTTPS://example.test/info");
    });

    it("rewrites SVG image href without treating it as a navigation link", () => {
        const chapterPath = path.join("book", "Text", "art.svg");
        const markup = parseEpubChapter(
            `<svg xmlns="http://www.w3.org/2000/svg"><image href="../Images/page.jpg" /></svg>`,
            chapterPath,
        );
        const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
        const image = parsed.querySelector("image");
        expect(image?.getAttribute("href")).toBe(path.join("book", "Images", "page.jpg"));
        expect(image?.getAttribute("data-src")).toBe(path.join("book", "Images", "page.jpg"));
        expect(image?.hasAttribute("data-href")).toBe(false);
    });
});

describe("readEpubChapter", () => {
    it("escapes filesystem error text in the localized reader recovery markup", async () => {
        const chapterPath = path.join("book", "Text", "missing.xhtml");
        stubFs({
            existsSync: () => true,
            readFile: async () => {
                throw new Error("<img src=x onerror=unsafe()>");
            },
        });
        const markup = await readEpubChapter(chapterPath);
        const container = document.createElement("div");
        container.innerHTML = markup;
        expect(container.querySelector("code")?.textContent).toContain("<img src=x onerror=unsafe()>");
        expect(container.querySelector("code img")).toBeNull();
    });
});
