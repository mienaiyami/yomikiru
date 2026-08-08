import path from "node:path";
import { makeMangaItem } from "@test/fixtures/libraryItem";
import { stubFs } from "@test/mocks/preload";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyMakeCoverFromPageImage, applyMangaCoverAfterChapterLoad } from "./readerCoverFlows";

vi.mock("@utils/libraryCoverService", () => ({
    materializeCoverAndRefreshLibrary: vi.fn(),
}));

import { materializeCoverAndRefreshLibrary } from "@utils/libraryCoverService";

const materialize = vi.mocked(materializeCoverAndRefreshLibrary);

describe("readerCoverFlows", () => {
    const mangaRoot = path.join("testdata", "manga", "series");
    const pageImg = path.join(mangaRoot, "ch1", "001.png");

    beforeEach(() => {
        materialize.mockReset();
    });

    it("applyMakeCoverFromPageImage writes path when library id is missing", async () => {
        const dispatch = vi.fn(async () => undefined);
        stubFs({ isFile: (p) => p === pageImg });
        await applyMakeCoverFromPageImage({
            dispatch: dispatch as never,
            libraryId: undefined,
            mangaRoot,
            fsPath: pageImg,
        });
        expect(materialize).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalled();
    });

    it("applyMakeCoverFromPageImage materializes when library id and file exist", async () => {
        materialize.mockResolvedValue(true);
        stubFs({ isFile: (p) => p === pageImg });
        const dispatch = vi.fn(async () => undefined);
        await applyMakeCoverFromPageImage({
            dispatch: dispatch as never,
            libraryId: 9,
            mangaRoot,
            fsPath: pageImg,
        });
        expect(materialize).toHaveBeenCalledWith(dispatch, 9, pageImg);
    });

    it("applyMakeCoverFromPageImage falls back when materialize returns false", async () => {
        materialize.mockResolvedValue(false);
        stubFs({ isFile: (p) => p === pageImg });
        const dispatch = vi.fn(async () => undefined);
        await applyMakeCoverFromPageImage({
            dispatch: dispatch as never,
            libraryId: 9,
            mangaRoot,
            fsPath: pageImg,
        });
        expect(dispatch).toHaveBeenCalled();
    });

    it("applyMangaCoverAfterChapterLoad skips materialize without a readable source", async () => {
        const dispatch = vi.fn(async () => undefined);
        const item = makeMangaItem({ id: 1, link: mangaRoot, cover: null });
        if (item.type !== "manga") throw new Error("fixture type");
        await applyMangaCoverAfterChapterLoad({
            dispatch: dispatch as never,
            libraryItem: item,
            mangaDir: mangaRoot,
            imgs: [pageImg],
        });
        expect(materialize).not.toHaveBeenCalled();
    });

    it("applyMangaCoverAfterChapterLoad materializes when first page is readable", async () => {
        materialize.mockResolvedValue(true);
        stubFs({ isFile: (p) => p === pageImg });
        const dispatch = vi.fn(async () => undefined);
        const item = makeMangaItem({ id: 4, link: mangaRoot, cover: null });
        if (item.type !== "manga") throw new Error("fixture type");
        await applyMangaCoverAfterChapterLoad({
            dispatch: dispatch as never,
            libraryItem: item,
            mangaDir: mangaRoot,
            imgs: [pageImg],
        });
        expect(materialize).toHaveBeenCalledWith(dispatch, 4, pageImg);
    });

    it("applyMakeCoverFromPageImage falls back when materialize throws", async () => {
        materialize.mockRejectedValue(new Error("ipc failed"));
        stubFs({ isFile: (p) => p === pageImg });
        const dispatch = vi.fn(async () => undefined);
        await applyMakeCoverFromPageImage({
            dispatch: dispatch as never,
            libraryId: 9,
            mangaRoot,
            fsPath: pageImg,
        });
        expect(dispatch).toHaveBeenCalled();
    });
});
