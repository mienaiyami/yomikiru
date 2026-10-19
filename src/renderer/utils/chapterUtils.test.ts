import { describe, expect, it } from "vitest";
import { processChapterNumber } from "./chapterUtils";

describe("processChapterNumber", () => {
    it.each([
        ["chapter 1", 1],
        ["Chapter 123 asd", 123],
        ["ch. 1", 1],
        ["ch1", 1],
        ["c 1", 1],
        ["part 2", 2],
        ["pt. 3", 3],
        ["episode 4", 4],
        ["ep 5", 5],
        ["uploader_ch.1", 1],
        ["uploader-ch.1", 1],
    ])("parses %s -> %i", (name, expected) => {
        expect(processChapterNumber(name)).toBe(expected);
    });

    it("returns undefined when no chapter number is present", () => {
        expect(processChapterNumber("cover")).toBeUndefined();
        expect(processChapterNumber("")).toBeUndefined();
    });
});
