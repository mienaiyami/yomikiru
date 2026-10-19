import { describe, expect, it } from "vitest";
import { isPlainResourceObject, validatePackListing } from "./packValidate";

describe("validatePackListing", () => {
    const goodManifest = JSON.stringify({
        id: "ja-community",
        name: "Community Japanese",
        locale: "ja",
        version: "1.0.0",
        namespaces: ["common", "dialogs"],
    });

    it("accepts a flat single-locale pack", () => {
        const result = validatePackListing(
            {
                files: ["pack.json", "common.json", "dialogs.json"],
                directories: [],
            },
            goodManifest,
            "ja-community",
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.manifest.locale).toBe("ja");
    });

    it("rejects nested directories (multi-locale shape)", () => {
        const result = validatePackListing(
            {
                files: ["pack.json", "common.json"],
                directories: ["locales"],
            },
            goodManifest,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toMatch(/flat/i);
    });

    it("rejects unexpected files", () => {
        const result = validatePackListing(
            {
                files: ["pack.json", "common.json", "dialogs.json", "readme.txt"],
                directories: [],
            },
            goodManifest,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toMatch(/unexpected file/i);
    });

    it("rejects folder id mismatch", () => {
        const result = validatePackListing(
            {
                files: ["pack.json", "common.json", "dialogs.json"],
                directories: [],
            },
            goodManifest,
            "other-id",
        );
        expect(result.ok).toBe(false);
    });

    it("rejects missing namespace files", () => {
        const result = validatePackListing(
            {
                files: ["pack.json", "common.json"],
                directories: [],
            },
            goodManifest,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toMatch(/missing namespace/i);
    });
});

describe("isPlainResourceObject", () => {
    it("accepts plain objects", () => {
        expect(isPlainResourceObject({ a: "b" })).toBe(true);
    });

    it("rejects arrays and null", () => {
        expect(isPlainResourceObject([])).toBe(false);
        expect(isPlainResourceObject(null)).toBe(false);
    });
});
