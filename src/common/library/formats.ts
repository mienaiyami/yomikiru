/**
 * File-extension lists, testers, and {@link formatUtils} shared by main and renderer.
 * Testers default to {@link libraryIo} path helpers; pass `extname` / `basename` to
 * override (classify uses the per-call io).
 */

import { libraryIo } from "@common/library/io";

/** Image files the manga reader and one-shot classifier accept. */
export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", ".avif"] as const;

/** Packed manga archives (not PDF). */
export const PACKED_MANGA_EXTS = [".zip", ".cbz", ".7z", ".cb7", ".rar", ".cbr"] as const;

/** PDF manga files. */
export const PDF_EXTS = [".pdf"] as const;

/** Standalone book files the book reader can open. */
export const BOOK_EXTS = [".epub"] as const;

/** Packed manga, PDF, and EPUB — Locations / drop treat these as openable files. */
export const OPENABLE_FILE_EXTS = [...PACKED_MANGA_EXTS, ...PDF_EXTS, ...BOOK_EXTS] as const;

/**
 * Open-dialog filter shape (Electron `FileFilter` without importing Electron).
 */
export type DialogFileFilter = {
    name: string;
    extensions: string[];
};

/** `path.extname` from the process adapter (not a snapshot at module load). */
const extnameFromIo = (filePath: string): string => libraryIo().path.extname(filePath);

/** `path.basename` from the process adapter (not a snapshot at module load). */
const basenameFromIo = (filePath: string, ext?: string): string => libraryIo().path.basename(filePath, ext);

/**
 * True when `str`'s extension (via `extname`) is in `list`. Empty `str` is never a match.
 */
export const hasListedExt = (
    str: string,
    list: readonly string[],
    extname: (filePath: string) => string = extnameFromIo,
): boolean => !!str && list.includes(extname(str).toLowerCase());

/** True when `str` is an image the manga reader can show. */
export const isImageFileName = (
    str: string,
    extname: (filePath: string) => string = extnameFromIo,
): boolean => hasListedExt(str, IMAGE_EXTS, extname);

/** True when `str` is a packed manga archive. */
export const isPackedMangaFileName = (
    str: string,
    extname: (filePath: string) => string = extnameFromIo,
): boolean => hasListedExt(str, PACKED_MANGA_EXTS, extname);

/** True when `str` is a PDF. */
export const isPdfFileName = (
    str: string,
    extname: (filePath: string) => string = extnameFromIo,
): boolean => hasListedExt(str, PDF_EXTS, extname);

/** True when `str` is a packed manga archive or PDF. */
export const isMangaFileName = (
    str: string,
    extname: (filePath: string) => string = extnameFromIo,
): boolean => isPackedMangaFileName(str, extname) || isPdfFileName(str, extname);

/** True when `str` is a standalone book file. */
export const isBookFileName = (
    str: string,
    extname: (filePath: string) => string = extnameFromIo,
): boolean => hasListedExt(str, BOOK_EXTS, extname);

/**
 * Electron `FileFilter.extensions` values (no leading dot) from an extension list.
 */
export const toDialogExtensions = (extList: readonly string[]): string[] =>
    extList.map((ext) => (ext.startsWith(".") ? ext.slice(1) : ext));

/**
 * Stem of an openable archive/book file; otherwise returns `str` unchanged.
 */
export const openableFileStem = (
    str: string,
    extname: (filePath: string) => string = extnameFromIo,
    basename: (filePath: string, ext?: string) => string = basenameFromIo,
): string => {
    const ext = extname(str);
    if (!hasListedExt(str, OPENABLE_FILE_EXTS, extname)) return str;
    return basename(str, ext);
};

/**
 * Uppercase extension label for an openable archive/book file; otherwise `""`.
 */
export const openableFileExtLabel = (
    str: string,
    extname: (filePath: string) => string = extnameFromIo,
): string => {
    const ext = extname(str);
    if (!hasListedExt(str, OPENABLE_FILE_EXTS, extname)) return "";
    return ext.replace(".", "").toUpperCase();
};

/**
 * Extension testers bound to the process {@link libraryIo} path helpers.
 */
export const formatUtils = {
    image: {
        list: IMAGE_EXTS,
        test: (str: string): boolean => isImageFileName(str),
    },
    /**
     * Single-file content the Locations browser and drop handler treat as openable.
     */
    files: {
        list: OPENABLE_FILE_EXTS,
        test: (str: string): boolean => hasListedExt(str, OPENABLE_FILE_EXTS),
        getName: (str: string): string => openableFileStem(str),
        getExt: (str: string): string => openableFileExtLabel(str),
    },
    packedManga: {
        list: PACKED_MANGA_EXTS,
        test: (str: string): boolean => isPackedMangaFileName(str),
    },
    pdf: {
        list: PDF_EXTS,
        test: (str: string): boolean => isPdfFileName(str),
    },
    /**
     * Standalone book files the book reader can open.
     */
    book: {
        list: BOOK_EXTS,
        test: (str: string): boolean => isBookFileName(str),
    },
    /**
     * Single-file manga the image reader can open (packed archives + PDF).
     */
    mangaFile: {
        test: (str: string): boolean => isPackedMangaFileName(str) || isPdfFileName(str),
    },
    /** Open-dialog filters derived from the extension lists above. */
    dialogFilters: {
        book: (): DialogFileFilter[] => [{ name: "Book", extensions: toDialogExtensions(BOOK_EXTS) }],
        mangaFile: (): DialogFileFilter[] => [
            {
                name: "Manga",
                extensions: toDialogExtensions([...PACKED_MANGA_EXTS, ...PDF_EXTS]),
            },
        ],
    },
};
