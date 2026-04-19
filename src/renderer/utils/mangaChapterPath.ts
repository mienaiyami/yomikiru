/**
 * Normalizes a manga root or chapter path the same way as the reader does before joining.
 */
export function normalizeMangaPathSegment(link: string): string {
    let normalized = window.path.normalize(link);
    if (normalized[normalized.length - 1] === window.path.sep) {
        normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
}

/**
 * Resolves the on-disk path for a chapter given the library item folder (`itemLink`) and the stored chapter key (`chapterName`, i.e. direct child name under that folder).
 */
export function resolveMangaChapterPath(itemLink: string, chapterName: string): string {
    const root = normalizeMangaPathSegment(itemLink);
    return window.path.join(root, chapterName);
}
