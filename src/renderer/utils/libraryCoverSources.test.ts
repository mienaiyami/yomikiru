import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import { mangaDedicatedCoverPathForDb, resolveMangaCoverSourcePath } from "./libraryCoverSources";

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
