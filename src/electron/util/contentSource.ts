import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { type EpubArchiveMetadata, parseEpubArchiveMetadata } from "@common/epub";
import { isImageFileName, isPackedMangaFileName, isPdfFileName } from "@common/library/formats";
import { compareImageNames, firstImageInMangaFolder } from "@common/library/images";
import { type ArchiveEntry, archiveService } from "@electron/util/archive";
import { mainLibraryIo } from "@electron/util/libraryFs";
import { createMainLogger } from "@electron/util/logger";

const log = createMainLogger("contentSource");
const io = mainLibraryIo;

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
    const ext = path.extname(source).toLowerCase();
    await archiveService.extractAll(source, destination);
    if (ext !== ".epub") await flattenExtractedManga(destination, source);
    await fsp.writeFile(path.join(destination, "SOURCE"), source);
};

/** Returns the first naturally ordered image entry from an archive listing. */
const firstArchiveImage = (entries: readonly ArchiveEntry[]): ArchiveEntry | undefined =>
    entries
        .filter((entry) => !entry.isDirectory && isImageFileName(entry.path, path.extname))
        .sort((a, b) => compareImageNames(a.path, b.path))[0];

/**
 * Resolves the first image for a manga path and passes a file path or archive stream to `consumeSource`.
 * PDFs return undefined because page rendering stays in the renderer.
 */
export const withResolvedFirstImage = async <T>(
    absPath: string,
    consumeSource: (source: string | Readable) => Promise<T>,
): Promise<T | undefined> => {
    if (!fs.existsSync(absPath) || isPdfFileName(absPath, path.extname)) return undefined;
    if (io.fs.isFile(absPath) && isPackedMangaFileName(absPath, path.extname)) {
        try {
            const first = firstArchiveImage(await archiveService.listEntries(absPath));
            return first ? consumeSource(await archiveService.openEntry(absPath, first)) : undefined;
        } catch (err) {
            log.warn("archive cover read failed", { archivePath: absPath }, err);
            return undefined;
        }
    }
    if (!io.fs.isDir(absPath)) return undefined;
    const first = await firstImageInMangaFolder(io, absPath);
    return first ? consumeSource(first) : undefined;
};

/** EPUB metadata and a lazily streamed package cover for scan and manual-cover operations. */
export type EpubArchivePackage = {
    metadata: EpubArchiveMetadata;
    openCover: () => Promise<Readable | undefined>;
};

/**
 * Parses the EPUB container and OPF from archive entries without materializing the package on disk.
 */
export const withEpubArchivePackage = async <T>(
    epubPath: string,
    consumePackage: (pkg: EpubArchivePackage) => Promise<T>,
): Promise<T | undefined> => {
    try {
        const entries = await archiveService.listEntries(epubPath);
        const byPath = new Map(entries.filter((entry) => !entry.isDirectory).map((entry) => [entry.path, entry]));
        const metadata = await parseEpubArchiveMetadata({
            readText: async (entryPath) => {
                const entry = byPath.get(entryPath);
                if (!entry) throw new Error(`EPUB package entry not found: ${entryPath}`);
                const chunks: Buffer[] = [];
                for await (const chunk of await archiveService.openEntry(epubPath, entry)) {
                    chunks.push(Buffer.from(chunk));
                }
                return Buffer.concat(chunks).toString("utf-8");
            },
        });
        return consumePackage({
            metadata,
            openCover: async () => {
                const entry = metadata.coverPath ? byPath.get(metadata.coverPath) : undefined;
                return entry ? archiveService.openEntry(epubPath, entry) : undefined;
            },
        });
    } catch (err) {
        log.warn("EPUB archive metadata or cover read failed", { epubPath }, err);
        return undefined;
    }
};
