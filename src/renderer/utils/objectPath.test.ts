import { describe, expect, it } from "vitest";
import { getValueFromDeepObject, setValueFromDeepObject } from "./objectPath";

describe("getValueFromDeepObject", () => {
    it("reads nested object and array paths", () => {
        const obj = { a: { b: [{ c: 1 }] } };
        expect(getValueFromDeepObject(obj, ["a", "b", 0, "c"])).toBe(1);
    });

    it("returns undefined for missing segments", () => {
        expect(getValueFromDeepObject({ a: 1 }, ["a", "b"])).toBeUndefined();
        expect(getValueFromDeepObject(null, ["a"])).toBeUndefined();
    });
});

describe("setValueFromDeepObject", () => {
    it("writes a nested leaf without creating missing segments", () => {
        const obj: Record<string, unknown> = { a: { b: 1 } };
        setValueFromDeepObject(obj, ["a", "b"], 2);
        expect(obj).toEqual({ a: { b: 2 } });
    });

    it("no-ops on empty path or broken chain", () => {
        const obj: Record<string, unknown> = { a: 1 };
        setValueFromDeepObject(obj, [], 9);
        setValueFromDeepObject(obj, ["missing", "x"], 9);
        expect(obj).toEqual({ a: 1 });
    });

    it("writes into arrays by numeric index", () => {
        const obj: Record<string, unknown> = { list: [0, 1] };
        setValueFromDeepObject(obj, ["list", 1], 9);
        expect(obj.list).toEqual([0, 9]);
    });
});
