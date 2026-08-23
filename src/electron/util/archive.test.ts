import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { path7z } from "7zip-bin-full";
import { afterEach, describe, expect, it } from "vitest";
import { createArchiveService } from "./archive";

const fixtureRoots: string[] = [];

/** Creates a disposable archive fixture root and records it for cleanup. */
const createFixtureRoot = async (): Promise<string> => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "yomikiru-archive-test-"));
    fixtureRoots.push(root);
    return root;
};

/** Builds a 7z fixture because 7-Zip does not create RAR archives. */
const createSevenZipFixture = async (sourceDirectory: string, archivePath: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const child = spawn(path7z, ["a", "-t7z", "-y", "-bd", archivePath, "."], {
            cwd: sourceDirectory,
            shell: false,
        });
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.once("error", reject);
        child.once("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`fixture 7-Zip failed (${code}): ${stderr}`));
        });
    });

/** Collects a streamed archive entry for assertions at the public service seam. */
const readStream = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
    const parts: Buffer[] = [];
    for await (const chunk of stream) parts.push(Buffer.from(chunk));
    return Buffer.concat(parts);
};

describe("ArchiveService", () => {
    afterEach(async () => {
        await Promise.all(fixtureRoots.splice(0).map((root) => fsp.rm(root, { recursive: true, force: true })));
    });

    it("lists, streams, and fully extracts a ZIP archive", async () => {
        const root = await createFixtureRoot();
        const sourceDir = path.join(root, "source");
        const archivePath = path.join(root, "comic.cbz");
        const destination = path.join(root, "extract");
        await fsp.mkdir(path.join(sourceDir, "pages"), { recursive: true });
        await fsp.writeFile(path.join(sourceDir, "pages", "001.jpg"), "first-page");
        await fsp.writeFile(path.join(sourceDir, "pages", "002.jpg"), "second-page");

        const archive = createArchiveService();
        await archive.createZip(sourceDir, archivePath);
        const entries = await archive.listEntries(archivePath);
        const firstPage = entries.find((entry) => entry.path === "pages/001.jpg");

        expect(firstPage).toMatchObject({ path: "pages/001.jpg", isDirectory: false });
        expect(await readStream(await archive.openEntry(archivePath, firstPage!))).toEqual(
            Buffer.from("first-page"),
        );

        await archive.extractAll(archivePath, destination);
        await expect(fsp.readFile(path.join(destination, "pages", "002.jpg"))).resolves.toEqual(
            Buffer.from("second-page"),
        );
    });

    it("lists and streams a CB7 archive through the same interface", async () => {
        const root = await createFixtureRoot();
        const sourceDir = path.join(root, "source");
        const archivePath = path.join(root, "comic.cb7");
        await fsp.mkdir(sourceDir);
        await fsp.writeFile(path.join(sourceDir, "001.jpg"), "cb7-page");
        await createSevenZipFixture(sourceDir, archivePath);

        const archive = createArchiveService();
        const entry = (await archive.listEntries(archivePath)).find((candidate) => candidate.path === "001.jpg");

        expect(entry).toMatchObject({ path: "001.jpg", isDirectory: false });
        expect(await readStream(await archive.openEntry(archivePath, entry!))).toEqual(Buffer.from("cb7-page"));
    });
});
