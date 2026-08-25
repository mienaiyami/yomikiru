import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Readable } from "node:stream";
import { type ManagedCoverSlot, managedCoverFileName } from "@common/library/covers";
import type { CoverOpResult } from "@common/types/ipc";
import { app } from "electron";
import { createMainLogger } from "./logger";

const logger = createMainLogger("util/coverMaterialize");

const MAX_EDGE = 400;
const WEBP_QUALITY = 82;
const SHARP_RUNTIME_RESOURCE_DIRECTORY = "sharp";

/** Loads Sharp from its explicit external runtime in packages and the dependency tree in development. */
const loadSharp = (): typeof import("sharp") => {
    const runtimeRequire = app?.isPackaged
        ? createRequire(path.join(process.resourcesPath, SHARP_RUNTIME_RESOURCE_DIRECTORY, "package.json"))
        : createRequire(__filename);
    return runtimeRequire("sharp") as typeof import("sharp");
};

const sharp = loadSharp();

/*
 * libvips must not retain source file handles because extracted archive covers
 * are deleted immediately after materialization, which Windows otherwise rejects.
 */
sharp.cache({ files: 0 });

/**
 * @returns Absolute path to the directory where cached cover WebP files are stored.
 */
export const getCoversDirectoryAbsolute = (): string => {
    return path.join(app.getPath("userData"), "covers");
};

/**
 * Absolute path under the covers directory for {@link managedCoverFileName}.
 */
export const coverFilePathForLibraryId = (libraryId: number, slot: ManagedCoverSlot = "library"): string => {
    return path.join(getCoversDirectoryAbsolute(), managedCoverFileName(libraryId, slot));
};

/**
 * Resizes to fit within {@link MAX_EDGE} (preserving aspect), encodes WebP, and writes the slot file.
 *
 * TODO: offload to a dedicated main-process worker thread when batch or large-library work becomes noticeable.
 */
const writeManagedCover = async (
    libraryId: number,
    input: string | Buffer | Readable,
    slot: ManagedCoverSlot,
): Promise<CoverOpResult> => {
    try {
        fs.mkdirSync(getCoversDirectoryAbsolute(), { recursive: true });
        const outAbs = coverFilePathForLibraryId(libraryId, slot);
        const applyWebp = (instance: ReturnType<typeof sharp>) =>
            instance
                .rotate()
                .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
                .webp({ quality: WEBP_QUALITY });
        if (typeof input === "string" || Buffer.isBuffer(input)) {
            await applyWebp(sharp(input)).toFile(outAbs);
        } else {
            await new Promise<void>((resolve, reject) => {
                const transformer = applyWebp(sharp());
                input.once("error", reject);
                transformer.once("error", reject);
                input
                    .pipe(transformer)
                    .toFile(outAbs)
                    .then(() => resolve(), reject);
            });
        }
        return { ok: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`materializeCover failed libraryId=${libraryId} slot=${slot}`, msg);
        return { ok: false, message: msg };
    }
};

/**
 * Reads a source image from disk and writes the library thumbnail slot.
 */
export const materializeCoverFromSourcePath = async (
    libraryId: number,
    sourceAbsolutePath: string,
): Promise<CoverOpResult> => {
    if (!sourceAbsolutePath.trim()) {
        return { ok: false, message: "empty source path" };
    }
    if (!fs.existsSync(sourceAbsolutePath) || !fs.statSync(sourceAbsolutePath).isFile()) {
        return { ok: false, message: "source file missing" };
    }
    return writeManagedCover(libraryId, sourceAbsolutePath, "library");
};

/**
 * Encodes a raw image buffer into a managed cover slot (tracker remote art uses {@link ManagedCoverSlot} `tracker`).
 */
export const materializeCoverFromBuffer = async (
    libraryId: number,
    bytes: ArrayBuffer,
    slot: ManagedCoverSlot,
): Promise<CoverOpResult> => {
    return writeManagedCover(libraryId, Buffer.from(new Uint8Array(bytes)), slot);
};

/**
 * Encodes an archive entry stream into the library thumbnail slot without a temp image file.
 * The source stream is consumed before this promise resolves.
 */
export const materializeCoverFromStream = async (libraryId: number, source: Readable): Promise<CoverOpResult> => {
    return writeManagedCover(libraryId, source, "library");
};
