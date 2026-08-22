import {
    classifyLibraryNode as classifyLibraryNodeWith,
    collectLibraryScanTargetFromEventPath as collectLibraryScanTargetFromEventPathWith,
    collectLibraryScanTargets as collectLibraryScanTargetsWith,
    compileLibraryScanSkipRegex,
    isLibraryScanIgnoreName,
    shouldSkipLibraryScanEntry,
} from "@common/library/classify";
import { clampLibraryScanMaxDepth, LIBRARY_SCAN_MAX_DEPTH_CEILING } from "@common/types/libraryScan";
import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import { listMangaChapterChildren, rendererLibraryIo } from "./mangaChapters";

const classifyLibraryNode = (absPath: string) => classifyLibraryNodeWith(rendererLibraryIo(), absPath);
const collectLibraryScanTargets = (
    root: string,
    opts: Parameters<typeof collectLibraryScanTargetsWith>[2],
) => collectLibraryScanTargetsWith(rendererLibraryIo(), root, opts);
const collectLibraryScanTargetFromEventPath = (
    eventPath: string,
    root: string,
    opts: Parameters<typeof collectLibraryScanTargetFromEventPathWith>[3],
) => collectLibraryScanTargetFromEventPathWith(rendererLibraryIo(), eventPath, root, opts);


/**
 * Installs a directory tree on `window.fs`. Keys are directory paths; values are
 * child basenames. `files` are leaf paths that `isFile` reports as files.
 */
const stubTree = (dirs: Record<string, string[]>, files: string[] = []): void => {
    const dirSet = new Set(Object.keys(dirs));
    const fileSet = new Set(files);
    stubFs({
        existsSync: (p) => dirSet.has(p) || fileSet.has(p),
        isDir: (p) => dirSet.has(p),
        isFile: (p) => fileSet.has(p),
        readdir: async (p) => dirs[p] ?? [],
        access: async () => undefined,
        stat: async () => ({ mtimeMs: 1 }),
    });
};

describe("compileLibraryScanSkipRegex", () => {
    it("treats empty and whitespace as no pattern", () => {
        expect(compileLibraryScanSkipRegex("")).toEqual({ status: "empty" });
        expect(compileLibraryScanSkipRegex("   ")).toEqual({ status: "empty" });
    });

    it("returns invalid for a broken pattern instead of throwing", () => {
        expect(compileLibraryScanSkipRegex("(")).toEqual({ status: "invalid" });
    });

    it("compiles a case-insensitive basename pattern", () => {
        const compiled = compileLibraryScanSkipRegex("(^archived|completed)");
        expect(compiled.status).toBe("ok");
        if (compiled.status !== "ok") return;
        expect(shouldSkipLibraryScanEntry("Archived", compiled.regex)).toBe(true);
        expect(shouldSkipLibraryScanEntry("series-completed", compiled.regex)).toBe(true);
        expect(shouldSkipLibraryScanEntry("ongoing", compiled.regex)).toBe(false);
    });
});

describe("isLibraryScanIgnoreName", () => {
    it("matches ignore sentinel names without regarding case", () => {
        expect(isLibraryScanIgnoreName("yomikiru-ignore")).toBe(true);
        expect(isLibraryScanIgnoreName(".yomikiru-ignore")).toBe(true);
        expect(isLibraryScanIgnoreName("Yomikiru-Ignore")).toBe(true);
        expect(isLibraryScanIgnoreName(".YOMIKIRU-IGNORE")).toBe(true);
        expect(isLibraryScanIgnoreName("yomikiru-ignore.txt")).toBe(false);
        expect(isLibraryScanIgnoreName("series")).toBe(false);
    });
});

describe("clampLibraryScanMaxDepth", () => {
    it("rounds and clamps to the walk ceiling", () => {
        expect(clampLibraryScanMaxDepth(-1)).toBe(0);
        expect(clampLibraryScanMaxDepth(2.6)).toBe(3);
        expect(clampLibraryScanMaxDepth(LIBRARY_SCAN_MAX_DEPTH_CEILING + 5)).toBe(LIBRARY_SCAN_MAX_DEPTH_CEILING);
    });
});

