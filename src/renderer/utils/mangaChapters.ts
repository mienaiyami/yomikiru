import {
    listMangaChapterChildren as listMangaChapterChildrenWith,
    type MangaChapterChild,
    pathIsInsideRoot as pathIsInsideRootWith,
    resolveMangaStartPath as resolveMangaStartPathWith,
} from "@common/library/classify";
import { formatUtils, rendererLibraryIo } from "./file";

export type { MangaChapterChild };
export { rendererLibraryIo };

/** No sibling in that direction; same sentinel the manga chapter-changer screen uses. */
export const CHAPTER_NAV_NONE = "~";

/** Prev/next chapter paths for the manga reader; {@link CHAPTER_NAV_NONE} means no sibling. */
export type ChapterNavSiblings = { prev: string; next: string };

/** Direction for manga prev/next chapter open. */
export type ChapterNavDirection = "prev" | "next";

/** Sort keys applied on top of a name-sorted chapter scan. */
export type MangaChapterListOrder = {
    sortBy: "name" | "date";
    inverse: boolean;
    /**
     * When set, keep this session order for links that still exist, then append
     * any scan results that were not in the session list.
     */
    shuffled?: readonly { link: string }[];
};

/** Inverse/shuffle flags and name compare used by {@link resolvePrevNextChapter}. */
export type ChapterNavResolveOptions = {
    inverseSort: boolean;
    shuffle: boolean;
    /**
     * Compares chapter sort names (file stems) when the open path is not in `list`.
     * Defaults to numeric locale compare.
     */
    compareNames?: (a: string, b: string) => number;
};

/**
 * True when `absPath` is `root` or a descendant of `root` after normalize.
 */
export const pathIsInsideRoot = (absPath: string, root: string): boolean =>
    pathIsInsideRootWith(rendererLibraryIo(), absPath, root);

/**
 * Direct children of `seriesDir` that gallery details lists as chapters.
 */
export const listMangaChapterChildren = (seriesDir: string): Promise<MangaChapterChild[]> =>
    listMangaChapterChildrenWith(rendererLibraryIo(), seriesDir);

/**
 * Reader target for an unread manga item: itself for a packed file/one-shot,
 * otherwise the first naturally name-sorted chapter below a series root.
 */
export const resolveMangaStartPath = (libraryPath: string): Promise<string | null> =>
    resolveMangaStartPathWith(rendererLibraryIo(), libraryPath);

/**
 * Chapter list used by prev/next/random. Unpinned search only filters the
 * displayed rows; navigation follows the search subset while the filter pin is on.
 */
export const selectChapterNavList = <T>(
    fullList: T[],
    filteredList: T[],
    options: { filterPinned: boolean; filterActive: boolean },
): T[] => {
    if (options.filterPinned && options.filterActive && filteredList.length > 0) {
        return filteredList;
    }
    return fullList;
};

/**
 * Applies location-list sort (name vs date, then inverse) to a name-sorted scan.
 * When `shuffled` is set, keeps that session order for links that still exist,
 * then appends scan results that were not in the session list.
 */
export const orderMangaChapterList = <T extends { dateModified: number; link: string }>(
    chapters: readonly T[],
    options: MangaChapterListOrder,
): T[] => {
    const byDateOrKeep = [...chapters].sort((a, b) =>
        options.sortBy === "date" ? a.dateModified - b.dateModified : 0,
    );
    const ordered = options.inverse ? byDateOrKeep.reverse() : byDateOrKeep;
    if (!options.shuffled) return ordered;
    const byLink = new Map(chapters.map((c) => [c.link, c]));
    const present: T[] = [];
    const seen = new Set<string>();
    for (const s of options.shuffled) {
        const item = byLink.get(s.link);
        if (item) {
            present.push(item);
            seen.add(item.link);
        }
    }
    for (const item of ordered) {
        if (!seen.has(item.link)) present.push(item);
    }
    return present.length > 0 ? present : ordered;
};

