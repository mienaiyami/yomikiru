import path from "node:path";
import { classifyLibraryNode, type LibraryIo } from "@common/library/classify";
import { describe, expect, it } from "vitest";

/**
 * Builds a {@link LibraryIo} over in-memory directory/file sets (preload-shaped).
 */
const ioForTree = (dirs: Record<string, string[]>, files: string[] = []): LibraryIo => {
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
});
