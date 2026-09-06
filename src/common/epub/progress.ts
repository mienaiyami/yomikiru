/**
 * Whole-publication EPUB progress from spine section weights (file sizes), not layout height.
 * Display % is derived at read time; locators stay {@link BookProgress} chapterId + CSS path.
 */

/** Empty or missing spine files still need a positive weight so seek cannot divide by zero. */
export const ZERO_SPINE_WEIGHT = 1;

/**
 * Floor for virtualizer `estimateSize` (px) when the scroller is shorter than a typical screen.
 */
export const MIN_SPINE_ITEM_ESTIMATE_PX = 80;

/**
 * Extra spine items to mount above and below the visible range.
 * TanStack `overscan` is an item count, not pixels; a viewport-derived count mounts whole chapters off-screen.
 */
export const SPINE_VIRTUAL_OVERSCAN = 2;

/** Display places for whole-book % in continuous scroll (derived, not persisted). */
export const PUBLICATION_PERCENT_DECIMALS = 2;

/** Restricts derived fractions to the publication range. */
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Replaces zero/negative sizes with {@link ZERO_SPINE_WEIGHT} so prefix sums stay strictly increasing.
 */
export const normalizeSpineWeights = (fileSizes: readonly number[]): number[] =>
    fileSizes.map((fileSize) => (Number.isFinite(fileSize) && fileSize > 0 ? fileSize : ZERO_SPINE_WEIGHT));

const weightTotalOf = (weights: readonly number[]): number => {
    let total = 0;
    for (const weight of weights) total += weight;
    return total;
};

/**
 * Publication position in `[0, 1]`: completed spine weight plus in-chapter fraction of the current item.
 *
 * @param inChapterFraction - how far through the current spine item (`0` at its start, `1` at its end)
 */
export const publicationFraction = (
    weights: readonly number[],
    spineIndex: number,
    inChapterFraction: number,
): number => {
    if (weights.length === 0) return 0;
    const safeIndex = Math.min(Math.max(Math.trunc(spineIndex), 0), weights.length - 1);
    let prefix = 0;
    for (let i = 0; i < safeIndex; i++) prefix += weights[i];
    const total = prefix + weights.slice(safeIndex).reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return 0;
    return clamp01((prefix + clamp01(inChapterFraction) * weights[safeIndex]) / total);
};

/**
 * Whole-book percent in `[0, 100]` rounded to {@link PUBLICATION_PERCENT_DECIMALS}.
 */
export const publicationPercent = (fraction: number): number => {
    const scale = 10 ** PUBLICATION_PERCENT_DECIMALS;
    return Math.round(clamp01(fraction) * 100 * scale) / scale;
};

/**
 * Fixed-place string for {@link publicationPercent} (TopBar / zen overlay).
 */
export const formatPublicationPercent = (percent: number): string => percent.toFixed(PUBLICATION_PERCENT_DECIMALS);

/**
 * Inverts {@link publicationFraction}: which spine item and in-chapter fraction map to `fraction`.
 */
export const spineIndexFromPublicationFraction = (
    weights: readonly number[],
    fraction: number,
): { spineIndex: number; inChapterFraction: number } => {
    if (weights.length === 0) return { spineIndex: 0, inChapterFraction: 0 };
    const target = clamp01(fraction) * weightTotalOf(weights);
    let prefix = 0;
    for (let spineIndex = 0; spineIndex < weights.length; spineIndex++) {
        const next = prefix + weights[spineIndex];
        if (target < next || spineIndex === weights.length - 1) {
            const span = weights[spineIndex];
            const inChapterFraction = span <= 0 ? 0 : clamp01((target - prefix) / span);
            return { spineIndex, inChapterFraction };
        }
        prefix = next;
    }
    return { spineIndex: weights.length - 1, inChapterFraction: 1 };
};

/**
 * How far through a measured spine item the scroller is, for {@link publicationFraction}.
 * Continuous chapters can leave the viewport entirely, so every part of their height contributes.
 */
export const inChapterFractionFromLayout = (scrollTop: number, itemStart: number, itemSize: number): number => {
    if (itemSize <= 0) return 0;
    return clamp01((scrollTop - itemStart) / itemSize);
};

/**
 * Inputs for stable first-pass height estimates before the virtualizer measures chapter DOM.
 */
export type SpineHeightEstimate = {
    /** Scroller client height. */
    viewportHeightPx: number;
    /** OPF spine length. */
    spineItemCount: number;
    /** Sum of {@link normalizeSpineWeights} for the whole spine. */
    weightsTotal: number;
};

/**
 * Distributes a first-pass viewport budget according to chapter file sizes.
 * These estimates determine the initial scrollbar range; navigation uses measured DOM geometry.
 * Missing weights (`weightsTotal <= 0`) fall back to one viewport so an empty weight list
 * cannot inflate every row.
 *
 * @param itemWeight - that spine file's size from {@link normalizeSpineWeights}
 */
export const estimateSpineItemHeight = (itemWeight: number, estimate: SpineHeightEstimate): number => {
    const viewport = Math.max(MIN_SPINE_ITEM_ESTIMATE_PX, estimate.viewportHeightPx);
    if (estimate.weightsTotal <= 0 || estimate.spineItemCount <= 0) return viewport;
    const proportional = (Math.max(itemWeight, 0) / estimate.weightsTotal) * viewport * estimate.spineItemCount;
    return Math.max(MIN_SPINE_ITEM_ESTIMATE_PX, proportional);
};

/**
 * Inverse of {@link inChapterFractionFromLayout}: scroller `scrollTop` for a publication seek.
 */
export const scrollTopFromInChapterFraction = (
    itemStart: number,
    itemSize: number,
    inChapterFraction: number,
): number => {
    return itemStart + clamp01(inChapterFraction) * Math.max(0, itemSize);
};

/**
 * Non-overlapping case-insensitive substring count in `haystack`.
 */
export const countCaseInsensitiveMatches = (haystack: string, query: string): number => {
    if (!query) return 0;
    const lowerHaystack = haystack.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let count = 0;
    let from = 0;
    while (from <= lowerHaystack.length - lowerQuery.length) {
        const at = lowerHaystack.indexOf(lowerQuery, from);
        if (at < 0) break;
        count += 1;
        from = at + lowerQuery.length;
    }
    return count;
};
