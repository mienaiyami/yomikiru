import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import {
    canonicalCoverAbsolutePath,
    fileUrlToAbsolutePath,
    hasLocalTrackerCover,
    hasTrackerCoverHint,
    libraryCoverSrc,
    parseDetailsCoverSource,
    resolveDetailsCoverAbsolutePath,
    resolveDetailsCoverSrc,
    trackerCoverAbsolutePath,
    trackerCoverHintByItemLink,
} from "./libraryCover";

describe("canonicalCoverAbsolutePath", () => {
    it("joins userData/covers/<id>.webp", () => {
        const userData = window.electron.app.getPath("userData");
        expect(canonicalCoverAbsolutePath(42)).toBe(path.join(userData, "covers", "42.webp"));
    });
});

describe("trackerCoverAbsolutePath", () => {
    it("joins userData/covers/tracker-<id>.webp", () => {
        const userData = window.electron.app.getPath("userData");
        expect(trackerCoverAbsolutePath(42)).toBe(path.join(userData, "covers", "tracker-42.webp"));
    });
});

describe("fileUrlToAbsolutePath", () => {
    it("reverses file:// URLs from libraryCoverSrc", () => {
        const abs = path.resolve("testdata", "a#b.png");
        stubFs({ isFile: (p) => p === window.path.normalize(abs) });
        const fileUrl = libraryCoverSrc({ id: 1, cover: abs });
        expect(fileUrlToAbsolutePath(fileUrl)).toBe(window.path.normalize(abs));
    });

    it("returns null for empty or non-file URLs", () => {
        expect(fileUrlToAbsolutePath("")).toBeNull();
        expect(fileUrlToAbsolutePath("https://example.test/cover.jpg")).toBeNull();
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

describe("hasTrackerCoverHint", () => {
    it("is true only for a non-empty snapshot cover string", () => {
        expect(hasTrackerCoverHint(undefined)).toBe(false);
        expect(hasTrackerCoverHint("  ")).toBe(false);
        expect(hasTrackerCoverHint("https://example.test/cover.jpg")).toBe(true);
    });
});

describe("hasLocalTrackerCover", () => {
    it("follows whether the tracker slot file exists", () => {
        const cached = trackerCoverAbsolutePath(9);
        stubFs({ isFile: (p) => p === cached });
        expect(hasLocalTrackerCover(9)).toBe(true);
        stubFs({ isFile: () => false });
        expect(hasLocalTrackerCover(9)).toBe(false);
    });
});

describe("parseDetailsCoverSource", () => {
    it("uses the tracker slot when a hint exists unless extra asks for the library file", () => {
        expect(parseDetailsCoverSource(undefined)).toBe("library");
        expect(parseDetailsCoverSource({})).toBe("library");
        expect(parseDetailsCoverSource({}, true)).toBe("tracker");
        expect(parseDetailsCoverSource({ detailsCoverSource: "library" }, true)).toBe("library");
        expect(parseDetailsCoverSource({ detailsCoverSource: "tracker" })).toBe("tracker");
        expect(parseDetailsCoverSource({ keep: 1 })).toBe("library");
    });
});

describe("resolveDetailsCoverSrc", () => {
    it("never returns an http(s) snapshot URL", () => {
        stubFs({ isFile: () => false });
        const item = { id: 1, cover: null, extra: {} };
        expect(resolveDetailsCoverSrc(item, true)).toBe("");
        expect(resolveDetailsCoverSrc({ ...item, extra: { detailsCoverSource: "library" } }, true)).toBe("");
        expect(resolveDetailsCoverSrc({ ...item, extra: { detailsCoverSource: "tracker" } }, false)).toBe("");
    });

    it("uses the cached tracker WebP when the source is tracker", () => {
        const cached = trackerCoverAbsolutePath(3);
        stubFs({ isFile: (p) => p === cached });
        expect(resolveDetailsCoverSrc({ id: 3, cover: null, extra: {} }, true)).toBe(
            `file://${cached.replaceAll("#", "%23")}`,
        );
    });
});

describe("resolveDetailsCoverAbsolutePath", () => {
    it("prefers tracker WebP when the resolved source is tracker", () => {
        const cached = trackerCoverAbsolutePath(5);
        const canonical = canonicalCoverAbsolutePath(5);
        stubFs({ isFile: (p) => p === cached || p === canonical });
        expect(resolveDetailsCoverAbsolutePath({ id: 5, cover: null, extra: {} }, true)).toBe(cached);
    });

    it("falls back to user-picked cover and library WebP", () => {
        const abs = path.resolve("testdata", "picked.png");
        stubFs({ isFile: (p) => p === window.path.normalize(abs) });
        expect(resolveDetailsCoverAbsolutePath({ id: 2, cover: abs, extra: {} }, false)).toBe(
            window.path.normalize(abs),
        );

        const canonical = canonicalCoverAbsolutePath(8);
        stubFs({ isFile: (p) => p === canonical });
        expect(resolveDetailsCoverAbsolutePath({ id: 8, cover: null, extra: {} }, false)).toBe(canonical);
    });
});

describe("trackerCoverHintByItemLink", () => {
    it("keeps the first snapshot cover hint per library path", () => {
        expect(
            trackerCoverHintByItemLink([
                { itemLink: "a", media: { coverImage: "https://first.test/a.jpg" } },
                { itemLink: "a", media: { coverImage: "https://second.test/a.jpg" } },
                { itemLink: "b", media: {} },
                { itemLink: "c", media: { coverImage: "  https://c.test/c.jpg  " } },
            ]),
        ).toEqual({
            a: true,
            c: true,
        });
    });
});
