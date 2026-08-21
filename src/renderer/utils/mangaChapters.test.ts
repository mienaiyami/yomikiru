import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import {
    clampLibraryScanMaxDepth,
    classifyLibraryNode,
    collectLibraryScanTargetFromEventPath,
    collectLibraryScanTargets,
    LIBRARY_SCAN_MAX_DEPTH_CEILING,
    listMangaChapterChildren,
} from "./mangaChapters";

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
        const shot = path.join(root, "Oneshot");
        const page = path.join(shot, "01.jpg");
        stubTree(
            {
                [root]: ["Oneshot"],
                [shot]: ["01.jpg"],
            },
            [page],
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
});
