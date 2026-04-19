import fs from "node:fs";
import path from "node:path";
import type { CoverOpResult } from "@common/types/ipc";
import { app } from "electron";
import sharp from "sharp";
import { createMainLogger } from "./logger";

const logger = createMainLogger("util/coverMaterialize");

const MAX_EDGE = 400;
const WEBP_QUALITY = 82;

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
