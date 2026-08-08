import path from "node:path";
import { onInvoke, stubFs } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import { getExistingBaseDir, showImportFinishedSummary } from "./librarySettingsImport";

describe("getExistingBaseDir", () => {
    it("returns null for empty / missing paths", () => {
        expect(getExistingBaseDir(undefined)).toBeNull();
        expect(getExistingBaseDir("   ")).toBeNull();
        expect(getExistingBaseDir(path.join("missing", "dir"))).toBeNull();
    });

    it("returns trimmed path when it exists on disk", () => {
        const dir = path.join("testdata", "library");
        stubFs({ existsSync: (p) => p === dir });
        expect(getExistingBaseDir(`  ${dir}  `)).toBe(dir);
    });
});

describe("showImportFinishedSummary", () => {
    it("shows folder-children copy via dialog confirm", async () => {
        const handler = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:confirm", handler);
        await showImportFinishedSummary(2, 1, 0, "folderChildren");
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Import finished",
                message: "Added 2. Skipped 1. Failed 0.",
                noOption: true,
                type: "info",
            }),
        );
    });

    it("shows recursive EPUB copy via dialog confirm", async () => {
        const handler = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:confirm", handler);
        await showImportFinishedSummary(3, 2, 1, "recursiveEpubs");
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Added 3 books. Skipped 2 (already in library). Failed 1.",
            }),
        );
    });
});
