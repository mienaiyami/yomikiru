import type { MangaFitOption } from "@utils/readerSettingsSchema";

/**
 * Shared reader command math used by keyboard, pointer, and toolbar controls.
 * Keep HUD / dispatch at the call site.
 */

/** Inclusive upper bound for book font-size commands. */
const FONT_SIZE_MAX = 100;
/** Inclusive lower bound for book font-size and manga/book width commands. */
const SIZE_MIN = 1;
/** Width at or below this uses the finer step. */
const FINE_WIDTH_THRESHOLD = 40;
const FINE_WIDTH_STEP = 5;
const COARSE_WIDTH_STEP = 10;
/**
 * Cycle order for {@link MangaFitOption}. Both directions of the extends check
 * fail when this list and the schema field disagree.
 */
const FIT_OPTIONS = [0, 1, 2, 3] as const;
type FitOptionsMatchSchema = [MangaFitOption] extends [(typeof FIT_OPTIONS)[number]]
    ? [(typeof FIT_OPTIONS)[number]] extends [MangaFitOption]
        ? true
        : false
    : false;
const _fitOptionsMatchSchema: FitOptionsMatchSchema = true;
const CLAMPED_WIDTH_MAX = 100;
const UNCLAMPED_WIDTH_MAX = 500;

/**
 * Width ceiling while `widthClamped` is on vs off. Used by size steps and
 * pages-per-row width adjustments.
 */
export const maxReaderWidth = (widthClamped: boolean): number =>
    widthClamped ? CLAMPED_WIDTH_MAX : UNCLAMPED_WIDTH_MAX;

/**
 * Clamps `readerWidth` to `[SIZE_MIN, maxReaderWidth(widthClamped)]`.
 */
export const clampReaderWidth = (readerWidth: number, widthClamped: boolean): number => {
    const maxWidth = maxReaderWidth(widthClamped);
    if (readerWidth > maxWidth) return maxWidth;
    if (readerWidth < SIZE_MIN) return SIZE_MIN;
    return readerWidth;
};

/**
 * Next manga/book reader width after one plus/minus step, clamped to
 * `[SIZE_MIN, maxWidth]`.
 */
export const stepReaderWidth = (readerWidth: number, maxWidth: number, direction: 1 | -1): number => {
    const steps = readerWidth <= FINE_WIDTH_THRESHOLD ? FINE_WIDTH_STEP : COARSE_WIDTH_STEP;
    const next = readerWidth + direction * steps;
    if (next > maxWidth) return maxWidth;
    if (next < SIZE_MIN) return SIZE_MIN;
    return next;
};

/**
 * Next book font size after `delta`, clamped to `[SIZE_MIN, FONT_SIZE_MAX]`.
 */
export const stepFontSize = (fontSize: number, delta: number): number => {
    const next = fontSize + delta;
    if (next < SIZE_MIN) return SIZE_MIN;
    if (next > FONT_SIZE_MAX) return FONT_SIZE_MAX;
    return next;
};

/**
 * Next manga {@link MangaFitOption}, wrapping through {@link FIT_OPTIONS}.
 */
export const cycleFitOption = (current: MangaFitOption, reverse: boolean): MangaFitOption => {
    const index = FIT_OPTIONS.indexOf(current);
    const step = reverse ? -1 : 1;
    const next = FIT_OPTIONS[(index + step + FIT_OPTIONS.length) % FIT_OPTIONS.length];
    return next ?? FIT_OPTIONS[0];
};

/**
 * Manga LTR/RTL chapter-edge: only a fresh press may leave the chapter while
 * the edge overlay is showing.
 */
export const canCrossChapterEdge = (chapterChangerVisible: boolean, freshPress: boolean): boolean =>
    chapterChangerVisible && freshPress;
