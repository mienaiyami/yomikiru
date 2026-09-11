import type { EpubNcxTree, EpubToc } from "@common/epub";
import { describe, expect, it } from "vitest";
import {
    expandedWithAncestorsVisible,
    findNavIdByHref,
    flattenVisibleNcxRows,
    visibleRowIndexForNavId,
} from "./contentList";

/**
 * Nested fixture: root A (index 0) -> B (1) -> C (2); sibling root D (3).
 * Matches {@link EpubNcxTree} fields used by the Content TOC flatten helpers.
 */
const makeFixture = (): EpubNcxTree[] => {
    const leafC: EpubNcxTree = {
        navId: "c",
        ncx_index1: 2,
        ncx_index2: 2,
        level: 2,
        sub: [],
    };
    const midB: EpubNcxTree = {
        navId: "b",
        ncx_index1: 1,
        ncx_index2: 1,
        level: 1,
        sub: [leafC],
    };
    const rootA: EpubNcxTree = {
        navId: "a",
        ncx_index1: 0,
        ncx_index2: 0,
        level: 0,
        sub: [midB],
    };
    const rootD: EpubNcxTree = {
        navId: "d",
        ncx_index1: 3,
        ncx_index2: 3,
        level: 0,
        sub: [],
    };
    return [rootA, rootD];
};

describe("flattenVisibleNcxRows", () => {
    it("includes only roots when every node is collapsed", () => {
        const ncx = makeFixture();
        const expanded = [false, false, false, false];
        expect(flattenVisibleNcxRows(ncx, expanded)).toEqual([
            { ncx_index2: 0, navId: "a", level: 0, hasChildren: true },
            { ncx_index2: 3, navId: "d", level: 0, hasChildren: false },
        ]);
    });

    it("reveals children of an expanded parent", () => {
        const ncx = makeFixture();
        const expanded = [true, false, false, false];
        expect(flattenVisibleNcxRows(ncx, expanded)).toEqual([
            { ncx_index2: 0, navId: "a", level: 0, hasChildren: true },
            { ncx_index2: 1, navId: "b", level: 1, hasChildren: true },
            { ncx_index2: 3, navId: "d", level: 0, hasChildren: false },
        ]);
    });

    it("reveals the full path when every ancestor is expanded", () => {
        const ncx = makeFixture();
        const expanded = [true, true, false, false];
        expect(flattenVisibleNcxRows(ncx, expanded)).toEqual([
            { ncx_index2: 0, navId: "a", level: 0, hasChildren: true },
            { ncx_index2: 1, navId: "b", level: 1, hasChildren: true },
            { ncx_index2: 2, navId: "c", level: 2, hasChildren: false },
            { ncx_index2: 3, navId: "d", level: 0, hasChildren: false },
        ]);
    });
});

describe("expandedWithAncestorsVisible", () => {
    it("expands the match and every ancestor so a deep navId becomes visible", () => {
        const ncx = makeFixture();
        const expanded = [false, false, false, false];
        expect(expandedWithAncestorsVisible(ncx, expanded, "c")).toEqual([true, true, true, false]);
    });

    it("leaves expansion unchanged when navId is missing", () => {
        const ncx = makeFixture();
        const expanded = [false, true, false, false];
        expect(expandedWithAncestorsVisible(ncx, expanded, "missing")).toEqual([false, true, false, false]);
    });

    it("expands only the match when it is a root", () => {
        const ncx = makeFixture();
        const expanded = [false, false, false, false];
        expect(expandedWithAncestorsVisible(ncx, expanded, "d")).toEqual([false, false, false, true]);
    });
});

describe("findNavIdByHref", () => {
    it("returns the navId whose TOC href matches", () => {
        const toc: EpubToc = new Map([
            ["a", { navId: "a", title: "A", href: "chap/a.xhtml", level: 0 }],
            ["c", { navId: "c", title: "C", href: "chap/c.xhtml", level: 2 }],
        ]);
        expect(findNavIdByHref(toc, "chap/c.xhtml")).toBe("c");
        expect(findNavIdByHref(toc, "missing")).toBeNull();
    });
});

describe("visibleRowIndexForNavId", () => {
    it("returns the flattened index or -1 when collapsed away", () => {
        const rows = flattenVisibleNcxRows(makeFixture(), [true, false, false, false]);
        expect(visibleRowIndexForNavId(rows, "b")).toBe(1);
        expect(visibleRowIndexForNavId(rows, "c")).toBe(-1);
    });
});