describe("listMangaChapterChildren", () => {
    it("lists image folders and packed files; skips root images and empty dirs", async () => {
        const series = path.join("testdata", "series");
        const ch1 = path.join(series, "Ch01");
        const empty = path.join(series, "empty");
        const packed = path.join(series, "Ch02.cbz");
        const cover = path.join(series, "cover.jpg");
        stubTree(
            {
                [series]: ["Ch01", "empty", "Ch02.cbz", "cover.jpg"],
                [ch1]: ["01.jpg"],
                [empty]: [],
            },
            [packed, cover, path.join(ch1, "01.jpg")],
        );

        const children = await listMangaChapterChildren(series);
        const names = children.map((c) => c.name).sort();
        expect(names).toEqual(["Ch01", "Ch02.cbz"]);
        expect(children.find((c) => c.name === "Ch01")?.pages).toBe(1);
    });

    it("lists a one-image chapter folder", async () => {
        const series = path.join("testdata", "one-page");
        const ch = path.join(series, "Ch01");
        stubTree({ [series]: ["Ch01"], [ch]: ["only.jpg"] }, [path.join(ch, "only.jpg")]);
        const children = await listMangaChapterChildren(series);
        expect(children).toHaveLength(1);
        expect(children[0]?.name).toBe("Ch01");
        expect(children[0]?.pages).toBe(1);
    });
});

