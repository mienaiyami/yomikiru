import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectLibraryScanTargets, resolveLibraryRealPath } from "@common/library/classify";
import { createMainLibraryIo } from "@electron/util/libraryFs";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Creates a directory symlink, or a junction on Windows.
 *
 * @returns false when the host forbids the link (then the test should `skip`)
 */
const tryLinkDir = (target: string, dest: string): boolean => {
    try {
        fs.symlinkSync(target, dest, process.platform === "win32" ? "junction" : "dir");
        return true;
    } catch {
        return false;
    }
};

describe("library classify identity (main adapter)", () => {
    const io = createMainLibraryIo();
    const tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs.splice(0)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it("keeps a dangling directory link lexical", ({ skip }) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-broken-link-"));
        tmpDirs.push(root);
        const target = path.join(root, "missing-target");
        const broken = path.join(root, "gone-alias");
        fs.mkdirSync(target);
        if (!tryLinkDir(target, broken)) return skip();
        fs.rmSync(target, { recursive: true, force: true });
        expect(io.fs.realpath?.(broken)).toBe(broken);
        expect(resolveLibraryRealPath(io, broken)).toBe(path.normalize(broken));
    });

    it("emits the realpath once when a grouping folder links back to itself", async ({ skip }) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-scan-loop-"));
        tmpDirs.push(root);
        const series = path.join(root, "Series");
        const chapter = path.join(series, "Ch01");
        fs.mkdirSync(chapter, { recursive: true });
        fs.writeFileSync(path.join(chapter, "01.jpg"), "x");
        const loop = path.join(root, "loop");
        if (!tryLinkDir(root, loop)) return skip();

        const targets = await collectLibraryScanTargets(io, root, {
            content: "manga",
            maxDepth: 4,
            existingLinks: new Set(),
        });
        const canonical = resolveLibraryRealPath(io, series);
        expect(targets.filter((row) => row.type === "manga")).toEqual([{ type: "manga", path: canonical }]);
    });

    it("skips a linked extra folder that resolves inside the walk root", async ({ skip }) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-scan-skip-"));
        tmpDirs.push(root);
        const series = path.join(root, "Series");
        const chapter = path.join(series, "Ch01");
        fs.mkdirSync(chapter, { recursive: true });
        fs.writeFileSync(path.join(chapter, "01.jpg"), "x");
        const alias = path.join(root, "alias");
        if (!tryLinkDir(series, alias)) return skip();

        const targets = await collectLibraryScanTargets(io, root, {
            content: "manga",
            maxDepth: 4,
            existingLinks: new Set(),
            skipRoots: [alias],
        });
        expect(targets).toEqual([]);
    });
});
