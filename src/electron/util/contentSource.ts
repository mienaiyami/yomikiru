import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { isPackedMangaFileName, isPdfFileName } from "@common/library/formats";
import { firstImageInMangaFolder } from "@common/library/images";
import { mainLibraryIo } from "@electron/util/libraryFs";
import { createMainLogger } from "@electron/util/logger";
import * as crossZip from "cross-zip";

const log = createMainLogger("contentSource");
const io = mainLibraryIo;
const unzip = promisify(crossZip.unzip);

/**
 * Unzips a packed manga archive to a temp dir, returns the first sorted image, then deletes the temp.
 * RAR/CBR are skipped (need WinRAR on PATH); those stay coverless until opened in the reader.
 *
 * ponytail: zip/cbz/7z via cross-zip only; upgrade: share ipc/fs unzip (unrar + flatten).
 */
export const firstImageInPackedManga = async (archivePath: string): Promise<string | undefined> => {
    const ext = path.extname(archivePath).toLowerCase();
    if (ext === ".rar" || ext === ".cbr") return undefined;
    const dest = await fsp.mkdtemp(path.join(os.tmpdir(), "yomikiru-scan-cover-"));
    try {
        await unzip(archivePath, dest);
        return await firstImageInMangaFolder(io, dest);
    } catch (err) {
        log.warn("packed manga cover extract failed", { archivePath }, err);
        return undefined;
    } finally {
        await fsp.rm(dest, { recursive: true, force: true }).catch((err) => {
            log.warn("packed manga cover temp cleanup failed", { dest }, err);
        });
    }
};

/**
 * Source image for `covers:materialize` from a catalogue manga path.
 * PDFs return undefined (lazy first-page render in the gallery). Missing paths return undefined.
 */
export const resolveFirstImage = async (absPath: string): Promise<string | undefined> => {
    if (!fs.existsSync(absPath)) return undefined;
    if (isPdfFileName(absPath, path.extname)) return undefined;
    if (io.fs.isFile(absPath) && isPackedMangaFileName(absPath, path.extname)) {
        return firstImageInPackedManga(absPath);
    }
    if (io.fs.isDir(absPath)) return firstImageInMangaFolder(io, absPath);
    return undefined;
};
