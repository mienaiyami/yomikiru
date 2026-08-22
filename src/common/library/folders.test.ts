import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    emptyDefaultLibraryFolder,
    extraLibraryFolders,
    getDefaultLocationFolder,
    getDefaultLocationPath,
    isDuplicateLibraryFolderPath,
    isLibraryFolderContent,
    isLibraryScanDue,
    libraryFoldersNeedHeal,
    librarySettingsSchema,
    newExtraLibraryFolder,
    normalizeLibraryFolders,
    patchLibraryFolder,
    planLocationsListLoad,
    pruneLibraryFolderTagId,
    setDefaultLocationPath,
    withLibraryScanTimestamps,
} from "./folders";

describe("normalizeLibraryFolders", () => {
    it("creates an empty default-location row when none is flagged", () => {
        const extra = newExtraLibraryFolder(path.join("testdata", "lib"));
        const out = normalizeLibraryFolders([{ ...extra, isDefaultLocation: false }]);
        expect(out.filter((folder) => folder.isDefaultLocation)).toHaveLength(1);
        expect(out[0]).toMatchObject({ isDefaultLocation: true, path: "" });
        expect(out.some((folder) => folder.path === extra.path && !folder.isDefaultLocation)).toBe(true);
    });

    it("keeps the first flagged row when several are flagged", () => {
        const a = { ...emptyDefaultLibraryFolder(), path: path.join("testdata", "a") };
        const b = { ...emptyDefaultLibraryFolder(), path: path.join("testdata", "b") };
        const out = normalizeLibraryFolders([a, b]);
        expect(out.filter((folder) => folder.isDefaultLocation)).toHaveLength(1);
        expect(out[0]?.path).toBe(a.path);
        expect(out[1]?.isDefaultLocation).toBe(false);
        expect(out[1]?.path).toBe(b.path);
    });

    it("allows an empty path on the flagged row", () => {
        const out = normalizeLibraryFolders([emptyDefaultLibraryFolder()]);
        expect(out).toHaveLength(1);
        expect(out[0]?.path).toBe("");
        expect(out[0]?.isDefaultLocation).toBe(true);
    });

    it("drops extra folders with an empty path and restores a missing flagged row", () => {
        const out = normalizeLibraryFolders([
            { ...newExtraLibraryFolder(path.join("testdata", "keep")), isDefaultLocation: false },
            { ...emptyDefaultLibraryFolder(), isDefaultLocation: false, path: "" },
        ]);
        expect(getDefaultLocationFolder(out).isDefaultLocation).toBe(true);
        expect(extraLibraryFolders(out)).toHaveLength(1);
        expect(extraLibraryFolders(out)[0]?.path).toBe(path.normalize(path.join("testdata", "keep")));
    });
});

describe("librarySettingsSchema", () => {
    it("defaults to one empty default-location folder", () => {
        const parsed = librarySettingsSchema.parse(undefined);
        expect(parsed.folders).toEqual([emptyDefaultLibraryFolder()]);
    });

    it("strips unknown keys on the library block", () => {
        const parsed = librarySettingsSchema.parse({ folders: [], leftover: true });
        expect(parsed).toEqual({ folders: [emptyDefaultLibraryFolder()] });
        expect("leftover" in parsed).toBe(false);
    });

    it("truncates fractional scan interval minutes", () => {
        const parsed = librarySettingsSchema.parse({
            folders: [{ isDefaultLocation: true, path: "", scanIntervalMinutes: 30.9 }],
        });
        expect(parsed.folders[0]?.scanIntervalMinutes).toBe(30);
    });
});

