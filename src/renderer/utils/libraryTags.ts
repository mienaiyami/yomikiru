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
    const links = new Set(
        assignments.filter((row) => idSet.has(row.tagId)).map((row) => row.itemLink),
    );
    return items.filter((item) => links.has(item.link));
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
