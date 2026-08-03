/**
 * Inclusive slice of `orderedIds` between two ids (either order).
 * Returns `null` when either id is missing from the list.
 */
export const getIdsInRange = <T>(orderedIds: readonly T[], fromId: T, toId: T): T[] | null => {
    const from = orderedIds.indexOf(fromId);
    const to = orderedIds.indexOf(toId);
    if (from === -1 || to === -1) return null;
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    return orderedIds.slice(start, end + 1);
};
