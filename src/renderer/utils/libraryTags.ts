import type { LibraryItemTag, LibraryTag } from "@common/types/db";

/** CSS hex (`#` plus six hex digits) used as the default for a new catalog tag. */
export const DEFAULT_TAG_COLOR = "#6b7280";

/** Preset swatches offered in the tag picker colour row. */
export const TAG_CHIP_COLORS = [
    DEFAULT_TAG_COLOR,
    "#dc2626",
    "#ea580c",
    "#ca8a04",
    "#16a34a",
    "#0891b2",
    "#2563eb",
    "#7c3aed",
    "#db2777",
] as const;

const CSS_HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Returns true when `value` is a six-digit CSS hex colour (`#rrggbb`).
 */
export const isCssHexColor = (value: string): boolean => CSS_HEX_COLOR.test(value);

/**
 * Trims a catalog tag name. Empty after trim is invalid at the IPC boundary.
 */
export const normalizeTagName = (name: string): string => name.trim();

/**
 * Case-fold used to match SQLite `lower()` on the unique name index (ASCII fold).
 */
export const tagNameKey = (name: string): string => normalizeTagName(name).toLowerCase();

/**
 * Foreground colour that contrasts with a CSS hex chip background.
 */
export const tagChipTextColor = (backgroundHex: string): "#111111" | "#ffffff" => {
    if (!isCssHexColor(backgroundHex)) return "#ffffff";
    const n = Number.parseInt(backgroundHex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? "#111111" : "#ffffff";
};

/**
 * Catalog rows assigned to `itemLink`, sorted by display name.
 */
export const tagsForItem = (
    catalog: readonly LibraryTag[],
    assignments: readonly LibraryItemTag[],
    itemLink: string,
): LibraryTag[] => {
    const ids = new Set(assignments.filter((row) => row.itemLink === itemLink).map((row) => row.tagId));
    return catalog.filter((tag) => ids.has(tag.id)).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Library items that have `tagId` assigned.
 */
export const itemsWithTag = <T extends { link: string }>(
    items: readonly T[],
    assignments: readonly LibraryItemTag[],
    tagId: number,
): T[] => {
    const links = new Set(assignments.filter((row) => row.tagId === tagId).map((row) => row.itemLink));
    return items.filter((item) => links.has(item.link));
};

/**
 * Library items that have at least one of `tagIds` assigned (OR).
 * Empty `tagIds` returns the same `items` reference (no tag constraint).
 */
export const itemsWithAnyTag = <T extends { link: string }>(
    items: readonly T[],
    assignments: readonly LibraryItemTag[],
    tagIds: readonly number[],
): T[] => {
    if (tagIds.length === 0) return items as T[];
    const idSet = new Set(tagIds);
    const links = new Set(assignments.filter((row) => idSet.has(row.tagId)).map((row) => row.itemLink));
    return items.filter((item) => links.has(item.link));
};

/**
 * Gallery toolbar tag filter in app code: catalog ids only (always positive).
 * Polarity is include vs exclude; an id must not appear in both lists.
 */
export type GalleryTagFilterSelection = {
    includeIds: readonly number[];
    excludeIds: readonly number[];
};

/**
 * Uniform or mixed state of the master select-all control versus a catalog id list.
 */
export type TagFilterSelectAllState = "off" | "on" | "exclude" | "mixed";

/**
 * Activator colour mark: same-sized cell, circle for include and triangle for exclude.
 */
export type TagFilterActivatorMark = {
    id: number;
    color: string;
    shape: "dot" | "triangle";
};

/** Empty {@link GalleryTagFilterSelection} used when the master cycle clears the filter. */
const EMPTY_TAG_FILTER_SELECTION: GalleryTagFilterSelection = {
    includeIds: [],
    excludeIds: [],
};

/**
 * Decodes persisted `galleryTagFilterIds`: positive catalog id = include, negative = exclude.
 * `0` is dropped. If both signs appear for the same abs, the last entry wins.
 */
export const tagFilterSelectionFromSignedIds = (ids: readonly number[]): GalleryTagFilterSelection => {
    const polarity = new Map<number, "include" | "exclude">();
    for (const signed of ids) {
        if (signed === 0) continue;
        const catalogId = Math.abs(signed);
        polarity.set(catalogId, signed > 0 ? "include" : "exclude");
    }
    const includeIds: number[] = [];
    const excludeIds: number[] = [];
    for (const [id, side] of polarity) {
        if (side === "include") includeIds.push(id);
        else excludeIds.push(id);
    }
    return { includeIds, excludeIds };
};

/**
 * Encodes {@link GalleryTagFilterSelection} for `galleryTagFilterIds`.
 * Includes first (sorted), then excludes as negatives (sorted). Overlap keeps include.
 */
export const signedTagFilterIdsFromSelection = (selection: GalleryTagFilterSelection): number[] => {
    const includeSet = new Set(selection.includeIds.filter((id) => id > 0));
    const includeIds = [...includeSet].sort((a, b) => a - b);
    const excludeIds = [...new Set(selection.excludeIds.filter((id) => id > 0 && !includeSet.has(id)))].sort(
        (a, b) => a - b,
    );
    return [...includeIds, ...excludeIds.map((id) => -id)];
};

/**
 * Drops signed filter entries whose absolute id is not in `catalogIds`.
 */
export const pruneSignedTagFilterIds = (signedIds: readonly number[], catalogIds: ReadonlySet<number>): number[] =>
    signedIds.filter((signed) => catalogIds.has(Math.abs(signed)) && signed !== 0);

/**
 * Library items matching include (OR, if any) and not matching any exclude.
 * Both lists empty returns the same `items` reference (no tag constraint).
 * Exclude-only keeps untagged items.
 */
export const itemsMatchingTagFilter = <T extends { link: string }>(
    items: readonly T[],
    assignments: readonly LibraryItemTag[],
    selection: GalleryTagFilterSelection,
): T[] => {
    const includeSet = new Set(selection.includeIds);
    const excludeSet = new Set(selection.excludeIds);
    if (includeSet.size === 0 && excludeSet.size === 0) return items as T[];

    const tagsByLink = new Map<string, Set<number>>();
    for (const row of assignments) {
        let tags = tagsByLink.get(row.itemLink);
        if (!tags) {
            tags = new Set();
            tagsByLink.set(row.itemLink, tags);
        }
        tags.add(row.tagId);
    }

    return items.filter((item) => {
        const tags = tagsByLink.get(item.link);
        if (includeSet.size > 0) {
            if (!tags) return false;
            let anyInclude = false;
            for (const id of includeSet) {
                if (tags.has(id)) {
                    anyInclude = true;
                    break;
                }
            }
            if (!anyInclude) return false;
        }
        if (excludeSet.size > 0 && tags) {
            for (const id of excludeSet) {
                if (tags.has(id)) return false;
            }
        }
        return true;
    });
};

/**
 * One step of the per-tag cycle: off -> include -> exclude -> off.
 */
export const cycleTagInFilter = (
    selection: GalleryTagFilterSelection,
    tagId: number,
): GalleryTagFilterSelection => {
    const includeIds = selection.includeIds.filter((id) => id !== tagId);
    const excludeIds = selection.excludeIds.filter((id) => id !== tagId);
    if (selection.includeIds.includes(tagId)) {
        return { includeIds, excludeIds: [...excludeIds, tagId] };
    }
    if (selection.excludeIds.includes(tagId)) {
        return { includeIds, excludeIds };
    }
    return { includeIds: [...includeIds, tagId], excludeIds };
};

/**
 * Master-row aggregate versus `catalogIds`: all off, all include, all exclude, or mixed.
 */
export const tagFilterSelectAllState = (
    catalogIds: readonly number[],
    selection: GalleryTagFilterSelection,
): TagFilterSelectAllState => {
    if (catalogIds.length === 0) return "off";
    const includeSet = new Set(selection.includeIds);
    const excludeSet = new Set(selection.excludeIds);
    let includeCount = 0;
    let excludeCount = 0;
    for (const id of catalogIds) {
        if (includeSet.has(id)) includeCount += 1;
        else if (excludeSet.has(id)) excludeCount += 1;
    }
    if (includeCount === catalogIds.length) return "on";
    if (excludeCount === catalogIds.length) return "exclude";
    if (includeCount === 0 && excludeCount === 0) return "off";
    return "mixed";
};

/**
 * Master-row cycle: off or mixed -> all include; all include -> all exclude; all exclude -> all off.
 */
export const cycleTagFilterSelectAll = (
    catalogIds: readonly number[],
    selection: GalleryTagFilterSelection,
): GalleryTagFilterSelection => {
    const state = tagFilterSelectAllState(catalogIds, selection);
    if (state === "off" || state === "mixed") {
        return { includeIds: [...catalogIds], excludeIds: [] };
    }
    if (state === "on") {
        return { includeIds: [], excludeIds: [...catalogIds] };
    }
    return EMPTY_TAG_FILTER_SELECTION;
};

/**
 * Colour marks for the closed tag-filter activator: includes first, then excludes,
 * each group in catalog name order. `max` caps the combined list (same cell size for both shapes).
 */
export const tagFilterActivatorMarks = (
    catalog: readonly LibraryTag[],
    selection: GalleryTagFilterSelection,
    max: number,
): TagFilterActivatorMark[] => {
    if (max <= 0) return [];
    const includeSet = new Set(selection.includeIds);
    const excludeSet = new Set(selection.excludeIds);
    const sorted = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
    const marks: TagFilterActivatorMark[] = [];
    for (const tag of sorted) {
        if (includeSet.has(tag.id)) marks.push({ id: tag.id, color: tag.color, shape: "dot" });
    }
    for (const tag of sorted) {
        if (excludeSet.has(tag.id)) marks.push({ id: tag.id, color: tag.color, shape: "triangle" });
    }
    return marks.slice(0, max);
};

/**
 * True when `name` collides with an existing catalog row after trim + case-fold.
 * `excludeId` skips the row being renamed.
 */
export const catalogHasName = (catalog: readonly LibraryTag[], name: string, excludeId?: number): boolean => {
    const key = tagNameKey(name);
    if (!key) return false;
    return catalog.some((tag) => tag.id !== excludeId && tagNameKey(tag.name) === key);
};

/**
 * How many library items currently hold `tagId`.
 */
export const assignmentCountForTag = (assignments: readonly LibraryItemTag[], tagId: number): number =>
    assignments.filter((row) => row.tagId === tagId).length;
