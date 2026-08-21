import { formatUtils } from "./file";

/**
 * Stored `chapterName` when the library item is the opened folder or packed file
 * (one-shot and single-file manga), matching the book progress placeholder token.
 */
export const MANGA_ROOT_CHAPTER_NAME = "~";

/**
 * Normalizes a manga root or chapter path the same way as the reader does before joining.
 */
export const normalizeMangaPathSegment = (link: string): string => {
    let normalized = window.path.normalize(link);
    if (normalized[normalized.length - 1] === window.path.sep) {
        normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
};

/**
 * True when progress points at the series folder itself rather than a child chapter.
 */
export const isMangaRootChapterName = (chapterName: string): boolean =>
    chapterName === "" || chapterName === MANGA_ROOT_CHAPTER_NAME;

/**
 * Resolves the on-disk path for a chapter given the library item folder (`itemLink`) and the stored
 * chapter key (`chapterName`, i.e. direct child name under that folder).
 * Root-chapter tokens return `itemLink` (one-shot / packed file).
 */
export const resolveMangaChapterPath = (itemLink: string, chapterName: string): string => {
    const root = normalizeMangaPathSegment(itemLink);
    if (isMangaRootChapterName(chapterName)) return root;
    return window.path.join(root, chapterName);
};

/**
 * Series `link` and chapter key for an opened reader path.
 * When a catalogue row already exists at the opened path, or the path is a packed/PDF file,
 * that path is the series. Otherwise the opened path is a chapter and the series is its parent.
 */
export const resolveMangaOpenSeries = (
    openedPath: string,
    seriesLink: string | null | undefined,
): { itemLink: string; chapterName: string } => {
    const opened = normalizeMangaPathSegment(openedPath);
    if (seriesLink && normalizeMangaPathSegment(seriesLink) === opened) {
        return { itemLink: opened, chapterName: MANGA_ROOT_CHAPTER_NAME };
    }
    if (formatUtils.mangaFile.test(opened)) {
        return { itemLink: opened, chapterName: MANGA_ROOT_CHAPTER_NAME };
    }
    return { itemLink: window.path.dirname(opened), chapterName: window.path.basename(opened) };
};

/**
 * Catalogue map key for an open path: exact link first, then parent folder for chapter paths.
 * Packed/PDF and book files never fall back to dirname.
 */
export const findLibraryItemKeyForOpenPath = (
    openedPath: string,
    hasItem: (link: string) => boolean,
): string | null => {
    const opened = normalizeMangaPathSegment(openedPath);
    if (hasItem(opened)) return opened;
    if (hasItem(openedPath)) return openedPath;
    if (formatUtils.book.test(opened) || formatUtils.mangaFile.test(opened)) return null;
    const parent = window.path.dirname(opened);
    if (hasItem(parent)) return parent;
    return null;
};
