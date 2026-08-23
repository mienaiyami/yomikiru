import { listMangaChapterChildren } from "@common/library/classify";
import { IMAGE_EXTS, isImageFileName } from "@common/library/formats";
import type { LibraryIo } from "@common/library/io";

/**
 * Natural-ish filename order for cover/first-image picks (numeric-aware).
 * Matches the reader list well enough for scan covers.
 */
export const compareImageNames = (a: string, b: string): number =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Series-root `cover` sidecar (with or without an image extension). Empty string when none.
 */
export const findCoverSidecar = (io: LibraryIo, dirPath: string): string => {
    const possible = ["cover", ...IMAGE_EXTS.map((ext) => `cover${ext}`)];
    for (const file of possible) {
        const filePath = io.path.join(dirPath, file);
        if (io.fs.isFile(filePath)) return filePath;
    }
    return "";
};

/**
 * Image basenames in `dir` sorted for first-page selection. Missing dirs yield [].
 */
export const listSortedImageNames = async (io: LibraryIo, dir: string): Promise<string[]> => {
    let names: string[] = [];
    try {
        names = await io.fs.readdir(dir);
    } catch {
        return [];
    }
    return names.filter((name) => isImageFileName(name, io.path.extname)).sort(compareImageNames);
};

/**
 * First image inside a manga folder: cover sidecar, then sorted images in `dir`,
 * then the first chapter subfolder's first image. Packed chapter files have no extract here.
 */
export const firstImageInMangaFolder = async (io: LibraryIo, dir: string): Promise<string | undefined> => {
    const sidecar = findCoverSidecar(io, dir);
    if (sidecar) return sidecar;
    const names = await listSortedImageNames(io, dir);
    if (names[0]) return io.path.join(dir, names[0]);
    const chapters = await listMangaChapterChildren(io, dir);
    const firstChapter = [...chapters].sort((a, b) => compareImageNames(a.name, b.name))[0];
    if (!firstChapter || io.fs.isFile(firstChapter.link)) return undefined;
    const chapterImgs = await listSortedImageNames(io, firstChapter.link);
    if (chapterImgs[0]) return io.path.join(firstChapter.link, chapterImgs[0]);
    return undefined;
};
