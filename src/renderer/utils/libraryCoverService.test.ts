import path from "node:path";
import { makeBookItem, makeMangaItem, SAMPLE_BOOK_LINK, SAMPLE_MANGA_LINK } from "@test/fixtures/libraryItem";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import EPUB from "./epub";
import { regenerateLibraryThumbnails, showRegenSkippedWarning } from "./libraryCoverService";

describe("regenerateLibraryThumbnails", () => {
    it("skips missing library paths without parsing EPUBs", async () => {
        stubFs({ existsSync: () => false });
        const readEpubFile = vi.spyOn(EPUB, "readEpubFile");
        const validateDirectory = vi.fn();
        const onProgress = vi.fn();
        const result = await regenerateLibraryThumbnails(
            vi.fn() as never,
            [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK }), makeBookItem({ id: 2, link: SAMPLE_BOOK_LINK })],
            validateDirectory,
            onProgress,
        );
        expect(result.skippedMissing).toBe(2);
        expect(validateDirectory).not.toHaveBeenCalled();
        expect(readEpubFile).not.toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalledTimes(2);
        readEpubFile.mockRestore();
    });

    it("materializes existing manga and counts missing books", async () => {
        const cover = path.join(SAMPLE_MANGA_LINK, "cover.jpg");
        stubFs({
            existsSync: (p) => p === SAMPLE_MANGA_LINK,
            isFile: (p) => p === cover,
        });
        // ok:false avoids fetchAllItemsWithProgress so this test does not need a thunk dispatch
        const materialize = vi.fn(async () => ({ ok: false as const, message: "skip refresh" }));
        onInvoke("covers:materialize", materialize);
        const readEpubFile = vi.spyOn(EPUB, "readEpubFile");
        const result = await regenerateLibraryThumbnails(
            vi.fn() as never,
            [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK }), makeBookItem({ id: 2, link: SAMPLE_BOOK_LINK })],
            vi.fn(),
            vi.fn(),
        );
        expect(result.skippedMissing).toBe(1);
        expect(materialize).toHaveBeenCalledWith(
            expect.objectContaining({ libraryId: 1, sourceAbsolutePath: cover }),
        );
        expect(readEpubFile).not.toHaveBeenCalled();
        readEpubFile.mockRestore();
    });
});

describe("showRegenSkippedWarning", () => {
    it("does not open a dialog when nothing was skipped", async () => {
        const handler = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:warn", handler);
        await showRegenSkippedWarning(0);
        expect(handler).not.toHaveBeenCalled();
    });

    it("shows one warning with the skipped count", async () => {
        const handler = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:warn", handler);
        await showRegenSkippedWarning(2);
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Some covers were skipped",
                message: "Skipped 2 library items because their files or folders were not found.",
                noOption: true,
            }),
        );
    });
});