/** Fisher-Yates shuffle. Returns a new array. */
export const shuffleArray = <T>(arr: readonly T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

/**
 * True when `p` is a chapter folder or packed/PDF file that still exists on disk.
 */
export const mangaChapterPathExists = (p: string): boolean => {
    if (!p || p === CHAPTER_NAV_NONE) return false;
    if (!window.fs.existsSync(p)) return false;
    if (window.fs.isDir(p)) return true;
    return formatUtils.mangaFile.test(p);
};

const defaultCompareNames = (a: string, b: string): number =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** Sort name for prev/next insertion: stem of the chapter path basename. */
const chapterNavSortName = (link: string): string => formatUtils.files.getName(window.path.basename(link));

const noneSiblings = (): ChapterNavSiblings => ({
    prev: CHAPTER_NAV_NONE,
    next: CHAPTER_NAV_NONE,
});

/**
 * Inverse name/date sort swaps the pair so "next" follows reading order, not list order.
 * Shuffle keeps the list's existing order.
 */
const applyInverseNavSwap = (
    prevCh: string,
    nextCh: string,
    options: { inverseSort: boolean; shuffle: boolean },
): ChapterNavSiblings => {
    if (options.inverseSort && !options.shuffle) {
        return { prev: nextCh, next: prevCh };
    }
    return { prev: prevCh, next: nextCh };
};

/**
 * Prev/next for a path that is no longer in `list` (renamed or deleted). Neighbors
 * are the items that would sit before/after that name in name-sorted order.
 */
const siblingsFromNameInsertion = (
    list: readonly { link: string }[],
    currentLink: string,
    options: ChapterNavResolveOptions,
): ChapterNavSiblings => {
    const compareNames = options.compareNames ?? defaultCompareNames;
    const currentName = chapterNavSortName(currentLink);
    const byName = [...list].sort((a, b) => compareNames(chapterNavSortName(a.link), chapterNavSortName(b.link)));
    let insertAt = byName.length;
    for (let i = 0; i < byName.length; i++) {
        if (compareNames(currentName, chapterNavSortName(byName[i].link)) < 0) {
            insertAt = i;
            break;
        }
    }
    const prevCh = insertAt === 0 ? CHAPTER_NAV_NONE : byName[insertAt - 1].link;
    const nextCh = insertAt >= byName.length ? CHAPTER_NAV_NONE : byName[insertAt].link;
    return applyInverseNavSwap(prevCh, nextCh, options);
};

/**
 * Prev/next chapter paths for the open item in `list`. Inverse name/date sort
 * swaps the pair; shuffle keeps the list's existing order.
 *
 * When `currentLink` is not in `list`, neighbors come from where that name would
 * sort among list names so a renamed sibling is still reachable.
 */
export const resolvePrevNextChapter = (
    list: readonly { link: string }[],
    currentLink: string,
    options: ChapterNavResolveOptions,
): ChapterNavSiblings => {
    if (!currentLink || list.length === 0) {
        return noneSiblings();
    }
    const index = list.findIndex((item) => item.link === currentLink);
    if (index < 0) {
        return siblingsFromNameInsertion(list, currentLink, options);
    }
    const prevCh = index === 0 ? CHAPTER_NAV_NONE : list[index - 1].link;
    const nextCh = index >= list.length - 1 ? CHAPTER_NAV_NONE : list[index + 1].link;
    return applyInverseNavSwap(prevCh, nextCh, options);
};

const siblingInDirection = (
    list: readonly { link: string }[],
    currentLink: string,
    direction: ChapterNavDirection,
    options: ChapterNavResolveOptions,
): string => {
    const pair = resolvePrevNextChapter(list, currentLink, options);
    return direction === "next" ? pair.next : pair.prev;
};

/**
 * Path to open for prev/next. If the current chapter or the planned sibling is
 * missing on disk, `refreshList` runs and siblings are computed again (name-order
 * insertion when the current path is gone). Does not return a path that fails
 * `pathExists`.
 */
export const pickChapterNavOpenPath = async (
    args: {
        list: readonly { link: string }[];
        currentLink: string;
        direction: ChapterNavDirection;
        pathExists: (p: string) => boolean;
        refreshList: () => Promise<readonly { link: string }[]>;
    } & ChapterNavResolveOptions,
): Promise<string> => {
    const options: ChapterNavResolveOptions = {
        inverseSort: args.inverseSort,
        shuffle: args.shuffle,
        compareNames: args.compareNames,
    };
    const currentMissing = Boolean(args.currentLink) && !args.pathExists(args.currentLink);
    let planned = siblingInDirection(args.list, args.currentLink, args.direction, options);
    const targetMissing = planned !== CHAPTER_NAV_NONE && !args.pathExists(planned);

    let list = args.list;
    if (currentMissing || targetMissing) {
        list = await args.refreshList();
        planned = siblingInDirection(list, args.currentLink, args.direction, options);
    }

    if (planned === CHAPTER_NAV_NONE || !args.pathExists(planned)) {
        return CHAPTER_NAV_NONE;
    }
    return planned;
};
