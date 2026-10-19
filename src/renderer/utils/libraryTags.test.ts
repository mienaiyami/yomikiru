import type { LibraryItemTag, LibraryTag } from "@common/types/db";
import { describe, expect, it } from "vitest";
import {
    assignmentCountForTag,
    catalogHasName,
    cycleTagFilterSelectAll,
    cycleTagInFilter,
    isCssHexColor,
    itemsMatchingTagFilter,
    itemsWithAnyTag,
    itemsWithTag,
    normalizeTagName,
    pruneSignedTagFilterIds,
    signedTagFilterIdsFromSelection,
    tagChipTextColor,
    tagFilterActivatorMarks,
    tagFilterSelectAllState,
    tagFilterSelectionFromSignedIds,
    tagNameKey,
    tagsForItem,
} from "./libraryTags";

/** Catalog fixture for library-tag helper tests. */
const tag = (id: number, name: string, color = "#2563eb"): LibraryTag => ({
    id,
    name,
    color,
    createdAt: new Date(0),
});

/** Assignment fixture for library-tag helper tests. */
const assign = (itemLink: string, tagId: number): LibraryItemTag => ({ itemLink, tagId });

describe("libraryTags helpers", () => {
    it("normalizes names with trim and ASCII case-fold", () => {
        expect(normalizeTagName("  Ongoing  ")).toBe("Ongoing");
        expect(tagNameKey("  Ongoing  ")).toBe("ongoing");
        expect(isCssHexColor("#2563eb")).toBe(true);
        expect(isCssHexColor("#fff")).toBe(false);
        expect(isCssHexColor("2563eb")).toBe(false);
    });

    it("picks contrasting chip text from background luminance", () => {
        expect(tagChipTextColor("#ffffff")).toBe("#111111");
        expect(tagChipTextColor("#111111")).toBe("#ffffff");
        expect(tagChipTextColor("nope")).toBe("#ffffff");
    });

    it("returns assigned catalog rows for an item, sorted by name", () => {
        const catalog = [tag(2, "Zeta"), tag(1, "Alpha"), tag(3, "Skip")];
        const assignments = [assign("a", 2), assign("a", 1), assign("b", 3)];
        expect(tagsForItem(catalog, assignments, "a").map((row) => row.name)).toEqual(["Alpha", "Zeta"]);
    });

    it("filters items that have a given tag id", () => {
        const items = [{ link: "a" }, { link: "b" }, { link: "c" }];
        const assignments = [assign("a", 1), assign("c", 1), assign("b", 2)];
        expect(itemsWithTag(items, assignments, 1).map((row) => row.link)).toEqual(["a", "c"]);
    });

    it("filters items that have any of the given tag ids", () => {
        const items = [{ link: "a" }, { link: "b" }, { link: "c" }, { link: "d" }];
        const assignments = [assign("a", 1), assign("b", 2), assign("c", 1), assign("c", 2)];
        expect(itemsWithAnyTag(items, assignments, [])).toBe(items);
        expect(itemsWithAnyTag(items, assignments, []).map((row) => row.link)).toEqual(["a", "b", "c", "d"]);
        expect(itemsWithAnyTag(items, assignments, [1]).map((row) => row.link)).toEqual(["a", "c"]);
        expect(itemsWithAnyTag(items, assignments, [1, 2]).map((row) => row.link)).toEqual(["a", "b", "c"]);
    });

    it("decodes signed filter ids with last-wins overlap and drops zero", () => {
        expect(tagFilterSelectionFromSignedIds([])).toEqual({ includeIds: [], excludeIds: [] });
        expect(tagFilterSelectionFromSignedIds([1, -2, 0])).toEqual({ includeIds: [1], excludeIds: [2] });
        expect(tagFilterSelectionFromSignedIds([1, -1])).toEqual({ includeIds: [], excludeIds: [1] });
        expect(tagFilterSelectionFromSignedIds([-1, 1])).toEqual({ includeIds: [1], excludeIds: [] });
    });

    it("encodes a selection as sorted +include then -exclude and mutexes overlap", () => {
        expect(signedTagFilterIdsFromSelection({ includeIds: [2, 1], excludeIds: [4, 3] })).toEqual([
            1, 2, -3, -4,
        ]);
        expect(signedTagFilterIdsFromSelection({ includeIds: [1], excludeIds: [1, 2] })).toEqual([1, -2]);
    });

    it("prunes signed ids whose abs is missing from the catalog", () => {
        expect(pruneSignedTagFilterIds([1, -2, 9, 0], new Set([1, 2]))).toEqual([1, -2]);
    });

    it("matches include OR, exclude NOR, and keeps untagged when exclude-only", () => {
        const items = [{ link: "a" }, { link: "b" }, { link: "c" }, { link: "d" }];
        const assignments = [assign("a", 1), assign("b", 2), assign("c", 1), assign("c", 2)];
        const empty = { includeIds: [], excludeIds: [] };
        expect(itemsMatchingTagFilter(items, assignments, empty)).toBe(items);
        expect(
            itemsMatchingTagFilter(items, assignments, { includeIds: [1], excludeIds: [] }).map((row) => row.link),
        ).toEqual(["a", "c"]);
        expect(
            itemsMatchingTagFilter(items, assignments, { includeIds: [], excludeIds: [1] }).map((row) => row.link),
        ).toEqual(["b", "d"]);
        expect(
            itemsMatchingTagFilter(items, assignments, { includeIds: [1], excludeIds: [2] }).map(
                (row) => row.link,
            ),
        ).toEqual(["a"]);
    });

    it("cycles a tag off -> include -> exclude -> off", () => {
        let next = cycleTagInFilter({ includeIds: [], excludeIds: [] }, 1);
        expect(next).toEqual({ includeIds: [1], excludeIds: [] });
        next = cycleTagInFilter(next, 1);
        expect(next).toEqual({ includeIds: [], excludeIds: [1] });
        next = cycleTagInFilter(next, 1);
        expect(next).toEqual({ includeIds: [], excludeIds: [] });
    });

    it("cycles select-all from mixed to all-include then all-exclude then off", () => {
        const catalogIds = [1, 2, 3];
        const mixed = { includeIds: [1], excludeIds: [2] };
        expect(tagFilterSelectAllState(catalogIds, mixed)).toBe("mixed");
        const allInclude = cycleTagFilterSelectAll(catalogIds, mixed);
        expect(allInclude).toEqual({ includeIds: [1, 2, 3], excludeIds: [] });
        expect(tagFilterSelectAllState(catalogIds, allInclude)).toBe("on");
        const allExclude = cycleTagFilterSelectAll(catalogIds, allInclude);
        expect(allExclude).toEqual({ includeIds: [], excludeIds: [1, 2, 3] });
        expect(tagFilterSelectAllState(catalogIds, allExclude)).toBe("exclude");
        expect(cycleTagFilterSelectAll(catalogIds, allExclude)).toEqual({ includeIds: [], excludeIds: [] });
        expect(tagFilterSelectAllState(catalogIds, { includeIds: [], excludeIds: [] })).toBe("off");
    });

    it("builds activator marks include-first then exclude, capped, same catalog order within each group", () => {
        const catalog = [tag(2, "B", "#222222"), tag(1, "A", "#111111"), tag(3, "C", "#333333")];
        expect(
            tagFilterActivatorMarks(catalog, { includeIds: [3, 1], excludeIds: [2] }, 8).map((mark) => ({
                id: mark.id,
                shape: mark.shape,
            })),
        ).toEqual([
            { id: 1, shape: "dot" },
            { id: 3, shape: "dot" },
            { id: 2, shape: "triangle" },
        ]);
        expect(tagFilterActivatorMarks(catalog, { includeIds: [1, 3], excludeIds: [2] }, 2)).toHaveLength(2);
    });

    it("detects duplicate catalog names and counts assignments", () => {
        const catalog = [tag(1, "Ongoing"), tag(2, "Done")];
        expect(catalogHasName(catalog, " ongoing ")).toBe(true);
        expect(catalogHasName(catalog, "Ongoing", 1)).toBe(false);
        expect(catalogHasName(catalog, "New")).toBe(false);
        expect(assignmentCountForTag([assign("a", 1), assign("b", 1), assign("a", 2)], 1)).toBe(2);
    });
});
