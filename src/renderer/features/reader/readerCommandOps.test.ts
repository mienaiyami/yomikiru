import { describe, expect, it } from "vitest";
import {
    canCrossChapterEdge,
    clampReaderWidth,
    cycleFitOption,
    maxReaderWidth,
    stepFontSize,
    stepReaderWidth,
} from "./readerCommandOps";

describe("readerCommandOps", () => {
    it("steps reader width with a finer increment below the threshold and clamps", () => {
        expect(stepReaderWidth(40, 100, 1)).toBe(45);
        expect(stepReaderWidth(50, 100, 1)).toBe(60);
        expect(stepReaderWidth(2, 100, -1)).toBe(1);
        expect(stepReaderWidth(98, 100, 1)).toBe(100);
    });

    it("clamps width using the clamped vs unclamped ceiling", () => {
        expect(maxReaderWidth(true)).toBe(100);
        expect(maxReaderWidth(false)).toBe(500);
        expect(clampReaderWidth(200, true)).toBe(100);
        expect(clampReaderWidth(0, false)).toBe(1);
    });

    it("steps font size within bounds", () => {
        expect(stepFontSize(16, 1)).toBe(17);
        expect(stepFontSize(1, -1)).toBe(1);
        expect(stepFontSize(100, 1)).toBe(100);
    });

    it("cycles fit options in both directions including wrap", () => {
        expect(cycleFitOption(0, false)).toBe(1);
        expect(cycleFitOption(3, false)).toBe(0);
        expect(cycleFitOption(0, true)).toBe(3);
        expect(cycleFitOption(1, true)).toBe(0);
    });

    it("only crosses a manga chapter edge on a fresh press while the overlay is showing", () => {
        expect(canCrossChapterEdge(true, true)).toBe(true);
        expect(canCrossChapterEdge(true, false)).toBe(false);
        expect(canCrossChapterEdge(false, true)).toBe(false);
    });
});
