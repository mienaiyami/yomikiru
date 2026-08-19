import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import { canonicalCoverAbsolutePath, libraryCoverSrc, parseDetailsCoverSource, resolveDetailsCoverSrc, trackerCoverUrlByItemLink } from "./libraryCover";

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

describe("parseDetailsCoverSource", () => {
    it("uses the tracker image when tracked unless extra asks for the library file", () => {
        expect(parseDetailsCoverSource(undefined)).toBe("library");
        expect(parseDetailsCoverSource({})).toBe("library");
        expect(parseDetailsCoverSource({}, "https://example.test/cover.jpg")).toBe("tracker");
        expect(parseDetailsCoverSource({ detailsCoverSource: "library" }, "https://example.test/cover.jpg")).toBe(
            "library",
        );
        expect(parseDetailsCoverSource({ detailsCoverSource: "tracker" })).toBe("tracker");
        expect(parseDetailsCoverSource({ keep: 1 })).toBe("library");
    });
});

describe("resolveDetailsCoverSrc", () => {
    it("uses the tracker URL when tracked unless extra prefers the library file", () => {
        stubFs({ isFile: () => false });
        const item = { id: 1, cover: null, extra: {} };
        expect(resolveDetailsCoverSrc(item, "https://example.test/cover.jpg")).toBe(
            "https://example.test/cover.jpg",
        );
        expect(resolveDetailsCoverSrc({ ...item, extra: { detailsCoverSource: "library" } }, "https://example.test/cover.jpg")).toBe(
            "",
        );
        expect(resolveDetailsCoverSrc({ ...item, extra: { detailsCoverSource: "tracker" } }, "  ")).toBe("");
    });
});

describe("trackerCoverUrlByItemLink", () => {
    it("keeps the first snapshot cover per library path", () => {
        expect(
            trackerCoverUrlByItemLink([
                { itemLink: "a", media: { coverImage: "https://first.test/a.jpg" } },
                { itemLink: "a", media: { coverImage: "https://second.test/a.jpg" } },
                { itemLink: "b", media: {} },
                { itemLink: "c", media: { coverImage: "  https://c.test/c.jpg  " } },
            ]),
        ).toEqual({
            a: "https://first.test/a.jpg",
            c: "https://c.test/c.jpg",
        });
    });
});
