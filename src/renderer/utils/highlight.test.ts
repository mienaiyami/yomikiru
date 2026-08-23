import { afterEach, describe, expect, it } from "vitest";
import { highlightUtils } from "./highlight";

describe("highlightUtils path helpers", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("getElementPath stops at #EPubReader and escapes dots in ids", () => {
        document.body.innerHTML = `
            <div id="EPubReader">
                <div id="epub-Section0001.xhtml"><p>hello</p></div>
            </div>
        `;
        const p = document.querySelector("p");
        expect(p).toBeTruthy();
        expect(highlightUtils.getElementPath(p!)).toBe("div#epub-Section0001\\.xhtml p");
    });

    it("getPathFromNode appends text-node index", () => {
        document.body.innerHTML = `<div id="EPubReader"><p>ab</p></div>`;
        const p = document.querySelector("p")!;
        const text = p.firstChild!;
        expect(highlightUtils.getPathFromNode(text)).toBe("p>0");
    });

    it("getNodeFromPath resolves element and text nodes", () => {
        document.body.innerHTML = `<div id="root"><p>xy</p></div>`;
        const root = document.getElementById("root")!;
        const text = highlightUtils.getNodeFromPath(root, "p>0");
        expect(text?.nodeType).toBe(Node.TEXT_NODE);
        expect(text?.textContent).toBe("xy");
        expect(highlightUtils.getNodeFromPath(root, "missing")).toBeNull();
    });
});

describe("highlightUtils highlight / remove", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("highlights a text range and removeHighlight unwraps it", () => {
        document.body.innerHTML = `<div id="EPubReader"><p>hello world</p></div>`;
        const container = document.getElementById("EPubReader")!;
        const text = container.querySelector("p")!.firstChild!;
        const path = highlightUtils.getPathFromNode(text);

        const ok = highlightUtils.highlight(container, {
            id: "h1",
            color: "#FFEB3B",
            content: "note",
            range: {
                startPath: path,
                startOffset: 0,
                endPath: path,
                endOffset: 5,
            },
        });
        expect(ok).toBe(true);
        const span = container.querySelector('[data-highlight-id="h1"]');
        expect(span?.textContent).toBe("hello");
        expect(span?.getAttribute("data-tooltip")).toBe("note");

        highlightUtils.removeHighlight(container, "h1");
        expect(container.querySelector('[data-highlight-id="h1"]')).toBeNull();
        expect(container.textContent).toContain("hello world");
    });

    it("returns false when paths cannot be resolved", () => {
        document.body.innerHTML = `<div id="EPubReader"><p>x</p></div>`;
        const container = document.getElementById("EPubReader")!;
        expect(
            highlightUtils.highlight(container, {
                id: "x",
                color: "#03A9F4",
                content: "",
                range: {
                    startPath: "missing>0",
                    startOffset: 0,
                    endPath: "missing>0",
                    endOffset: 1,
                },
            }),
        ).toBe(false);
    });
});
