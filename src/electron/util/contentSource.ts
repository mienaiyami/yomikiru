import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseExtractedEpubDir, type EpubPackage } from "@common/epub";
import { isPackedMangaFileName, isPdfFileName } from "@common/library/formats";
import { firstImageInMangaFolder } from "@common/library/images";
import { mainLibraryIo } from "@electron/util/libraryFs";
import { createMainLogger } from "@electron/util/logger";
import * as crossZip from "cross-zip";

const log = createMainLogger("contentSource");
const io = mainLibraryIo;
const unzip = promisify(crossZip.unzip);
const runFile = promisify(execFile);

/**
 * Flattens a packed-manga archive by replacing relative path separators with underscores.
 * This keeps every page discoverable from the reader's extracted root, for example:
 *
 * ```text
 * before: folder1/file1.jpg, folder1/folder2/file2.jpg
 * after:  folder1_file1.jpg, folder1_folder2_file2.jpg
 * ```
 *
 * Descendants move before their parent directories so each flattened target remains valid.
 */
const flattenDirectories = async (root: string, relativePath = "."): Promise<void> => {
    const absolutePath = path.resolve(root, relativePath);
    if ((await fsp.stat(absolutePath)).isDirectory()) {
        const entries = await fsp.readdir(absolutePath);
        for (const entry of entries) {
            await flattenDirectories(root, path.join(relativePath, entry));
        }
    }
    if (relativePath === ".") return;
    const flattenedName = relativePath.split(path.sep).join("_");
    await fsp.rename(absolutePath, path.resolve(root, flattenedName));
};

/** Keeps extraction usable when a conflicting archive entry prevents the optional flatten pass. */
const flattenExtractedManga = async (destination: string, source: string): Promise<void> => {
    try {
        await flattenDirectories(destination);
    } catch (err) {
        log.warn("archive flatten failed; keeping extracted directory structure", { source, destination }, err);
    }
};

/**
 * Extracts a reader-supported archive, flattens packed manga, and records its source path.
 * EPUB directory structure is preserved for container/OPF references.
 *
 * @throws {Error} When the source is missing or the platform extractor fails
 */
export const extractContentArchive = async (source: string, destination: string): Promise<void> => {
    await fsp.access(source);
    await fsp.rm(destination, { recursive: true, force: true });
    const ext = path.extname(source).toLowerCase();
    if (ext === ".rar" || ext === ".cbr") {
        await fsp.mkdir(destination, { recursive: true });
        try {
            await runFile("unrar", ["x", source, destination]);
        } catch (err) {
            if (err !== null && typeof err === "object" && "code" in err && err.code === "ENOENT") {
                throw new Error("WinRAR not found. Make sure 'unrar' is available on PATH.");
            }
            throw err;
        }
        await flattenExtractedManga(destination, source);
    } else {
        await unzip(source, destination);
        if (ext !== ".epub") await flattenExtractedManga(destination, source);
    }
    await fsp.writeFile(path.join(destination, "SOURCE"), source);
};

/**
 * Extracts an archive to an isolated temp directory for the lifetime of `useExtracted`.
 * Cleanup runs even when extraction or the callback fails.
 */
const withExtractedArchive = async <T>(
    archivePath: string,
    tempPrefix: string,
    useExtracted: (destination: string) => Promise<T>,
): Promise<T | undefined> => {
    const destination = await fsp.mkdtemp(path.join(os.tmpdir(), tempPrefix));
    try {
        await extractContentArchive(archivePath, destination);
        return await useExtracted(destination);
    } catch (err) {
        log.warn("archive extract or read failed", { archivePath }, err);
        return undefined;
    } finally {
        await fsp.rm(destination, { recursive: true, force: true }).catch((err) => {
            log.warn("archive temp cleanup failed", { destination }, err);
        });
    }
};

/**
 * Resolves the first image for a manga path and keeps extracted archive files alive while
 * `useSource` runs. PDFs return undefined because page rendering stays in the renderer.
 */
export const withResolvedFirstImage = async <T>(
    absPath: string,
    useSource: (sourceAbsolutePath: string) => Promise<T>,
): Promise<T | undefined> => {
    if (!fs.existsSync(absPath) || isPdfFileName(absPath, path.extname)) return undefined;
    if (io.fs.isFile(absPath) && isPackedMangaFileName(absPath, path.extname)) {
        return withExtractedArchive(absPath, "yomikiru-scan-cover-", async (destination) => {
            const first = await firstImageInMangaFolder(io, destination);
            return first ? useSource(first) : undefined;
        });
    }
    if (!io.fs.isDir(absPath)) return undefined;
    const first = await firstImageInMangaFolder(io, absPath);
    return first ? useSource(first) : undefined;
};

/**
 * Extracts an EPUB, parses its package, and keeps package paths alive while `usePackage` runs.
 */
export const withExtractedEpubPackage = async <T>(
    epubPath: string,
    usePackage: (pkg: EpubPackage, destination: string) => Promise<T>,
): Promise<T | undefined> =>
    withExtractedArchive(epubPath, "yomikiru-scan-epub-", async (destination) => {
        const pkg = await parseExtractedEpubDir(destination, io);
        return usePackage(pkg, destination);
    });
