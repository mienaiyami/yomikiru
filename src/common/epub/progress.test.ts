import { describe, expect, it } from "vitest";
import {
    countCaseInsensitiveMatches,
    estimateSpineItemHeight,
    formatPublicationPercent,
    inChapterFractionFromLayout,
    MIN_SPINE_ITEM_ESTIMATE_PX,
    normalizeSpineWeights,
    publicationFraction,
    publicationPercent,
    scrollTopFromInChapterFraction,
    spineIndexFromPublicationFraction,
    ZERO_SPINE_WEIGHT,
} from "./progress";

describe("normalizeSpineWeights", () => {
    it("replaces non-positive sizes so seek cannot divide by zero", () => {
        expect(normalizeSpineWeights([0, -2, 10])).toEqual([ZERO_SPINE_WEIGHT, ZERO_SPINE_WEIGHT, 10]);
    });
});

describe("publicationFraction", () => {
    it("is 0 on an empty spine and clamps out-of-range index", () => {
        expect(publicationFraction([], 0, 0)).toBe(0);
        expect(publicationFraction([10, 10], -1, 0)).toBe(0);
        expect(publicationFraction([10, 10], 99, 1)).toBe(1);
    });

    it("weights uneven chapters so halfway through a long first item is not 50%", () => {
        const weights = [90, 10];
        expect(publicationFraction(weights, 0, 0)).toBe(0);
        expect(publicationFraction(weights, 0, 0.5)).toBeCloseTo(0.45);
        expect(publicationFraction(weights, 1, 0)).toBeCloseTo(0.9);
        expect(publicationFraction(weights, 1, 1)).toBe(1);
    });
});

describe("publicationPercent", () => {
    it("rounds whole-book fraction to two decimal places", () => {
        expect(publicationPercent(0.12345)).toBe(12.35);
        expect(publicationPercent(0)).toBe(0);
        expect(publicationPercent(1)).toBe(100);
        expect(formatPublicationPercent(12.3)).toBe("12.30");
    });
});

describe("spineIndexFromPublicationFraction", () => {
    it("inverts publicationFraction on uneven weights", () => {
        const weights = [90, 10];
        expect(spineIndexFromPublicationFraction(weights, 0)).toEqual({ spineIndex: 0, inChapterFraction: 0 });
        const mid = spineIndexFromPublicationFraction(weights, 0.45);
        expect(mid.spineIndex).toBe(0);
        expect(mid.inChapterFraction).toBeCloseTo(0.5);
        const late = spineIndexFromPublicationFraction(weights, 0.95);
        expect(late.spineIndex).toBe(1);
        expect(late.inChapterFraction).toBeCloseTo(0.5);
        expect(spineIndexFromPublicationFraction(weights, 1).spineIndex).toBe(1);
        expect(spineIndexFromPublicationFraction([], 0.5)).toEqual({ spineIndex: 0, inChapterFraction: 0 });
    });

    it("round-trips fraction -> index -> fraction", () => {
        const weights = [3, 1, 6];
        for (const fraction of [0, 0.1, 0.5, 0.99, 1]) {
            const { spineIndex, inChapterFraction } = spineIndexFromPublicationFraction(weights, fraction);
            expect(publicationFraction(weights, spineIndex, inChapterFraction)).toBeCloseTo(fraction, 5);
        }
    });

    it("seeks an exact chapter boundary to the following chapter start", () => {
        expect(spineIndexFromPublicationFraction([90, 10], 0.9)).toEqual({ spineIndex: 1, inChapterFraction: 0 });
    });
});

describe("estimateSpineItemHeight", () => {
    it("falls back to one viewport when weights are not loaded yet", () => {
        expect(
            estimateSpineItemHeight(10, {
                viewportHeightPx: 1000,
                spineItemCount: 50,
                weightsTotal: 0,
            }),
        ).toBe(1000);
    });

    it("gives larger files a larger share of the book so total size is not N viewports", () => {
        const estimate = {
            viewportHeightPx: 1000,
            spineItemCount: 4,
            weightsTotal: 100,
        };
        expect(estimateSpineItemHeight(10, estimate)).toBe(400);
        expect(estimateSpineItemHeight(50, estimate)).toBe(2000);
        expect(estimateSpineItemHeight(1, estimate)).toBeGreaterThanOrEqual(MIN_SPINE_ITEM_ESTIMATE_PX);
        const equalEstimate = {
            viewportHeightPx: 1000,
            spineItemCount: 4,
            weightsTotal: 40,
        };
        const equalTotal = [10, 10, 10, 10].reduce(
            (sum, itemWeight) => sum + estimateSpineItemHeight(itemWeight, equalEstimate),
            0,
        );
        expect(equalTotal).toBe(4000);
    });
});

describe("scrollTopFromInChapterFraction", () => {
    it("inverts inChapterFractionFromLayout for a tall item", () => {
        const itemStart = 400;
        const itemSize = 2000;
        const fraction = 0.5;
        const scrollTop = scrollTopFromInChapterFraction(itemStart, itemSize, fraction);
        expect(inChapterFractionFromLayout(scrollTop, itemStart, itemSize)).toBeCloseTo(fraction);
    });
});

describe("inChapterFractionFromLayout", () => {
    it("advances through short chapters as they leave the viewport", () => {
        expect(inChapterFractionFromLayout(40, 0, 80)).toBe(0.5);
        expect(inChapterFractionFromLayout(100, 0, 80)).toBe(1);
        expect(inChapterFractionFromLayout(0, 0, 1000)).toBe(0);
    });

    it("maps scroll through a tall item to 0..1", () => {
        expect(inChapterFractionFromLayout(0, 0, 2000)).toBe(0);
        expect(inChapterFractionFromLayout(500, 0, 2000)).toBeCloseTo(0.25);
        expect(inChapterFractionFromLayout(1000, 0, 2000)).toBe(0.5);
        expect(inChapterFractionFromLayout(2000, 0, 2000)).toBe(1);
    });
});

describe("countCaseInsensitiveMatches", () => {
    it("counts non-overlapping case-insensitive hits in the current chapter", () => {
        expect(countCaseInsensitiveMatches("aaa", "aa")).toBe(1);
        expect(countCaseInsensitiveMatches("AbabAB", "ab")).toBe(3);
        expect(countCaseInsensitiveMatches("x", "")).toBe(0);
    });
});
