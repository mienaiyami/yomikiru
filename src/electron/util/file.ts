import fsp from "node:fs/promises";
import path from "node:path";
import { createMainLogger } from "./logger";

const log = createMainLogger("util/file");

/** Sibling suffix for a one-shot copy taken before rewriting a file in place. */
export const FILE_BACKUP_SUFFIX = ".bak";

/** Staging sibling used by {@link atomicWriteTextFile}. */
const FILE_TMP_SUFFIX = ".tmp";

/**
 * True when `filePath` exists and is accessible.
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fsp.access(filePath);
        return true;
    } catch {
        return false;
    }
};

/**
 * Writes UTF-8 `contents` via a temp sibling, then replaces `destPath`.
 * Parent directories must already exist. On Windows, replace may require
 * unlinking the destination first.
 *
 * @throws When both the first rename and the unlink-then-rename retry fail
 */
export const atomicWriteTextFile = async (destPath: string, contents: string): Promise<void> => {
    const tmpPath = `${destPath}${FILE_TMP_SUFFIX}`;
    await fsp.writeFile(tmpPath, contents, "utf8");
    try {
        await fsp.rename(tmpPath, destPath);
        return;
    } catch (renameErr) {
        log.warn("rename-over-destination failed; unlinking then retrying", { destPath, renameErr });
        if (await fileExists(destPath)) await fsp.unlink(destPath);
        await fsp.rename(tmpPath, destPath);
    }
};

/** Outcome of reading a JSON file without interpreting its schema. */
export type JsonFileLoadResult =
    | { kind: "missing" }
    | { kind: "unreadable"; err: unknown }
    | { kind: "invalidJson"; err: unknown }
    | { kind: "ok"; value: unknown };

/**
 * Reads `filePath` as JSON. Missing, unreadable, and invalid JSON are
 * distinguished so the caller can leave the file intact.
 */
export const loadJsonFile = async (filePath: string): Promise<JsonFileLoadResult> => {
    if (!(await fileExists(filePath))) return { kind: "missing" };
    let rawText: string;
    try {
        rawText = await fsp.readFile(filePath, "utf8");
    } catch (err) {
        return { kind: "unreadable", err };
    }
    try {
        return { kind: "ok", value: JSON.parse(rawText) };
    } catch (err) {
        return { kind: "invalidJson", err };
    }
};

/**
 * Pretty-prints `value` and atomically replaces `filePath`, creating parent
 * directories when needed.
 *
 * @throws When mkdir or {@link atomicWriteTextFile} fails
 */
export const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await atomicWriteTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * Copies `filePath` to a sibling with {@link FILE_BACKUP_SUFFIX} when that
 * sibling does not already exist.
 *
 * @throws When the copy fails
 */
export const backupFileIfAbsent = async (filePath: string): Promise<void> => {
    const backupPath = `${filePath}${FILE_BACKUP_SUFFIX}`;
    if (await fileExists(backupPath)) return;
    await fsp.copyFile(filePath, backupPath);
};

/**
 * Serialized JSON file on disk. Schema, ingest, and edit policy stay with the
 * caller. {@link JsonFileOwner.save} pretty-prints and atomically replaces the file.
 */
export type JsonFileOwner = {
    /**
     * Runs `work` after prior work on this file, including when the prior work
     * rejected, so two windows cannot interleave reads and writes.
     */
    enqueue: <T>(work: () => Promise<T>) => Promise<T>;
    /** {@link loadJsonFile} for this owner's path. */
    load: () => Promise<JsonFileLoadResult>;
    /** {@link writeJsonFile} for this owner's path. */
    save: (value: unknown) => Promise<void>;
    /** {@link backupFileIfAbsent} for this owner's path. */
    backupIfAbsent: () => Promise<void>;
};

/**
 * Binds {@link loadJsonFile}, {@link writeJsonFile}, and {@link backupFileIfAbsent}
 * to one path with a write queue.
 */
export const createJsonFileOwner = (filePath: string): JsonFileOwner => {
    let chain: Promise<unknown> = Promise.resolve();
    const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
        const run = chain.then(work, work);
        chain = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    };
    return {
        enqueue,
        load: () => loadJsonFile(filePath),
        save: (value) => writeJsonFile(filePath, value),
        backupIfAbsent: () => backupFileIfAbsent(filePath),
    };
};