describe("classifyLibraryNode", () => {
    it("classifies a series folder with chapter subdirs", async () => {
        const series = path.join("testdata", "Series A");
        const ch = path.join(series, "Ch01");
        stubTree({ [series]: ["Ch01"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);
        await expect(classifyLibraryNode(series)).resolves.toEqual({ kind: "series", path: series });
    });

    it("classifies cover.jpg plus chapters as a series, not a one-shot", async () => {
        const series = path.join("testdata", "with-cover");
        const ch = path.join(series, "Ch01");
        stubTree({ [series]: ["cover.jpg", "Ch01"], [ch]: ["01.jpg"] }, [
            path.join(series, "cover.jpg"),
            path.join(ch, "01.jpg"),
        ]);
        await expect(classifyLibraryNode(series)).resolves.toMatchObject({ kind: "series" });
    });

    it("classifies a grouping folder that only contains nested series", async () => {
        const group = path.join("testdata", "folder1");
        const series = path.join(group, "Series A");
        const ch = path.join(series, "Ch01");
        stubTree({ [group]: ["Series A"], [series]: ["Ch01"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);
        await expect(classifyLibraryNode(group)).resolves.toMatchObject({ kind: "grouping" });
    });

    it("classifies a folder of images with no chapter children as oneshot", async () => {
        const shot = path.join("testdata", "Oneshot");
        stubTree({ [shot]: ["01.jpg", "02.jpg"] }, [path.join(shot, "01.jpg"), path.join(shot, "02.jpg")]);
        await expect(classifyLibraryNode(shot)).resolves.toMatchObject({ kind: "oneshot" });
    });

    it("classifies a packed file as packedManga and an epub as book", async () => {
        const cbz = path.join("testdata", "title.cbz");
        const epub = path.join("testdata", "novel.epub");
        stubTree({}, [cbz, epub]);
        await expect(classifyLibraryNode(cbz)).resolves.toMatchObject({ kind: "packedManga" });
        await expect(classifyLibraryNode(epub)).resolves.toMatchObject({ kind: "book" });
    });

    it("treats Series/Vol1/Ch1/images as a series at Vol1 (volume sandwich)", async () => {
        const series = path.join("testdata", "Long Series");
        const vol = path.join(series, "Vol1");
        const ch = path.join(vol, "Ch1");
        stubTree({ [series]: ["Vol1"], [vol]: ["Ch1"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);
        await expect(classifyLibraryNode(series)).resolves.toMatchObject({ kind: "grouping" });
        await expect(classifyLibraryNode(vol)).resolves.toMatchObject({ kind: "series" });
    });

    it("keeps a packed series even when an empty sibling folder exists", async () => {
        const series = path.join("testdata", "Series A");
        const ch = path.join(series, "Ch01");
        const empty = path.join(series, "empty");
        stubTree({ [series]: ["Ch01", "empty"], [ch]: ["01.jpg"], [empty]: [] }, [path.join(ch, "01.jpg")]);
        await expect(classifyLibraryNode(series)).resolves.toMatchObject({ kind: "series" });
    });

    it("still classifies a series when a sibling ignore folder holds junk", async () => {
        const series = path.join("testdata", "Series A");
        const ch = path.join(series, "Ch01");
        const dump = path.join(series, "yomikiru-ignore");
        const dumpChild = path.join(dump, "bin");
        stubTree(
            {
                [series]: ["Ch01", "yomikiru-ignore"],
                [ch]: ["01.jpg"],
                [dump]: ["bin"],
                [dumpChild]: ["x.jpg"],
            },
            [path.join(ch, "01.jpg"), path.join(dumpChild, "x.jpg")],
        );
        await expect(classifyLibraryNode(series)).resolves.toMatchObject({ kind: "series" });
    });
});

describe("collectLibraryScanTargets", () => {
    it("walks grouping folders and collects nested series, not the group", async () => {
        const root = path.join("testdata", "lib");
        const group = path.join(root, "folder1");
        const series = path.join(group, "Series A");
        const ch = path.join(series, "Ch01");
        stubTree(
            {
                [root]: ["folder1"],
                [group]: ["Series A"],
                [series]: ["Ch01"],
                [ch]: ["01.jpg"],
            },
            [path.join(ch, "01.jpg")],
        );

        const found = await collectLibraryScanTargets(root, {
            content: "both",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(found).toEqual([{ type: "manga", path: series }]);
    });

    it("collects sibling series under a group instead of only the first child", async () => {
        const root = path.join("testdata", "lib");
        const a = path.join(root, "A");
        const b = path.join(root, "B");
        const aCh = path.join(a, "c1");
        const bCh = path.join(b, "c1");
        stubTree(
            {
                [root]: ["A", "B"],
                [a]: ["c1"],
                [b]: ["c1"],
                [aCh]: ["p.jpg"],
                [bCh]: ["p.jpg"],
            },
            [path.join(aCh, "p.jpg"), path.join(bCh, "p.jpg")],
        );

        const found = await collectLibraryScanTargets(root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(found.map((t) => t.path).sort()).toEqual([a, b].sort());
    });

    it("skips paths already in existingLinks and does not recurse into a series", async () => {
        const root = path.join("testdata", "lib");
        const series = path.join(root, "Series A");
        const ch = path.join(series, "Ch01");
        stubTree({ [root]: ["Series A"], [series]: ["Ch01"], [ch]: ["01.jpg"] }, [path.join(ch, "01.jpg")]);
        const found = await collectLibraryScanTargets(root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set([series]),
        });
        expect(found).toEqual([]);
    });

    it("collects epub files under grouping folders when content includes books", async () => {
        const root = path.join("testdata", "lib");
        const nested = path.join(root, "books");
        const epub = path.join(nested, "novel.epub");
        stubTree({ [root]: ["books"], [nested]: ["novel.epub"] }, [epub]);
        const found = await collectLibraryScanTargets(root, {
            content: "book",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(found).toEqual([{ type: "book", path: epub }]);
    });

    it("emits a oneshot scan root as a manga catalogue path", async () => {
        const shot = path.join("testdata", "Oneshot");
        stubTree({ [shot]: ["01.jpg", "02.jpg"] }, [path.join(shot, "01.jpg"), path.join(shot, "02.jpg")]);
        const found = await collectLibraryScanTargets(shot, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(found).toEqual([{ type: "manga", path: shot }]);
    });

    it("finds a nested series even when a sibling folder looks like a oneshot chapter", async () => {
        const root = path.join("testdata", "lib");
        const series = path.join(root, "Series A");
        const ch = path.join(series, "Ch01");
        const shot = path.join(root, "Oneshot");
        stubTree(
            {
                [root]: ["Series A", "Oneshot"],
                [series]: ["Ch01"],
                [ch]: ["01.jpg"],
                [shot]: ["01.jpg"],
            },
            [path.join(ch, "01.jpg"), path.join(shot, "01.jpg")],
        );
        const found = await collectLibraryScanTargets(root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(found.map((t) => t.path).sort()).toEqual([series, shot].sort());
    });

    it("skips grouping folders and catalogue files whose basename matches the skip regex", async () => {
        const root = path.join("testdata", "lib");
        const archived = path.join(root, "archived");
        const archivedSeries = path.join(archived, "Old");
        const archivedCh = path.join(archivedSeries, "c1");
        const keep = path.join(root, "Keep");
        const keepCh = path.join(keep, "c1");
        const doneEpub = path.join(root, "novel-completed.epub");
        const keepEpub = path.join(root, "novel.epub");
        stubTree(
            {
                [root]: ["archived", "Keep", "novel-completed.epub", "novel.epub"],
                [archived]: ["Old"],
                [archivedSeries]: ["c1"],
                [archivedCh]: ["p.jpg"],
                [keep]: ["c1"],
                [keepCh]: ["p.jpg"],
            },
            [path.join(archivedCh, "p.jpg"), path.join(keepCh, "p.jpg"), doneEpub, keepEpub],
        );
        const compiled = compileLibraryScanSkipRegex("(^archived|completed)");
        expect(compiled.status).toBe("ok");
        if (compiled.status !== "ok") return;
        const found = await collectLibraryScanTargets(root, {
            content: "both",
            maxDepth: 8,
            existingLinks: new Set(),
            skipRegex: compiled.regex,
        });
        expect(found.map((t) => t.path).sort()).toEqual([keep, keepEpub].sort());
    });

    it("does not apply the skip regex to the scan root basename", async () => {
        const root = path.join("testdata", "archived");
        const series = path.join(root, "Keep");
        const ch = path.join(series, "c1");
        stubTree({ [root]: ["Keep"], [series]: ["c1"], [ch]: ["p.jpg"] }, [path.join(ch, "p.jpg")]);
        const compiled = compileLibraryScanSkipRegex("^archived");
        expect(compiled.status).toBe("ok");
        if (compiled.status !== "ok") return;
        const found = await collectLibraryScanTargets(root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
            skipRegex: compiled.regex,
        });
        expect(found).toEqual([{ type: "manga", path: series }]);
    });

    it("skips a series that contains an ignore sentinel file", async () => {
        const root = path.join("testdata", "lib");
        const skipped = path.join(root, "Hidden");
        const skippedCh = path.join(skipped, "c1");
        const keep = path.join(root, "Keep");
        const keepCh = path.join(keep, "c1");
        const ignoreFile = path.join(skipped, "yomikiru-ignore");
        stubTree(
            {
                [root]: ["Hidden", "Keep"],
                [skipped]: ["c1", "yomikiru-ignore"],
                [skippedCh]: ["p.jpg"],
                [keep]: ["c1"],
                [keepCh]: ["p.jpg"],
            },
            [path.join(skippedCh, "p.jpg"), path.join(keepCh, "p.jpg"), ignoreFile],
        );
        const found = await collectLibraryScanTargets(root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(found).toEqual([{ type: "manga", path: keep }]);
    });

    it("skips an ignore-named folder without skipping sibling series", async () => {
        const root = path.join("testdata", "lib");
        const dump = path.join(root, "yomikiru-ignore");
        const dumpSeries = path.join(dump, "Junk");
        const dumpCh = path.join(dumpSeries, "c1");
        const keep = path.join(root, "Keep");
        const keepCh = path.join(keep, "c1");
        stubTree(
            {
                [root]: ["yomikiru-ignore", "Keep"],
                [dump]: ["Junk"],
                [dumpSeries]: ["c1"],
                [dumpCh]: ["p.jpg"],
                [keep]: ["c1"],
                [keepCh]: ["p.jpg"],
            },
            [path.join(dumpCh, "p.jpg"), path.join(keepCh, "p.jpg")],
        );
        const found = await collectLibraryScanTargets(root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
        });
        expect(found).toEqual([{ type: "manga", path: keep }]);
    });

    it("does not walk a nested extra library folder passed as skipRoots", async () => {
        const root = path.join("testdata", "lib");
        const extra = path.join(root, "completed");
        const extraSeries = path.join(extra, "Done");
        const extraCh = path.join(extraSeries, "c1");
        const keep = path.join(root, "Keep");
        const keepCh = path.join(keep, "c1");
        stubTree(
            {
                [root]: ["completed", "Keep"],
                [extra]: ["Done"],
                [extraSeries]: ["c1"],
                [extraCh]: ["p.jpg"],
                [keep]: ["c1"],
                [keepCh]: ["p.jpg"],
            },
            [path.join(extraCh, "p.jpg"), path.join(keepCh, "p.jpg")],
        );
        const found = await collectLibraryScanTargets(root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
            skipRoots: [extra],
        });
        expect(found).toEqual([{ type: "manga", path: keep }]);
    });
});

describe("collectLibraryScanTargetFromEventPath", () => {
    it("walks up from a chapter page to the series, not the chapter folder", async () => {
        const root = path.join("testdata", "lib");
        const series = path.join(root, "Series");
        const ch = path.join(series, "Ch01");
        const page = path.join(ch, "01.jpg");
        stubTree(
            {
                [root]: ["Series"],
                [series]: ["Ch01"],
                [ch]: ["01.jpg"],
            },
            [page],
        );
        const found = await collectLibraryScanTargetFromEventPath(page, root, {
            content: "manga",
            maxDepth: 2,
            existingLinks: new Set(),
        });
        expect(found).toEqual({ type: "manga", path: series });
    });

    it("does not treat a packed chapter file as its own library item", async () => {
        const root = path.join("testdata", "lib");
        const series = path.join(root, "Series");
        const packed = path.join(series, "Ch02.cbz");
        const ch = path.join(series, "Ch01");
        stubTree(
            {
                [root]: ["Series"],
                [series]: ["Ch01", "Ch02.cbz"],
                [ch]: ["01.jpg"],
            },
            [packed, path.join(ch, "01.jpg")],
        );
        const found = await collectLibraryScanTargetFromEventPath(packed, root, {
            content: "manga",
            maxDepth: 2,
            existingLinks: new Set(),
        });
        expect(found).toEqual({ type: "manga", path: series });
    });

    it("returns a true one-shot folder when there is no series ancestor", async () => {
        const root = path.join("testdata", "lib");
        const series = path.join(root, "Series");
        const ch = path.join(series, "Ch01");
        const shot = path.join(root, "Oneshot");
        const page = path.join(shot, "01.jpg");
        stubTree(
            {
                [root]: ["Series", "Oneshot"],
                [series]: ["Ch01"],
                [ch]: ["01.jpg"],
                [shot]: ["01.jpg"],
            },
            [page, path.join(ch, "01.jpg")],
        );
        const found = await collectLibraryScanTargetFromEventPath(page, root, {
            content: "manga",
            maxDepth: 2,
            existingLinks: new Set(),
        });
        expect(found).toEqual({ type: "manga", path: shot });
    });

    it("returns null when the series is already in the library", async () => {
        const root = path.join("testdata", "lib");
        const series = path.join(root, "Series");
        const ch = path.join(series, "Ch01");
        const page = path.join(ch, "01.jpg");
        stubTree(
            {
                [root]: ["Series"],
                [series]: ["Ch01"],
                [ch]: ["01.jpg"],
            },
            [page],
        );
        const found = await collectLibraryScanTargetFromEventPath(page, root, {
            content: "manga",
            maxDepth: 2,
            existingLinks: new Set([series]),
        });
        expect(found).toBeNull();
    });

    it("returns null when the event is inside a foreign skip root", async () => {
        const root = path.join("testdata", "lib");
        const extra = path.join(root, "completed");
        const series = path.join(extra, "Done");
        const ch = path.join(series, "c1");
        const page = path.join(ch, "p.jpg");
        stubTree(
            {
                [root]: ["completed"],
                [extra]: ["Done"],
                [series]: ["c1"],
                [ch]: ["p.jpg"],
            },
            [page],
        );
        const found = await collectLibraryScanTargetFromEventPath(page, root, {
            content: "manga",
            maxDepth: 8,
            existingLinks: new Set(),
            skipRoots: [extra],
        });
        expect(found).toBeNull();
    });
});
