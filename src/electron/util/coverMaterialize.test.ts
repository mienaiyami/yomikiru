import sharp from "sharp";
import { describe, expect, it } from "vitest";
import "./coverMaterialize";

describe("cover materialization sharp cache", () => {
    it("does not retain source file handles needed by archive cleanup", () => {
        expect(sharp.cache().files.max).toBe(0);
    });
});
