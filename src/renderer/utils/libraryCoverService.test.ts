import path from "node:path";
import { makeBookItem, makeMangaItem, SAMPLE_BOOK_LINK, SAMPLE_MANGA_LINK } from "@test/fixtures/libraryItem";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";

const { renderPDF } = vi.hoisted(() => ({ renderPDF: vi.fn(async () => []) }));

vi.mock("@utils/pdf", () => ({ renderPDF }));

import { ensurePdfLibraryCover, regenerateLibraryThumbnails, showRegenSkippedWarning } from "./libraryCoverService";

describe("regenerateLibraryThumbnails", () => {
    it("skips missing library paths without parsing EPUBs", async () => {
        stubFs({ existsSync: () => false });
        const materialize = vi.fn(async () => ({ ok: true as const }));
        onInvoke("covers:materializeFromLibraryPath", materialize);
        const onProgress = vi.fn();
        const result = await regenerateLibraryThumbnails(
            vi.fn() as never,
            [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK }), makeBookItem({ id: 2, link: SAMPLE_BOOK_LINK })],
            onProgress,
        );
        expect(result.skippedMissing).toBe(2);
        expect(materialize).not.toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it("materializes existing manga and counts missing books", async () => {
        stubFs({
            existsSync: (p) => p === SAMPLE_MANGA_LINK,
        });
        // ok:false avoids fetchAllItemsWithProgress so this test does not need a thunk dispatch
        const materialize = vi.fn(async () => ({ ok: false as const, message: "skip refresh" }));
        onInvoke("covers:materializeFromLibraryPath", materialize);
        const result = await regenerateLibraryThumbnails(
            vi.fn() as never,
            [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK }), makeBookItem({ id: 2, link: SAMPLE_BOOK_LINK })],
            vi.fn(),
        );
        expect(result.skippedMissing).toBe(1);
        expect(materialize).toHaveBeenCalledWith(
            expect.objectContaining({ libraryId: 1, itemType: "manga", link: SAMPLE_MANGA_LINK }),
        );
    });
});

describe("ensurePdfLibraryCover", () => {
    it("renders page one, materializes it, and removes the temporary render", async () => {
        const libraryId = 901;
        const pdfLink = path.join("testdata", "manga", "book.pdf");
        const destination = path.join(window.electron.app.getPath("temp"), `yomikiru-pdf-cover-${libraryId}`);
        const firstPage = path.join(destination, "1.png");
        const rm = vi.fn(async () => undefined);
        stubFs({
            existsSync: (filePath) => filePath === pdfLink || filePath === destination,
            isFile: (filePath) => filePath === firstPage,
            mkdir: async () => undefined,
            rm,
        });
        const materialize = vi.fn(async () => ({ ok: false as const, message: "skip refresh" }));
        const release = vi.fn();
        onInvoke("covers:acquirePdfRender", async () => true);
        onInvoke("covers:releasePdfRender", release);
        onInvoke("covers:materialize", materialize);

        await ensurePdfLibraryCover(vi.fn() as never, makeMangaItem({ id: libraryId, link: pdfLink }));

        expect(renderPDF).toHaveBeenCalledWith(pdfLink, destination, 1, undefined, 1);
        expect(materialize).toHaveBeenCalledWith({ libraryId, sourceAbsolutePath: firstPage });
        expect(rm).toHaveBeenCalledWith(destination, { recursive: true });
        expect(release).toHaveBeenCalledWith({ libraryId });
    });

    it("leaves a duplicate PDF cover render to the renderer that owns the shared slot", async () => {
        const libraryId = 902;
        const pdfLink = path.join("testdata", "manga", "owned-by-other-window.pdf");
        stubFs({ existsSync: (filePath) => filePath === pdfLink });
        onInvoke("covers:acquirePdfRender", async () => false);

        await ensurePdfLibraryCover(vi.fn() as never, makeMangaItem({ id: libraryId, link: pdfLink }));

        expect(renderPDF).not.toHaveBeenCalled();
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
