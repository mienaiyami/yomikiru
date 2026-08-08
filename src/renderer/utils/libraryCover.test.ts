import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import { canonicalCoverAbsolutePath, libraryCoverSrc } from "./libraryCover";

describe("canonicalCoverAbsolutePath", () => {
    it("joins userData/covers/<id>.webp", () => {
        const userData = window.electron.app.getPath("userData");
        expect(canonicalCoverAbsolutePath(42)).toBe(path.join(userData, "covers", "42.webp"));
    });
});

describe("libraryCoverSrc", () => {
    it("prefers an existing absolute DB cover path", () => {
        const abs = path.resolve("testdata", "cover.png");
        stubFs({ isFile: (p) => p === window.path.normalize(abs) });
        expect(libraryCoverSrc({ id: 1, cover: abs })).toBe(
            `file://${window.path.normalize(abs).replaceAll("#", "%23")}`,
        );
    });

    it("resolves legacy covers/ fragments under userData", () => {
        const userData = window.electron.app.getPath("userData");
        const abs = path.join(userData, "covers", "legacy.png");
        stubFs({ isFile: (p) => p === abs });
        expect(libraryCoverSrc({ id: 1, cover: "covers/legacy.png" })).toBe(
            `file://${abs.replaceAll("#", "%23")}`,
        );
    });

    it("falls back to canonical materialized cover, then empty", () => {
        const canonical = canonicalCoverAbsolutePath(7);
        stubFs({ isFile: (p) => p === canonical });
        expect(libraryCoverSrc({ id: 7, cover: null })).toBe(`file://${canonical.replaceAll("#", "%23")}`);

        stubFs({ isFile: () => false });
        expect(libraryCoverSrc({ id: 7, cover: null })).toBe("");
    });

    it("escapes # in file URLs", () => {
        const abs = path.resolve("testdata", "a#b.png");
        stubFs({ isFile: (p) => p === window.path.normalize(abs) });
        expect(libraryCoverSrc({ id: 1, cover: abs })).toContain("%23");
    });
});
