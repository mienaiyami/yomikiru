import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { PassThrough, type Readable } from "node:stream";
import { app } from "electron";

/** Resource directory containing the target-specific 7-Zip runtime in packaged builds. */
const ARCHIVE_BINARY_RESOURCE_DIRECTORY = "7zip";

/** Archives must not make the scanner retain unbounded technical listing output. */
const MAX_LIST_OUTPUT_BYTES = 16 * 1024 * 1024;

/** Identifies ASCII control characters that make an archive-internal path unsafe. */
const hasControlCharacter = (value: string): boolean =>
    [...value].some((character) => character.charCodeAt(0) < 32);

/** One file recorded by the full 7-Zip technical listing command. */
export type ArchiveEntry = {
    path: string;
    isDirectory: boolean;
    size: number;
};

/** Optional cancellation shared by archive reads that run for a user-visible operation. */
export type ArchiveOperationOptions = {
    signal?: AbortSignal;
};

type ArchiveProcess = ChildProcessWithoutNullStreams;

type SpawnArchiveProcess = (
    args: string[],
    options?: ArchiveOperationOptions & { cwd?: string },
) => ArchiveProcess;

/**
 * Main-process archive module for all packed reading formats.
 * Its interface deliberately exposes only listing, exact-entry streaming, and full extraction.
 */
export type ArchiveService = {
    listEntries: (archivePath: string, options?: ArchiveOperationOptions) => Promise<ArchiveEntry[]>;
    openEntry: (archivePath: string, entry: ArchiveEntry, options?: ArchiveOperationOptions) => Promise<Readable>;
    extractAll: (archivePath: string, destination: string, options?: ArchiveOperationOptions) => Promise<void>;
    createZip: (
        sourceDirectory: string,
        destinationPath: string,
        options?: ArchiveOperationOptions,
    ) => Promise<void>;
};

/** Maps the current operating system to the directory published by `7zip-bin-full`. */
const archivePackagePlatform = (): string => {
    if (process.platform === "win32") return "win";
    if (process.platform === "darwin") return "mac";
    return "linux";
};

/** Returns the target-specific packaged executable, or the dependency binary while developing. */
const archiveBinaryPath = (): string => {
    const executable = process.platform === "win32" ? "7z.exe" : "7zz";
    if (!app?.isPackaged) {
        const applicationRoot = app?.getAppPath?.() ?? process.cwd();
        return path.join(
            applicationRoot,
            "node_modules",
            "7zip-bin-full",
            archivePackagePlatform(),
            process.arch,
            executable,
        );
    }
    return path.join(process.resourcesPath, ARCHIVE_BINARY_RESOURCE_DIRECTORY, process.arch, executable);
};

/** Rejects archive-internal paths that cannot safely identify one listed entry. */
const canonicalArchiveEntryPath = (entryPath: string): string => {
    const normalized = entryPath.replace(/\\/g, "/").replace(/\/+$/, "");
    if (
        !normalized ||
        normalized.startsWith("/") ||
        normalized.split("/").some((part) => !part || part === "." || part === ".." || hasControlCharacter(part))
    ) {
        throw new Error("archive entry path is unsafe");
    }
    return normalized;
};

/** Parses one entry block from 7-Zip's stable `-slt` key/value output. */
const parseListingEntry = (block: string): ArchiveEntry | undefined => {
    const values = new Map(
        block
            .split(/\r?\n/)
            .map((line) => line.match(/^([^=]+) = (.*)$/))
            .filter((match): match is RegExpMatchArray => Boolean(match))
            .map((match) => [match[1].trim(), match[2]]),
    );
    const rawPath = values.get("Path");
    if (!rawPath) return undefined;
    const entryPath = canonicalArchiveEntryPath(rawPath);
    const attributes = values.get("Attributes") ?? "";
    const isDirectory = attributes.includes("D") || rawPath.endsWith("/") || rawPath.endsWith("\\");
    const parsedSize = Number(values.get("Size") ?? "0");
    return {
        path: entryPath,
        isDirectory,
        size: Number.isSafeInteger(parsedSize) && parsedSize >= 0 ? parsedSize : 0,
    };
};

/** Parses the per-file section of a full 7-Zip technical archive listing. */
const parseTechnicalListing = (output: string): ArchiveEntry[] => {
    const entriesSection = output.includes("----------")
        ? output.slice(output.indexOf("----------") + 10)
        : output;
    const entries: ArchiveEntry[] = [];
    for (const block of entriesSection.split(/(?:\r?\n){2,}/)) {
        const entry = parseListingEntry(block.trim());
        if (entry) entries.push(entry);
    }
    return entries;
};

