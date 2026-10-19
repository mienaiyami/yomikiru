import { resolveLibraryRealPath } from "@common/library/classify";
import { formatUtils, rendererLibraryIo } from "./file";

/**
 * Stored `chapterName` when progress addresses the library item itself rather than a child.
 * Current manga folders and legacy archive rows use this token, matching the book placeholder.
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
 * Root-chapter tokens return `itemLink` for one-shots and legacy records.
 */
export const resolveMangaChapterPath = (itemLink: string, chapterName: string): string => {
    const root = normalizeMangaPathSegment(itemLink);
    if (isMangaRootChapterName(chapterName)) return root;
    return window.path.join(root, chapterName);
};

/**
 * Series `link` and chapter key for an opened reader path.
 * Packed manga always belongs to its direct parent so archive chapters and folder chapters
 * share one progress identity. The root token remains for an opened manga folder and legacy data.
 * Opening through a symlink matches a catalogue row stored as {@link resolveLibraryRealPath}.
 */
export const resolveMangaOpenSeries = (
    openedPath: string,
    seriesLink: string | null | undefined,
): { itemLink: string; chapterName: string } => {
    const opened = normalizeMangaPathSegment(openedPath);
    const series = seriesLink ? normalizeMangaPathSegment(seriesLink) : null;
    const io = rendererLibraryIo();
    if (series && !formatUtils.mangaFile.test(opened)) {
        if (series === opened || resolveLibraryRealPath(io, series) === resolveLibraryRealPath(io, opened)) {
            return { itemLink: series, chapterName: MANGA_ROOT_CHAPTER_NAME };
        }
    }
    const openedParent = window.path.dirname(opened);
    if (
        series &&
        (openedParent === series ||
            resolveLibraryRealPath(io, openedParent) === resolveLibraryRealPath(io, series))
    ) {
        return { itemLink: series, chapterName: window.path.basename(opened) };
    }
    return { itemLink: openedParent, chapterName: window.path.basename(opened) };
};

/**
 * Catalogue map key for an open path: prefer a containing manga series, then an exact link.
 * This keeps an archive chapter from replacing an established parent series in the reader.
 * Lexical keys and {@link resolveLibraryRealPath} keys are both tried.
 */
export const findLibraryItemKeyForOpenPath = (
    openedPath: string,
    hasItem: (link: string) => boolean,
): string | null => {
    const opened = normalizeMangaPathSegment(openedPath);
    const parent = window.path.dirname(opened);
    const io = rendererLibraryIo();
    const openedReal = resolveLibraryRealPath(io, opened);
    const parentReal = resolveLibraryRealPath(io, parent);
    if (formatUtils.mangaFile.test(opened) && (hasItem(parent) || hasItem(parentReal))) {
        return hasItem(parent) ? parent : parentReal;
    }
    if (hasItem(opened)) return opened;
    if (hasItem(openedReal)) return openedReal;
    if (hasItem(openedPath)) return openedPath;
    if (formatUtils.book.test(opened)) return null;
    if (hasItem(parent)) return parent;
    if (hasItem(parentReal)) return parentReal;
    return null;
};
