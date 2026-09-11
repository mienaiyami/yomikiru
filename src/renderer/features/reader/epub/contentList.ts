import type { EpubNcxTree, EpubToc } from "@common/epub";

/** One visible TOC row after flattening expanded branches of {@link EpubNcxTree}. */
export type VisibleNcxRow = {
    /** Flat index into the expand/collapse array (`EpubNcxTree.ncx_index2`). */
    ncx_index2: number;
    navId: string;
    level: number;
    /** True when the node has nested TOC children that can be expanded. */
    hasChildren: boolean;
};

/**
 * Resolves the TOC {@link EpubTocElement.navId} whose href matches `chapterHref`.
 * Returns null when no TOC entry points at that href.
 */
export const findNavIdByHref = (toc: EpubToc, chapterHref: string): string | null => {
    for (const [navId, entry] of toc) {
        if (entry.href === chapterHref) return navId;
    }
    return null;
};

/**
 * Index of `navId` in a flattened visible-row list, or -1 when not mounted yet
 * (collapsed ancestors).
 */
export const visibleRowIndexForNavId = (rows: readonly VisibleNcxRow[], navId: string): number =>
    rows.findIndex((row) => row.navId === navId);

/**
 * DFS-flattens {@link EpubNcxTree} into only rows whose every ancestor is expanded.
 * Root nodes are always included; a child appears only when its parent's
 * `expandedByNcxIndex[parent.ncx_index2]` is true.
 *
 * @param expandedByNcxIndex Expand flags keyed by `ncx_index2` (true = children visible)
 */
export const flattenVisibleNcxRows = (
    ncx: EpubNcxTree[],
    expandedByNcxIndex: readonly boolean[],
): VisibleNcxRow[] => {
    const rows: VisibleNcxRow[] = [];

    const walk = (nodes: EpubNcxTree[]): void => {
        for (const node of nodes) {
            rows.push({
                ncx_index2: node.ncx_index2,
                navId: node.navId,
                level: node.level,
                hasChildren: node.sub.length > 0,
            });
            if (node.sub.length > 0 && expandedByNcxIndex[node.ncx_index2]) {
                walk(node.sub);
            }
        }
    };

    walk(ncx);
    return rows;
};

/**
 * Returns a copy of `expandedByNcxIndex` with `navId` and every ancestor set to
 * expanded so {@link flattenVisibleNcxRows} will include that node.
 * Unchanged when `navId` is not in the tree.
 *
 * @param expandedByNcxIndex Current expand flags keyed by `ncx_index2`
 * @param navId TOC nav id to reveal (match and ancestors)
 */
export const expandedWithAncestorsVisible = (
    ncx: EpubNcxTree[],
    expandedByNcxIndex: readonly boolean[],
    navId: string,
): boolean[] => {
    const next = [...expandedByNcxIndex];
    const path: number[] = [];

    const findPath = (nodes: EpubNcxTree[]): boolean => {
        for (const node of nodes) {
            path.push(node.ncx_index2);
            if (node.navId === navId) return true;
            if (findPath(node.sub)) return true;
            path.pop();
        }
        return false;
    };

    if (!findPath(ncx)) return next;
    for (const ncxIndex of path) {
        next[ncxIndex] = true;
    }
    return next;
};
