import type { LibraryItemTag, LibraryTag } from "@common/types/db";
import { describe, expect, it } from "vitest";
import {
    assignmentCountForTag,
    catalogHasName,
    isCssHexColor,
    itemsWithAnyTag,
    itemsWithTag,
    normalizeTagName,
    tagChipTextColor,
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

    it("detects duplicate catalog names and counts assignments", () => {
        const catalog = [tag(1, "Ongoing"), tag(2, "Done")];
        expect(catalogHasName(catalog, " ongoing ")).toBe(true);
        expect(catalogHasName(catalog, "Ongoing", 1)).toBe(false);
        expect(catalogHasName(catalog, "New")).toBe(false);
        expect(assignmentCountForTag([assign("a", 1), assign("b", 1), assign("a", 2)], 1)).toBe(2);
    });
});
