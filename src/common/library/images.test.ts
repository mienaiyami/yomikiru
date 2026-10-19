import path from "node:path";
import type { LibraryIo } from "@common/library/io";
import { describe, expect, it } from "vitest";
import { compareImageNames, findCoverSidecar, listSortedImageNames } from "./images";

/** Minimal {@link LibraryIo} for cover sidecar / image-name tests. */
const fakeIo = (files: readonly string[]): LibraryIo => ({
    fs: {
        existsSync: (p) => files.includes(p),
        isDir: () => false,
        isFile: (p) => files.includes(p),
        readdir: async () => files.map((p) => path.basename(p)),
        access: async () => undefined,
        stat: async () => ({ mtimeMs: 0 }),
        constants: { R_OK: 4 },
    },
    path,
});

describe("library images", () => {
    it("orders numeric names naturally", () => {
        expect(["img10.png", "img2.png"].sort(compareImageNames)).toEqual(["img2.png", "img10.png"]);
    });

    it("finds a cover sidecar with an image extension", () => {
        const dir = path.join("testdata", "series");
        const cover = path.join(dir, "cover.jpg");
        expect(findCoverSidecar(fakeIo([cover]), dir)).toBe(cover);
    });

    it("lists only image names, sorted", async () => {
        const dir = path.join("testdata", "oneshot");
        const io = fakeIo([path.join(dir, "b.png"), path.join(dir, "a.png"), path.join(dir, "notes.txt")]);
        io.fs.readdir = async () => ["b.png", "a.png", "notes.txt"];
        expect(await listSortedImageNames(io, dir)).toEqual(["a.png", "b.png"]);
    });
});
