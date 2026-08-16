import path from "node:path";
import type { ValidationResult } from "@renderer/features/reader/types";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import EPUB from "./epub";
import {
    fetchMangaCoverMaterializeSource,
    mangaDedicatedCoverPathForDb,
    mangaSeriesFirstImageScanOptions,
    resolveBookCoverAbsolutePath,
    resolveMangaCoverSourcePath,
    type ValidateDirectoryFn,
} from "./libraryCoverSources";

describe("mangaSeriesFirstImageScanOptions", () => {
    it("matches bulk-import first-image scan flags", () => {
        expect(mangaSeriesFirstImageScanOptions()).toMatchObject({
            firstImageOnly: true,
            maxSubdirectoryDepth: 1,
            errorOnInvalid: false,
            useCache: true,
        });
    });
});

describe("mangaDedicatedCoverPathForDb / resolveMangaCoverSourcePath", () => {
    it("returns dedicated cover.* when findCover finds a file", () => {
        const dir = path.join("testdata", "manga", "series");
        const cover = path.join(dir, "cover.jpg");
        stubFs({ isFile: (p) => p === cover });
        expect(mangaDedicatedCoverPathForDb(dir)).toBe(cover);

        const firstPage = path.join(dir, "ch1", "001.png");
        expect(resolveMangaCoverSourcePath(dir, firstPage)).toEqual({
            realCover: cover,
            sourceForCover: cover,
        });
    });

    it("uses firstPageImage when no dedicated cover exists", () => {
        const dir = path.join("testdata", "manga", "series");
        const firstPage = path.join(dir, "ch1", "001.png");
        stubFs({ isFile: (p) => p === firstPage });
        expect(mangaDedicatedCoverPathForDb(dir)).toBeNull();
        expect(resolveMangaCoverSourcePath(dir, firstPage)).toEqual({
            realCover: "",
            sourceForCover: firstPage,
        });
    });
});

describe("fetchMangaCoverMaterializeSource", () => {
    it("returns dedicated cover when present", async () => {
        const dir = path.join("testdata", "manga", "series");
        const cover = path.join(dir, "cover.png");
        stubFs({ existsSync: (p) => p === dir, isFile: (p) => p === cover });
        const validateDirectory: ValidateDirectoryFn = vi.fn(async () => ({ isValid: true }));
        await expect(fetchMangaCoverMaterializeSource(dir, validateDirectory)).resolves.toBe(cover);
    });

    it("falls back to validateDirectory first image", async () => {
        const dir = path.join("testdata", "manga", "series");
        const first = path.join(dir, "001.jpg");
        stubFs({ existsSync: (p) => p === dir, isFile: (p) => p === first });
        const validateDirectory: ValidateDirectoryFn = vi.fn(
            async (): Promise<ValidationResult> => ({
                isValid: true,
                images: [first],
            }),
        );
        await expect(fetchMangaCoverMaterializeSource(dir, validateDirectory)).resolves.toBe(first);
        expect(validateDirectory).toHaveBeenCalled();
    });

    it("returns undefined without scanning when the series path is missing", async () => {
        const dir = path.join("testdata", "manga", "gone");
        stubFs({ existsSync: () => false });
        const validateDirectory: ValidateDirectoryFn = vi.fn(async () => ({ isValid: true }));
        await expect(fetchMangaCoverMaterializeSource(dir, validateDirectory)).resolves.toBeUndefined();
        expect(validateDirectory).not.toHaveBeenCalled();
    });
});

describe("resolveBookCoverAbsolutePath", () => {
    it("does not parse when the EPUB path is missing", async () => {
        const epub = path.join("testdata", "books", "missing.epub");
        stubFs({ existsSync: () => false });
        const readEpubFile = vi.spyOn(EPUB, "readEpubFile");
        await expect(resolveBookCoverAbsolutePath(epub)).resolves.toBeUndefined();
        expect(readEpubFile).not.toHaveBeenCalled();
        readEpubFile.mockRestore();
    });
});