/** Builds a child process that is cancelled when the owning archive operation is cancelled. */
const createProcessSpawner = (): SpawnArchiveProcess => (args, options) => {
    const child = spawn(archiveBinaryPath(), args, { cwd: options?.cwd, shell: false, windowsHide: true });
    const abort = (): void => {
        child.kill();
    };
    if (options?.signal?.aborted) abort();
    else options?.signal?.addEventListener("abort", abort, { once: true });
    child.once("close", () => options?.signal?.removeEventListener("abort", abort));
    return child;
};

/** Converts a failed 7-Zip process into an operation error with its diagnostic output. */
const processError = (operation: string, exitCode: number | null, stderr: string): Error =>
    new Error(
        `${operation} failed${exitCode === null ? "" : ` (${exitCode})`}: ${stderr.trim() || "7-Zip returned no detail"}`,
    );

/** Waits for a 7-Zip command that writes no application data to stdout. */
const waitForProcess = async (child: ArchiveProcess, operation: string): Promise<void> =>
    new Promise((resolve, reject) => {
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.once("error", reject);
        child.once("close", (code) => {
            if (code === 0) resolve();
            else reject(processError(operation, code, stderr));
        });
    });

/**
 * Creates the archive module used by readers, scans, and archive-backed imports.
 * The optional process spawner is an internal seam for deterministic failure tests.
 */
export const createArchiveService = (
    spawnProcess: SpawnArchiveProcess = createProcessSpawner(),
): ArchiveService => {
    /** Lists validated entries without extracting archive contents to disk. */
    const listEntries = async (
        archivePath: string,
        options?: ArchiveOperationOptions,
    ): Promise<ArchiveEntry[]> => {
        await fs.access(archivePath);
        const child = spawnProcess(["l", "-slt", "-ba", "-sccUTF-8", "--", archivePath], options);
        let output = "";
        let stderr = "";
        child.stdout.on("data", (chunk: Buffer) => {
            output += chunk.toString();
            if (Buffer.byteLength(output) > MAX_LIST_OUTPUT_BYTES) child.kill();
        });
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        await new Promise<void>((resolve, reject) => {
            child.once("error", reject);
            child.once("close", (code) => {
                if (Buffer.byteLength(output) > MAX_LIST_OUTPUT_BYTES) {
                    reject(new Error("archive entry listing exceeds the supported limit"));
                } else if (code === 0) {
                    resolve();
                } else {
                    reject(processError("archive listing", code, stderr));
                }
            });
        });
        return parseTechnicalListing(output);
    };

    /** Streams one previously listed entry, preserving backpressure for Sharp and other consumers. */
    const openEntry = async (
        archivePath: string,
        entry: ArchiveEntry,
        options?: ArchiveOperationOptions,
    ): Promise<Readable> => {
        await fs.access(archivePath);
        if (entry.isDirectory) throw new Error("archive directory entries cannot be streamed");
        const entryPath = canonicalArchiveEntryPath(entry.path);
        const child = spawnProcess(["x", "-so", "-bd", "-y", "--", archivePath, entryPath], options);
        const output = new PassThrough();
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.once("error", (error) => output.destroy(error));
        child.once("close", (code) => {
            if (code !== 0) output.destroy(processError("archive entry extraction", code, stderr));
        });
        child.stdout.pipe(output);
        return output;
    };

    /** Extracts the complete archive into an empty reader cache directory. */
    const extractAll = async (
        archivePath: string,
        destination: string,
        options?: ArchiveOperationOptions,
    ): Promise<void> => {
        await fs.access(archivePath);
        // list first so malformed paths are rejected before 7-Zip writes into the destination
        await listEntries(archivePath, options);
        await fs.rm(destination, { recursive: true, force: true });
        await fs.mkdir(destination, { recursive: true });
        await waitForProcess(
            spawnProcess(["x", "-y", "-bd", `-o${destination}`, "--", archivePath], options),
            "archive extraction",
        );
    };

    /** Creates a ZIP archive from a directory after its caller has validated the export content. */
    const createZip = async (
        sourceDirectory: string,
        destinationPath: string,
        options?: ArchiveOperationOptions,
    ): Promise<void> => {
        const source = await fs.stat(sourceDirectory);
        if (!source.isDirectory()) throw new Error("ZIP source must be a directory");
        await waitForProcess(
            spawnProcess(["a", "-tzip", "-y", "-bd", destinationPath, "."], { ...options, cwd: sourceDirectory }),
            "ZIP creation",
        );
    };

    return { listEntries, openEntry, extractAll, createZip };
};

/** Process-wide archive module used by Electron main-process content operations. */
export const archiveService = createArchiveService();
