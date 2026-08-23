import path from "node:path";
import { makeBookItem, makeMangaItem, SAMPLE_BOOK_LINK, SAMPLE_MANGA_LINK } from "@test/fixtures/libraryItem";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { renderPDF } = vi.hoisted(() => ({ renderPDF: vi.fn(async () => []) }));

vi.mock("@utils/pdf", () => ({ renderPDF }));

import {
    ensurePdfLibraryCover,
    maybePromptPost0001LibraryThumbnails,
    regenerateLibraryThumbnails,
    resetLibraryCoverToDefault,
    showRegenSkippedWarning,
} from "./libraryCoverService";

/** Flushes the post-0001 settle wait (double rAF + timeout) under fake timers. */
const flushPost0001Settle = async (): Promise<void> => {
    await vi.runAllTimersAsync();
};

describe("resetLibraryCoverToDefault", () => {
    it("clears overrides, prefers library cover source, and rematerializes manga", async () => {
        const item = makeMangaItem({
            id: 12,
            link: SAMPLE_MANGA_LINK,
            cover: path.join("testdata", "custom.png"),
            extra: { detailsCoverSource: "tracker", keep: true },
        });
        const deleteCover = vi.fn(async () => ({ ok: true as const }));
        const materialize = vi.fn(async () => ({ ok: true as const }));
        onInvoke("covers:deleteForLibraryId", deleteCover);
        onInvoke("covers:materializeFromLibraryPath", materialize);
        const dispatch = vi.fn(async () => undefined);
        await resetLibraryCoverToDefault(dispatch as never, item);
        expect(deleteCover).toHaveBeenCalledWith({ libraryId: 12 });
        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(materialize).toHaveBeenCalledWith(
            expect.objectContaining({ libraryId: 12, itemType: "manga", link: SAMPLE_MANGA_LINK }),
        );
    });

    it("rematerializes books after clearing overrides", async () => {
        const item = makeBookItem({
            id: 13,
            link: SAMPLE_BOOK_LINK,
            cover: path.join("testdata", "custom.png"),
        });
        onInvoke("covers:deleteForLibraryId", async () => ({ ok: true as const }));
        const materialize = vi.fn(async () => ({ ok: true as const }));
        onInvoke("covers:materializeFromLibraryPath", materialize);
        const dispatch = vi.fn(async () => undefined);
        await resetLibraryCoverToDefault(dispatch as never, item);
        expect(materialize).toHaveBeenCalledWith(
            expect.objectContaining({ libraryId: 13, itemType: "book", link: SAMPLE_BOOK_LINK }),
        );
    });
});

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

describe("maybePromptPost0001LibraryThumbnails", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("does not claim when cancelled during the settle wait", async () => {
        const claim = vi.fn(async () => true);
        onInvoke("covers:claimPost0001ThumbnailPrompt", claim);
        const warn = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:warn", warn);

        const run = maybePromptPost0001LibraryThumbnails({
            dispatch: vi.fn() as never,
            getItems: () => [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK })],
            isCancelled: () => true,
        });
        await flushPost0001Settle();
        await run;

        expect(claim).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it("skips the dialog when the process claim is already taken", async () => {
        onInvoke("covers:claimPost0001ThumbnailPrompt", async () => false);
        const warn = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:warn", warn);

        const run = maybePromptPost0001LibraryThumbnails({
            dispatch: vi.fn() as never,
            getItems: () => [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK })],
        });
        await flushPost0001Settle();
        await run;

        expect(warn).not.toHaveBeenCalled();
    });

    it("skips without claiming when the library is empty", async () => {
        const claim = vi.fn(async () => true);
        onInvoke("covers:claimPost0001ThumbnailPrompt", claim);
        const warn = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:warn", warn);

        const run = maybePromptPost0001LibraryThumbnails({
            dispatch: vi.fn() as never,
            getItems: () => [],
        });
        await flushPost0001Settle();
        await run;

        expect(claim).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it("prompts and regenerates when the user accepts", async () => {
        stubFs({ existsSync: () => true });
        onInvoke("covers:claimPost0001ThumbnailPrompt", async () => true);
        const warn = vi.fn(async () => ({ response: 1, checkboxChecked: false }));
        onInvoke("dialog:warn", warn);
        const materialize = vi.fn(async () => ({ ok: false as const, message: "skip refresh" }));
        onInvoke("covers:materializeFromLibraryPath", materialize);
        const dispatch = vi.fn(async () => undefined);

        const run = maybePromptPost0001LibraryThumbnails({
            dispatch: dispatch as never,
            getItems: () => [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK })],
        });
        await flushPost0001Settle();
        await run;

        expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Generate library covers?",
                noOption: false,
            }),
        );
        expect(materialize).toHaveBeenCalledWith(
            expect.objectContaining({ libraryId: 1, itemType: "manga", link: SAMPLE_MANGA_LINK }),
        );
    });

    it("does not regenerate when the user skips", async () => {
        onInvoke("covers:claimPost0001ThumbnailPrompt", async () => true);
        onInvoke("dialog:warn", async () => ({ response: 0, checkboxChecked: false }));
        const materialize = vi.fn(async () => ({ ok: true as const }));
        onInvoke("covers:materializeFromLibraryPath", materialize);

        const run = maybePromptPost0001LibraryThumbnails({
            dispatch: vi.fn() as never,
            getItems: () => [makeMangaItem({ id: 1, link: SAMPLE_MANGA_LINK })],
        });
        await flushPost0001Settle();
        await run;

        expect(materialize).not.toHaveBeenCalled();
    });
});
