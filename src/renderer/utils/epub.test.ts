import path from "node:path";
import { inChapterFractionFromLayout } from "@common/epub";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import {
    chapterIdFromHtmlCont,
    extractEpub,
    highlightNthFindMatch,
    inChapterFractionFromSpineRow,
    parseEpubChapter,
    queryEpubPosition,
    readEpubChapter,
    scrollYOfElement,
    settleEpubScroll,
    spineFileWeights,
    spineIndexFromSpineRow,
    spineRowAtReaderTop,
    waitForEpubChapterRoot,
} from "./epub";

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

describe("highlightNthFindMatch", () => {
    it("marks the nth substring without replacing the chapter innerHTML", () => {
        const root = document.createElement("div");
        const paragraph = document.createElement("p");
        paragraph.textContent = "alpha beta alpha";
        const link = document.createElement("a");
        let clicks = 0;
        link.addEventListener("click", () => {
            clicks += 1;
        });
        link.textContent = "gamma";
        root.append(paragraph, link);
        const first = highlightNthFindMatch(root, "alpha", 0);
        expect(first?.classList.contains("current")).toBe(true);
        expect(root.querySelectorAll(".findInPage-highlight")).toHaveLength(2);
        highlightNthFindMatch(root, "alpha", 1);
        expect(root.querySelectorAll(".findInPage-highlight.current")).toHaveLength(1);
        (root.querySelector("a") as HTMLAnchorElement).click();
        expect(clicks).toBe(1);
    });

    it("treats regex metacharacters as literal substring text", () => {
        const root = document.createElement("div");
        root.textContent = "cost is $5 (approx)";
        const mark = highlightNthFindMatch(root, "$5 (", 0);
        expect(mark?.textContent).toBe("$5 (");
    });
});

describe("spineFileWeights", () => {
    it("normalizes missing files to a positive weight", async () => {
        stubFs({
            existsSync: () => false,
        });
        const weights = await spineFileWeights(["missing.xhtml"]);
        expect(weights[0]).toBeGreaterThan(0);
    });
});

describe("queryEpubPosition", () => {
    it("resolves a path scoped to the chapter root and ignores the same selector in a sibling", () => {
        document.body.innerHTML = `
            <div id="epub-a"><p class="hit">one</p></div>
            <div id="epub-b"><p class="hit">two</p></div>
        `;
        const rootA = document.getElementById("epub-a");
        expect(rootA).toBeTruthy();
        expect(queryEpubPosition(rootA!, "p.hit")?.textContent).toBe("one");
    });

    it("supports both legacy document selectors and scoped selectors without crossing chapters", () => {
        const chapter = document.getElementById("epub-a") ?? document.createElement("div");
        chapter.id = "epub-a";
        chapter.innerHTML = '<p class="hit">one</p>';
        document.body.append(chapter);
        expect(queryEpubPosition(chapter, "div#epub-a > p.hit")?.textContent).toBe("one");
        expect(queryEpubPosition(chapter, "div#epub-a")).toBe(chapter);
        expect(queryEpubPosition(chapter, "div#epub-b > p.hit")).toBeNull();
        expect(queryEpubPosition(chapter, "invalid[")).toBeNull();
    });
});

describe("settleEpubScroll", () => {
    it("keeps the restored paragraph in place when a later frame measures a preceding chapter", async () => {
        const reader = document.createElement("div");
        const chapter = document.createElement("div");
        chapter.id = "epub-ch";
        const target = document.createElement("p");
        chapter.appendChild(target);
        reader.appendChild(chapter);
        document.body.appendChild(reader);
        reader.scrollTop = 0;
        reader.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
        let targetContentY = 80;
        // model real scrolling: the target immediately reaches the top before the next layout pass
        target.getBoundingClientRect = () => ({ top: 100 + targetContentY - reader.scrollTop }) as DOMRect;
        let waitCount = 0;
        const applied = await settleEpubScroll(reader, () => scrollYOfElement(reader, target), {
            waitFrame: async () => {
                waitCount += 1;
                if (waitCount === 1) targetContentY += 240;
            },
        });
        expect(applied).toBe(true);
        expect(waitCount).toBeGreaterThanOrEqual(2);
        expect(reader.scrollTop).toBe(320);
        expect(target.getBoundingClientRect().top).toBe(100);
        reader.remove();
    });
});

describe("waitForEpubChapterRoot", () => {
    it("waits for completed injection even when the chapter is empty, and cancels obsolete waits", async () => {
        const reader = document.createElement("div");
        document.body.append(reader);
        const navigation = new AbortController();
        const chapterReady = waitForEpubChapterRoot(reader, "empty", navigation.signal);
        const chapter = document.createElement("div");
        chapter.id = "epub-empty";
        chapter.dataset.epubReady = "true";
        reader.append(chapter);
        await expect(chapterReady).resolves.toBe(chapter);

        const obsoleteNavigation = new AbortController();
        const obsoleteChapter = waitForEpubChapterRoot(reader, "missing", obsoleteNavigation.signal);
        obsoleteNavigation.abort();
        await expect(obsoleteChapter).resolves.toBeNull();
        reader.remove();
    });
});

describe("continuous spine row geometry", () => {
    it("parses chapter id and data-index from mounted nodes", () => {
        const htmlCont = document.createElement("div");
        htmlCont.id = "epub-ch-12";
        htmlCont.className = "htmlCont";
        expect(chapterIdFromHtmlCont(htmlCont)).toBe("ch-12");
        const row = document.createElement("div");
        row.setAttribute("data-index", "4");
        expect(spineIndexFromSpineRow(row)).toBe(4);
        expect(spineIndexFromSpineRow(document.createElement("div"))).toBeNull();
    });

    it("picks the row whose box contains the reader top", () => {
        const reader = document.createElement("div");
        const above = document.createElement("div");
        above.className = "epubSpineItem";
        const occupying = document.createElement("div");
        occupying.className = "epubSpineItem";
        occupying.setAttribute("data-index", "1");
        reader.append(above, occupying);
        document.body.appendChild(reader);
        reader.getBoundingClientRect = () => ({ top: 200 }) as DOMRect;
        above.getBoundingClientRect = () => ({ top: 0, bottom: 150 }) as DOMRect;
        occupying.getBoundingClientRect = () => ({ top: 150, bottom: 400 }) as DOMRect;
        expect(spineRowAtReaderTop(reader)).toBe(occupying);
        reader.remove();
    });

    it("reads in-chapter fraction from live boxes when virtualizer start is wrong", () => {
        const reader = document.createElement("div");
        const row = document.createElement("div");
        row.className = "epubSpineItem";
        reader.appendChild(row);
        document.body.appendChild(reader);
        reader.scrollTop = 9000;
        Object.defineProperty(reader, "clientHeight", { configurable: true, value: 1000 });
        reader.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
        row.getBoundingClientRect = () => ({ top: -900, height: 3000, bottom: 2100 }) as DOMRect;
        expect(scrollYOfElement(reader, row)).toBe(8000);
        expect(inChapterFractionFromSpineRow(reader, row)).toBeCloseTo(1 / 3);
        expect(inChapterFractionFromLayout(9000, 500, 3000)).not.toBeCloseTo(0.5);
        reader.remove();
    });
});
