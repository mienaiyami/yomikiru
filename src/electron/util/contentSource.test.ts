import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const { listEntries, openEntry } = vi.hoisted(() => ({ listEntries: vi.fn(), openEntry: vi.fn() }));

vi.mock("@electron/util/archive", () => ({
    archiveService: { listEntries, openEntry, extractAll: vi.fn() },
}));
vi.mock("@electron/util/logger", () => ({
    createMainLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { withEpubArchivePackage, withResolvedFirstImage, withResolvedMangaLibraryCover } from "./contentSource";

const roots: string[] = [];

/** Creates an on-disk archive placeholder because content resolution validates its source path. */
const createArchivePath = async (fileName: string): Promise<string> => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "yomikiru-content-source-test-"));
    roots.push(root);
    const archivePath = path.join(root, fileName);
    await fsp.writeFile(archivePath, "archive fixture");
    return archivePath;
};

/** Reads a streamed archive entry at the public content-source seam. */
const streamText = async (stream: NodeJS.ReadableStream): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf-8");
};

describe("content archive sources", () => {
    afterEach(async () => {
        listEntries.mockReset();
        openEntry.mockReset();
        await Promise.all(roots.splice(0).map((root) => fsp.rm(root, { recursive: true, force: true })));
    });

    it("streams the first packed-manga image without extracting the archive", async () => {
        const archivePath = await createArchivePath("series.cbz");
        const page = { path: "pages/001.jpg", isDirectory: false, size: 10 };
        listEntries.mockResolvedValue([{ path: "pages/002.jpg", isDirectory: false, size: 11 }, page]);
        openEntry.mockResolvedValue(Readable.from(["first-page"]));

        const result = await withResolvedFirstImage(archivePath, async (source) => {
            expect(typeof source).not.toBe("string");
            return streamText(source as NodeJS.ReadableStream);
        });

        expect(result).toBe("first-page");
        expect(openEntry).toHaveBeenCalledWith(archivePath, page);
    });

    it("falls back to the first packed chapter when the series root has no loose images", async () => {
        const root = await fsp.mkdtemp(path.join(os.tmpdir(), "yomikiru-content-source-series-"));
        roots.push(root);
        const seriesDir = path.join(root, "series");
        await fsp.mkdir(seriesDir);
        const chapterPath = path.join(seriesDir, "01.cbz");
        await fsp.writeFile(chapterPath, "cbz fixture");
        const page = { path: "001.jpg", isDirectory: false, size: 10 };
        listEntries.mockResolvedValue([page]);
        openEntry.mockResolvedValue(Readable.from(["packed-page"]));

        const result = await withResolvedMangaLibraryCover(seriesDir, async (source) => {
            if (typeof source === "string") return source;
            return streamText(source as NodeJS.ReadableStream);
        });

        expect(result).toBe("packed-page");
        expect(listEntries).toHaveBeenCalledWith(chapterPath);
    });

    it("reads only container, OPF, and the declared EPUB cover entries", async () => {
        const archivePath = await createArchivePath("book.epub");
        const container = { path: "META-INF/container.xml", isDirectory: false, size: 1 };
        const opf = { path: "OPS/package.opf", isDirectory: false, size: 1 };
        const cover = { path: "OPS/cover.jpg", isDirectory: false, size: 1 };
        listEntries.mockResolvedValue([
            container,
            opf,
            cover,
            { path: "OPS/chapter.xhtml", isDirectory: false, size: 1 },
        ]);
        openEntry.mockImplementation(async (_archivePath: string, entry: { path: string }) => {
            const text =
                entry.path === container.path
                    ? '<container><rootfile full-path="OPS/package.opf"/></container>'
                    : entry.path === opf.path
                      ? '<package><metadata><dc:title xmlns:dc="urn:test">Archive title</dc:title><dc:creator xmlns:dc="urn:test">Author</dc:creator><meta name="cover" content="cover"/></metadata><manifest><item id="cover" href="cover.jpg" media-type="image/jpeg"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest></package>'
                      : "cover-bytes";
            return Readable.from([text]);
        });

        const result = await withEpubArchivePackage(archivePath, async (pkg) => {
            expect(pkg.metadata).toMatchObject({
                title: "Archive title",
                author: "Author",
                coverPath: "OPS/cover.jpg",
            });
            const stream = await pkg.openCover();
            return stream ? streamText(stream) : "missing";
        });

        expect(result).toBe("cover-bytes");
        expect(openEntry).toHaveBeenCalledTimes(3);
        expect(openEntry).toHaveBeenNthCalledWith(3, archivePath, cover);
    });

    it("rejects an EPUB package path that escapes its archive root", async () => {
        const archivePath = await createArchivePath("unsafe.epub");
        const container = { path: "META-INF/container.xml", isDirectory: false, size: 1 };
        listEntries.mockResolvedValue([container]);
        openEntry.mockResolvedValue(
            Readable.from(['<container><rootfile full-path="../package.opf"/></container>']),
        );

        const result = await withEpubArchivePackage(archivePath, async () => "unexpected");

        expect(result).toBeUndefined();
    });
});
