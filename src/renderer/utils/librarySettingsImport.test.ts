import {
    emptyDefaultLibraryFolder,
    type LibraryFolder,
} from "@common/library/folders";
import { makeBookItem, makeMangaItem } from "@test/fixtures/libraryItem";
import { onInvoke, stubFs } from "@test/mocks/preload";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    existingLibraryFolderPaths,
    getExistingBaseDir,
    isDuplicateLibraryFolderPath,
    isLibraryFolderContent,
    isUnusedDummyProgress,
    libraryItemLinksUnderScanRoot,
    listForeignLibraryScanSkipPaths,
    newLibraryFolderSetting,
    promptForInitialDefaultLocation,
    unusedDummyProgressLinks,
} from "./librarySettingsImport";
import { LIBRARY_SCAN_DEFAULT_MAX_DEPTH } from "@common/types/libraryScan";

/** Extra library-folder row for skip-path / existing-path tests. */
const testFolder = (over: Partial<LibraryFolder> & { path: string }): LibraryFolder => ({
    ...newLibraryFolderSetting(over.path),
    ...over,
});

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

describe("promptForInitialDefaultLocation", () => {
    it("returns the selected root after Choose now", async () => {
        const selected = path.join("testdata", "library");
        onInvoke("dialog:confirm", async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:showOpenDialog", async () => ({ canceled: false, filePaths: [selected] }));
        await expect(promptForInitialDefaultLocation(path.join("users", "reader"))).resolves.toBe(
            path.normalize(selected),
        );
    });

    it("uses the system home root after Choose later", async () => {
        const home = path.join("users", "reader");
        onInvoke("dialog:confirm", async () => ({ response: 1, checkboxChecked: false }));
        await expect(promptForInitialDefaultLocation(home)).resolves.toBe(path.normalize(home));
    });

    it("keeps Default Location empty when Choose now picker is cancelled", async () => {
        onInvoke("dialog:confirm", async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:showOpenDialog", async () => ({ canceled: true, filePaths: [] }));
        await expect(promptForInitialDefaultLocation(path.join("users", "reader"))).resolves.toBeNull();
    });
});

describe("existingLibraryFolderPaths", () => {
    it("omits folders whose path is missing on disk", () => {
        stubFs({ existsSync: () => false });
        expect(existingLibraryFolderPaths([testFolder({ path: path.join("testdata", "gone") })])).toEqual([]);
    });

    it("includes Default Location and extras, skipping missing and duplicate paths", () => {
        const base = path.join("testdata", "home");
        const extra = path.join("testdata", "drive");
        const missing = path.join("testdata", "gone");
        stubFs({ existsSync: (p) => p === base || p === extra });
        expect(
            existingLibraryFolderPaths([
                { ...emptyDefaultLibraryFolder(), path: base, maxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH },
                testFolder({ path: extra, content: "manga", maxDepth: 4 }),
                testFolder({ path: base, content: "book", maxDepth: 1 }),
                testFolder({ path: missing, maxDepth: 2 }),
            ]),
        ).toEqual([base, extra]);
    });
});

describe("listForeignLibraryScanSkipPaths", () => {
    it("excludes nested extra folders from Default Location and not the current root", () => {
        const base = path.join("testdata", "home");
        const extra = path.join(base, "completed");
        const other = path.join("testdata", "drive");
        const folders = [
            { ...emptyDefaultLibraryFolder(), path: base },
            testFolder({ path: extra }),
            testFolder({ path: other }),
        ];
        expect(listForeignLibraryScanSkipPaths(base, folders).sort()).toEqual([extra, other].sort());
        expect(listForeignLibraryScanSkipPaths(extra, folders)).toEqual([other]);
    });

    it("skips Default Location from an extra folder when it sits inside that folder", () => {
        const extra = path.join("testdata", "drive");
        const base = path.join(extra, "home");
        const folders = [{ ...emptyDefaultLibraryFolder(), path: base }, testFolder({ path: extra })];
        expect(listForeignLibraryScanSkipPaths(extra, folders)).toEqual([base]);
    });

    it("still skips Default Location from an extra folder when its scan flags are off", () => {
        const base = path.join("testdata", "home");
        const extra = path.join("testdata", "drive");
        const folders = [
            { ...emptyDefaultLibraryFolder(), path: base, scanOnStart: false, watch: false, scanIntervalMinutes: 0 },
            testFolder({ path: extra }),
        ];
        expect(listForeignLibraryScanSkipPaths(extra, folders)).toEqual([base]);
    });
});

describe("libraryItemLinksUnderScanRoot", () => {
    it("keeps items under the root and drops those inside a nested extra folder", () => {
        const root = path.join("testdata", "lib");
        const extra = path.join(root, "completed");
        const keep = path.join(root, "Keep");
        const nested = path.join(extra, "Done");
        expect(libraryItemLinksUnderScanRoot([keep, nested], root, [extra])).toEqual([keep]);
    });
});

describe("isDuplicateLibraryFolderPath", () => {
    it("matches normalized paths", () => {
        const dir = path.join("testdata", "lib");
        expect(isDuplicateLibraryFolderPath([{ path: dir }], `  ${dir}  `)).toBe(true);
        expect(isDuplicateLibraryFolderPath([{ path: dir }], path.join("testdata", "other"))).toBe(false);
    });
});

describe("newLibraryFolderSetting / isLibraryFolderContent", () => {
    it("normalizes the path and defaults scan fields off", () => {
        const dir = path.join("testdata", "lib");
        expect(newLibraryFolderSetting(`  ${dir}  `)).toMatchObject({
            path: window.path.normalize(dir),
            content: "both",
            maxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
            scanOnStart: false,
            scanIntervalMinutes: 0,
            watch: false,
            lastScanAtMs: 0,
            skipPattern: "",
            tagIds: [],
            isDefaultLocation: false,
        });
    });

    it("accepts only manga, book, or both", () => {
        expect(isLibraryFolderContent("manga")).toBe(true);
        expect(isLibraryFolderContent("both")).toBe(true);
        expect(isLibraryFolderContent("epub")).toBe(false);
    });
});

describe("isUnusedDummyProgress", () => {
    it("matches first-page manga progress stamped at create time", () => {
        const item = makeMangaItem(
            {},
            { currentPage: 1, chaptersRead: [], lastReadAt: new Date("2024-01-01T00:00:00.000Z") },
        );
        expect(isUnusedDummyProgress(item)).toBe(true);
        expect(unusedDummyProgressLinks({ [item.link]: item })).toEqual([item.link]);
    });

    it("rejects progress after a real read", () => {
        const item = makeMangaItem();
        expect(isUnusedDummyProgress(item)).toBe(false);
        expect(unusedDummyProgressLinks({ [item.link]: item })).toEqual([]);
    });

    it("matches empty-position book progress stamped at create time", () => {
        const item = makeBookItem({}, { position: "", lastReadAt: new Date("2024-01-01T00:00:00.000Z") });
        expect(isUnusedDummyProgress(item)).toBe(true);
    });
});
