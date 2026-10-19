import { describe, expect, it } from "vitest";
import { getIdsInRange } from "./multiSelectRange";

describe("getIdsInRange", () => {
    const ids = ["a", "b", "c", "d"] as const;

    it("returns inclusive slice in forward order", () => {
        expect(getIdsInRange(ids, "b", "d")).toEqual(["b", "c", "d"]);
    });

    it("returns inclusive slice when endpoints are reversed", () => {
        expect(getIdsInRange(ids, "d", "b")).toEqual(["b", "c", "d"]);
    });

    it("returns null when either id is missing", () => {
        expect(getIdsInRange(ids, "a", "missing")).toBeNull();
        expect(getIdsInRange(ids, "missing", "a")).toBeNull();
    });

    it("returns a single-element range when from === to", () => {
        expect(getIdsInRange(ids, "c", "c")).toEqual(["c"]);
    });
});