describe("setDefaultLocationPath / duplicates", () => {
    it("re-points the flagged row without removing extras", () => {
        const extra = newExtraLibraryFolder(path.join("testdata", "lib"));
        const folders = normalizeLibraryFolders([emptyDefaultLibraryFolder(), extra]);
        const next = setDefaultLocationPath(folders, path.join("testdata", "home"));
        expect(getDefaultLocationPath(next)).toBe(path.join("testdata", "home"));
        expect(extraLibraryFolders(next)).toHaveLength(1);
    });

    it("rejects a candidate that matches any existing path", () => {
        const dir = path.join("testdata", "lib");
        const folders = normalizeLibraryFolders([
            { ...emptyDefaultLibraryFolder(), path: path.join("testdata", "home") },
            newExtraLibraryFolder(dir),
        ]);
        expect(isDuplicateLibraryFolderPath(folders, `  ${dir}  `)).toBe(true);
        expect(isDuplicateLibraryFolderPath(folders, path.join("testdata", "other"))).toBe(false);
        expect(isDuplicateLibraryFolderPath(folders, "")).toBe(false);
        expect(isDuplicateLibraryFolderPath(folders, folders[0]?.path ?? "")).toBe(true);
    });
});

describe("isLibraryFolderContent / tag prune", () => {
    it("accepts only manga, book, or both", () => {
        expect(isLibraryFolderContent("manga")).toBe(true);
        expect(isLibraryFolderContent("both")).toBe(true);
        expect(isLibraryFolderContent("epub")).toBe(false);
    });

    it("drops a deleted tag id from every folder", () => {
        const folders = normalizeLibraryFolders([
            { ...emptyDefaultLibraryFolder(), tagIds: [1, 2] },
            { ...newExtraLibraryFolder(path.join("testdata", "lib")), tagIds: [2, 3] },
        ]);
        const { folders: next, changed } = pruneLibraryFolderTagId(folders, 2);
        expect(changed).toBe(true);
        expect(next[0]?.tagIds).toEqual([1]);
        expect(next[1]?.tagIds).toEqual([3]);
    });
});

describe("patch / timestamps / due / heal", () => {
    it("patches one row and stamps scanned paths", () => {
        const extraPath = path.join("testdata", "lib");
        const folders = normalizeLibraryFolders([emptyDefaultLibraryFolder(), newExtraLibraryFolder(extraPath)]);
        const patched = patchLibraryFolder(folders, (folder) => folder.path === extraPath, { watch: true });
        expect(patched.find((folder) => folder.path === extraPath)?.watch).toBe(true);
        const stamped = withLibraryScanTimestamps(patched, [extraPath], 9_000);
        expect(stamped.find((folder) => folder.path === extraPath)?.lastScanAtMs).toBe(9_000);
        expect(stamped.find((folder) => folder.isDefaultLocation)?.lastScanAtMs).toBe(0);
    });

    it("is due when never scanned and interval is on", () => {
        expect(isLibraryScanDue(0, 0, 1_000)).toBe(false);
        expect(isLibraryScanDue(0, 1, 1_000)).toBe(true);
        expect(isLibraryScanDue(1_000, 1, 1_000 + 60_000 - 1)).toBe(false);
        expect(isLibraryScanDue(1_000, 1, 1_000 + 60_000)).toBe(true);
    });

    it("needs a heal write when the flagged row is missing or duplicated", () => {
        expect(libraryFoldersNeedHeal(undefined)).toBe(true);
        expect(libraryFoldersNeedHeal([])).toBe(true);
        expect(libraryFoldersNeedHeal([{ isDefaultLocation: true }, { isDefaultLocation: true }])).toBe(true);
        expect(libraryFoldersNeedHeal([{ isDefaultLocation: true, path: "" }])).toBe(false);
    });
});

describe("planLocationsListLoad", () => {
    const home = path.join("testdata", "home");
    const gone = path.join("testdata", "gone");

    it("lists the current link when it exists", () => {
        expect(planLocationsListLoad(home, home, (p) => p === home)).toEqual({ kind: "list", path: home });
    });

    it("idles when Default Location is empty or missing (App owns the picker)", () => {
        expect(planLocationsListLoad("", "", () => false)).toEqual({ kind: "idle" });
        expect(planLocationsListLoad("", gone, (p) => p === home)).toEqual({ kind: "idle" });
    });

    it("resets to Default Location without a warning when the current link is empty", () => {
        expect(planLocationsListLoad("", home, (p) => p === home)).toEqual({
            kind: "reset",
            path: home,
            warn: false,
        });
    });

    it("resets with a warning when the current link is gone but Default Location exists", () => {
        expect(planLocationsListLoad(gone, home, (p) => p === home)).toEqual({
            kind: "reset",
            path: home,
            warn: true,
        });
    });
});
