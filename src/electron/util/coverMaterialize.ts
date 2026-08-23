import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Readable } from "node:stream";
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
 * @returns Absolute path to the canonical materialized WebP file for a given library row id.
 */
export const coverFilePathForLibraryId = (libraryId: number): string => {
    return path.join(getCoversDirectoryAbsolute(), `${libraryId}.webp`);
};

/**
 * Reads a source image from disk, resizes to fit within {@link MAX_EDGE} (preserving aspect), encodes WebP, and writes `userData/covers/<libraryId>.webp`.
 *
 * TODO: offload to a dedicated main-process worker thread when batch or large-library work becomes noticeable.
 */
export const materializeCoverFromSourcePath = async (
    libraryId: number,
    sourceAbsolutePath: string,
): Promise<CoverOpResult> => {
    try {
        if (!sourceAbsolutePath.trim()) {
            return { ok: false, message: "empty source path" };
        }
        if (!fs.existsSync(sourceAbsolutePath) || !fs.statSync(sourceAbsolutePath).isFile()) {
            return { ok: false, message: "source file missing" };
        }
        fs.mkdirSync(getCoversDirectoryAbsolute(), { recursive: true });
        const outAbs = coverFilePathForLibraryId(libraryId);
        await sharp(sourceAbsolutePath)
            .rotate()
            .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toFile(outAbs);
        return { ok: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`materializeCover failed libraryId=${libraryId} src="${sourceAbsolutePath}"`, msg);
        return { ok: false, message: msg };
    }
};

/**
 * Encodes an archive entry stream into the persistent cover cache without creating a temp image file.
 * The source stream is consumed before this promise resolves.
 */
export const materializeCoverFromStream = async (libraryId: number, source: Readable): Promise<CoverOpResult> => {
    try {
        fs.mkdirSync(getCoversDirectoryAbsolute(), { recursive: true });
        const outAbs = coverFilePathForLibraryId(libraryId);
        await new Promise<void>((resolve, reject) => {
            const transformer = sharp()
                .rotate()
                .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
                .webp({ quality: WEBP_QUALITY });
            source.once("error", reject);
            transformer.once("error", reject);
            source
                .pipe(transformer)
                .toFile(outAbs)
                .then(() => resolve(), reject);
        });
        return { ok: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`materializeCover stream failed libraryId=${libraryId}`, msg);
        return { ok: false, message: msg };
    }
};
