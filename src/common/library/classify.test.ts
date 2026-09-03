import path from "node:path";
import {
    classifyLibraryNode,
    collectLibraryScanTargetFromEventPath,
    collectLibraryScanTargets,
    type LibraryIo,
    resolveLibraryRealPath,
    stripWindowsLongPathPrefix,
} from "@common/library/classify";
import { describe, expect, it } from "vitest";

type IoFsExtra = Partial<Pick<LibraryIo["fs"], "realpath">>;

/**
 * Builds a {@link LibraryIo} over in-memory directory/file sets (preload-shaped).
 */
const ioForTree = (dirs: Record<string, string[]>, files: string[] = [], fsExtra: IoFsExtra = {}): LibraryIo => {
    const dirSet = new Set(Object.keys(dirs));
    const fileSet = new Set(files);
    return {
        fs: {
            existsSync: (p) => dirSet.has(p) || fileSet.has(p),
            isDir: (p) => dirSet.has(p),
            isFile: (p) => fileSet.has(p),
            readdir: async (p) => dirs[p] ?? [],
            access: async () => undefined,
            stat: async () => ({ mtimeMs: 1 }),
            constants: { R_OK: 4 },
            ...fsExtra,
        },
        path,
    };
};

describe("classifyLibraryNode with injected fs", () => {
    it("labels a folder of chapter dirs as a series", async () => {
        const series = path.join("lib", "Series");
        const ch = path.join(series, "Ch01");
        const img = path.join(ch, "01.jpg");
        const io = ioForTree({ [series]: ["Ch01"], [ch]: ["01.jpg"] }, [img]);
        await expect(classifyLibraryNode(io, series)).resolves.toEqual({ kind: "series", path: series });
    });

    it("stops a walk before classifying the next child", async () => {
        const root = path.join("lib", "books");
        const epub = path.join(root, "novel.epub");
        const io = ioForTree({ [root]: ["novel.epub"] }, [epub]);
        let stopped = false;

        const targets = await collectLibraryScanTargets(io, root, {
            content: "book",
            maxDepth: 2,
            existingLinks: new Set(),
            onWalkProgress: () => {
                stopped = true;
            },
            shouldStop: () => stopped,
        });

        expect(targets).toEqual([]);
    });

    it("collects direct books beside packed manga chapters", async () => {
        const root = path.join("lib", "mixed");
        const archive = path.join(root, "chapter-01.zip");
        const epub = path.join(root, "novel.epub");
        const io = ioForTree({ [root]: ["chapter-01.zip", "novel.epub"] }, [archive, epub]);

        const targets = await collectLibraryScanTargets(io, root, {
            content: "both",
            maxDepth: 2,
            existingLinks: new Set(),
        });

        expect(targets).toEqual([
            { type: "manga", path: root },
            { type: "book", path: epub },
        ]);
    });

    it("keeps a new book event inside an existing mixed manga series", async () => {
        const root = path.join("lib", "mixed");
        const archive = path.join(root, "chapter-01.zip");
        const epub = path.join(root, "novel.epub");
        const io = ioForTree({ [root]: ["chapter-01.zip", "novel.epub"] }, [archive, epub]);

        const target = await collectLibraryScanTargetFromEventPath(io, epub, root, {
            content: "both",
            maxDepth: 2,
            existingLinks: new Set([root]),
        });

        expect(target).toEqual({ type: "book", path: epub });
    });
});

describe("stripWindowsLongPathPrefix", () => {
    it("unwraps drive and UNC long-path prefixes", () => {
        expect(stripWindowsLongPathPrefix("\\\\?\\C:\\lib\\series")).toBe("C:\\lib\\series");
        expect(stripWindowsLongPathPrefix("\\\\?\\UNC\\server\\share\\a")).toBe("\\\\server\\share\\a");
        expect(stripWindowsLongPathPrefix("/home/lib/series")).toBe("/home/lib/series");
    });
});

describe("resolveLibraryRealPath", () => {
    it("keeps a missing path lexical when realpath is omitted or echoes the input", () => {
        const missing = path.join("testdata", "no-such-library-item");
        expect(resolveLibraryRealPath(ioForTree({}, []), missing)).toBe(path.normalize(missing));
        expect(resolveLibraryRealPath(ioForTree({}, [], { realpath: (p) => p }), missing)).toBe(
            path.normalize(missing),
        );
    });
});
