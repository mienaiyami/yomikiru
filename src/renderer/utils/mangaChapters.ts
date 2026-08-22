import { formatUtils } from "@utils/file";
import { normalizeMangaPathSegment } from "@utils/mangaChapterPath";

/**
 * Hard cap on grouping-folder recursion for {@link collectLibraryScanTargets},
 * regardless of the caller `maxDepth`. Skip regex, ignore sentinels, and extra
 * library-folder roots cut the walk earlier; this ceiling is the last bound.
 */
export const LIBRARY_SCAN_MAX_DEPTH_CEILING = 12;

/**
 * Default grouping-folder steps for a new extra library folder.
 * The walk ceiling stays {@link LIBRARY_SCAN_MAX_DEPTH_CEILING}.
 */
export const LIBRARY_SCAN_DEFAULT_MAX_DEPTH = 2;

/**
 * Directory or file basenames (case-insensitive) that mark a library-scan skip.
 * A matching file inside a directory skips that directory; a matching folder skips only itself.
 */
export const LIBRARY_SCAN_IGNORE_SENTINEL_NAMES = ["yomikiru-ignore", ".yomikiru-ignore"] as const;

const LIBRARY_SCAN_IGNORE_SENTINEL_KEYS = new Set(
    LIBRARY_SCAN_IGNORE_SENTINEL_NAMES.map((name) => name.toLowerCase()),
);

/**
 * Clamps a grouping-folder walk depth to `0`..{@link LIBRARY_SCAN_MAX_DEPTH_CEILING}.
 * Used by Settings inputs and by scan-root builders before classify.
 */
export const clampLibraryScanMaxDepth = (value: number): number =>
    Math.min(LIBRARY_SCAN_MAX_DEPTH_CEILING, Math.max(0, Math.round(value)));

/** How {@link classifyLibraryNode} labels a file or directory. */
export type LibraryNodeKind = "series" | "oneshot" | "grouping" | "packedManga" | "book" | "skip";

/** Result of {@link classifyLibraryNode}. `path` is normalized. */
export type ClassifiedLibraryNode = {
    kind: LibraryNodeKind;
    path: string;
};

/**
 * Result of compiling a per-root skip pattern from settings.
 * `empty` means no skip-from-regex; `invalid` must be treated as match-nothing.
 */
export type LibraryScanSkipRegexCompile =
    | { status: "empty" }
    | { status: "invalid" }
    | { status: "ok"; regex: RegExp };

/**
 * Direct child of a manga series folder that gallery details lists as a chapter.
 * Packed files keep `pages` at 0 (not scanned).
 */
export type MangaChapterChild = {
    name: string;
    link: string;
    dateModified: number;
    pages: number;
};

/** What {@link collectLibraryScanTargets} may add to the catalogue. */
export type LibraryScanTarget = {
    type: "manga" | "book";
    path: string;
};

export type CollectLibraryScanTargetsOpts = {
    /** Which file kinds this root is allowed to contribute. */
    content: "manga" | "book" | "both";
    /** Grouping-folder steps from the root (capped by {@link LIBRARY_SCAN_MAX_DEPTH_CEILING}). */
    maxDepth: number;
    /** Normalized library `link` values that must not be emitted again. */
    existingLinks: ReadonlySet<string>;
    /**
     * Other library-folder (or Default Location) paths this walk must not enter.
     * Compared after normalize; the current root is never listed here by callers.
     */
    skipRoots?: readonly string[];
    /**
     * Compiled per-root skip pattern. Tested against descendant basenames only,
     * never the scan root's own name. Omit or pass `null` for no regex skip.
     */
    skipRegex?: RegExp | null;
    /**
     * Called with the directory currently being listed. Throttled by the caller
     * when driving title-bar status.
     */
    onWalkProgress?: (currentPath: string) => void;
};

/**
 * Compiles a user skip pattern for {@link shouldSkipLibraryScanEntry}.
 * A blank pattern is not a skip. Invalid syntax is reported so Settings can
 * show an error while the walk treats it as match-nothing.
 */
export const compileLibraryScanSkipRegex = (pattern: string): LibraryScanSkipRegexCompile => {
    const trimmed = pattern.trim();
    if (!trimmed) return { status: "empty" };
    try {
        return { status: "ok", regex: new RegExp(trimmed, "i") };
    } catch {
        return { status: "invalid" };
    }
};

/**
 * True when `basename` matches a compiled skip regex. `regex` of `null` never skips.
 */
export const shouldSkipLibraryScanEntry = (basename: string, regex: RegExp | null | undefined): boolean => {
    if (!regex) return false;
    return regex.test(basename);
};

/**
 * True when `name` matches {@link LIBRARY_SCAN_IGNORE_SENTINEL_NAMES}, case-insensitive.
 */
export const isLibraryScanIgnoreName = (name: string): boolean =>
    LIBRARY_SCAN_IGNORE_SENTINEL_KEYS.has(name.toLowerCase());

/**
 * True when `absPath` is `root` or a descendant of `root` after normalize.
 */
export const pathIsInsideRoot = (absPath: string, root: string): boolean => {
    const a = normalizeMangaPathSegment(absPath);
    const r = normalizeMangaPathSegment(root);
    if (a === r) return true;
    const rel = window.path.relative(r, a);
    return rel !== "" && !rel.startsWith("..") && !window.path.isAbsolute(rel);
};

/**
 * True when `fileName` is a series-root cover sidecar (`cover` plus optional image ext),
 * matching {@link findCover} naming. Used to ignore covers when deciding one-shot vs series.
 */
export const isMangaSeriesCoverFileName = (fileName: string): boolean => {
    const base = window.path.basename(fileName);
    const ext = window.path.extname(base);
    const stem = ext ? window.path.basename(base, ext) : base;
    return stem.toLowerCase() === "cover";
};

const allowsManga = (content: CollectLibraryScanTargetsOpts["content"]): boolean =>
    content === "manga" || content === "both";

const allowsBook = (content: CollectLibraryScanTargetsOpts["content"]): boolean =>
    content === "book" || content === "both";

const skipRootsNormalized = (skipRoots: readonly string[] | undefined): string[] =>
    (skipRoots ?? []).map((root) => normalizeMangaPathSegment(root)).filter(Boolean);

const isUnderSkipRoot = (absPath: string, skipRoots: readonly string[]): boolean => {
    const a = normalizeMangaPathSegment(absPath);
    return skipRoots.some((root) => pathIsInsideRoot(a, root));
};

/**
 * True when `dir` has a direct child *file* named as an ignore sentinel.
 */
const dirHasIgnoreSentinelFile = async (dir: string): Promise<boolean> => {
    let names: string[] = [];
    try {
        names = await window.fs.readdir(dir);
    } catch {
        return false;
    }
    for (const name of names) {
        if (!isLibraryScanIgnoreName(name)) continue;
        const child = window.path.join(dir, name);
        if (window.fs.isFile(child)) return true;
    }
    return false;
};

/**
 * Direct children of `seriesDir` that are readable chapters: image-bearing folders
 * or packed/PDF files. Root image files (including covers) are omitted; empty dirs too.
 * Ignore-sentinel names are never chapters.
 */
export const listMangaChapterChildren = async (seriesDir: string): Promise<MangaChapterChild[]> => {
    const root = normalizeMangaPathSegment(seriesDir);
    if (!window.fs.existsSync(root) || !window.fs.isDir(root)) return [];

    const names = await window.fs.readdir(root);
    const out: MangaChapterChild[] = [];
    for (const fileName of names) {
        if (isLibraryScanIgnoreName(fileName)) continue;
        const filePath = window.path.join(root, fileName);
        try {
            await window.fs.access(filePath, window.fs.constants.R_OK);
        } catch {
            continue;
        }

        if (window.fs.isFile(filePath)) {
            if (!formatUtils.mangaFile.test(fileName)) continue;
            const st = await window.fs.stat(filePath);
            out.push({ name: fileName, link: filePath, dateModified: st.mtimeMs, pages: 0 });
            continue;
        }

        if (!window.fs.isDir(filePath)) continue;
        let pages = 0;
        try {
            const kids = await window.fs.readdir(filePath);
            pages = kids.filter((f) => formatUtils.image.test(f)).length;
        } catch {
            continue;
        }
        if (pages <= 0) continue;
        const st = await window.fs.stat(filePath);
        out.push({ name: fileName, link: filePath, dateModified: st.mtimeMs, pages });
    }
    return out;
};

const classifyFile = (normalized: string): LibraryNodeKind => {
    if (formatUtils.book.test(normalized)) return "book";
    if (formatUtils.mangaFile.test(normalized)) return "packedManga";
    return "skip";
};

/**
 * True when `dir` has nested directories or book/packed files, so the parent should keep
 * walking instead of treating image-folder siblings as its only chapters.
 */
const dirLooksLikeGrouping = async (dir: string): Promise<boolean> => {
    let names: string[] = [];
    try {
        names = await window.fs.readdir(dir);
    } catch {
        return false;
    }
    for (const name of names) {
        if (isLibraryScanIgnoreName(name)) continue;
        const child = window.path.join(dir, name);
        if (window.fs.isDir(child)) return true;
        if (window.fs.isFile(child) && (formatUtils.book.test(name) || formatUtils.mangaFile.test(name))) {
            return true;
        }
    }
    return false;
};

/**
 * Labels `absPath` as a manga series, one-shot, grouping folder, packed file, book, or skip.
 * A series has listable chapter children and no extra grouping subdirs. Cover sidecars do not
 * make a folder a one-shot. Mixed chapter-like + grouping children stay a grouping so nested
 * series are not swallowed. Ignore-sentinel children are not counted.
 */
export const classifyLibraryNode = async (absPath: string): Promise<ClassifiedLibraryNode> => {
    const normalized = normalizeMangaPathSegment(absPath);
    if (!window.fs.existsSync(normalized)) return { kind: "skip", path: normalized };

    if (window.fs.isFile(normalized)) {
        return { kind: classifyFile(normalized), path: normalized };
    }
    if (!window.fs.isDir(normalized)) return { kind: "skip", path: normalized };

    const names = await window.fs.readdir(normalized);
    const chapters = await listMangaChapterChildren(normalized);
    const chapterNames = new Set(chapters.map((c) => c.name));
    let pageImages = 0;
    let subdirs = 0;
    let groupingShaped = 0;
    for (const fileName of names) {
        if (isLibraryScanIgnoreName(fileName)) continue;
        const child = window.path.join(normalized, fileName);
        if (window.fs.isDir(child)) {
            subdirs += 1;
            if (!chapterNames.has(fileName) && (await dirLooksLikeGrouping(child))) groupingShaped += 1;
            continue;
        }
        if (window.fs.isFile(child) && formatUtils.image.test(fileName) && !isMangaSeriesCoverFileName(fileName)) {
            pageImages += 1;
        }
    }
    /*
     * Chapter-like children plus other subdirs (nested series, empty folders) is a grouping
     * so a sibling oneshot does not swallow the rest of the tree as one series.
     * Only-oneshot children still count as a packed series (Ch01, Ch02). A library
     * root that is only oneshot folders is one series item, not N oneshots.
     */
    if (chapters.length > 0 && groupingShaped === 0) return { kind: "series", path: normalized };
    if (pageImages > 0 && chapters.length === 0) return { kind: "oneshot", path: normalized };
    if (subdirs > 0 || chapters.length > 0) return { kind: "grouping", path: normalized };
    return { kind: "skip", path: normalized };
};

const emitTarget = (
    node: ClassifiedLibraryNode,
    opts: CollectLibraryScanTargetsOpts,
    out: LibraryScanTarget[],
): void => {
    if (opts.existingLinks.has(node.path)) return;
    if (node.kind === "series" && allowsManga(opts.content)) {
        out.push({ type: "manga", path: node.path });
        return;
    }
    if (node.kind === "packedManga" && allowsManga(opts.content)) {
        out.push({ type: "manga", path: node.path });
        return;
    }
    if (node.kind === "book" && allowsBook(opts.content)) {
        out.push({ type: "book", path: node.path });
        return;
    }
    if (node.kind === "oneshot" && allowsManga(opts.content)) {
        out.push({ type: "manga", path: node.path });
    }
};

/**
 * True when this walk must not classify or recurse into `absPath`.
 * The scan root itself is never skipped for regex or ignore-folder name.
 */
const shouldSkipScanSubtree = async (
    absPath: string,
    name: string,
    opts: {
        skipRoots: readonly string[];
        skipRegex: RegExp | null | undefined;
        isWalkRoot: boolean;
    },
): Promise<boolean> => {
    if (!opts.isWalkRoot && isLibraryScanIgnoreName(name) && window.fs.isDir(absPath)) return true;
    if (!opts.isWalkRoot && isUnderSkipRoot(absPath, opts.skipRoots)) return true;
    if (!opts.isWalkRoot && shouldSkipLibraryScanEntry(name, opts.skipRegex)) return true;
    if (window.fs.isDir(absPath) && (await dirHasIgnoreSentinelFile(absPath))) return true;
    return false;
};

/**
 * Walks `root` for catalogue paths. Recurses grouping and skip dirs (epubs in otherwise-empty
 * folders); does not enter series or oneshot folders. Skip regex, ignore sentinels, and
 * {@link CollectLibraryScanTargetsOpts.skipRoots} prune whole subtrees.
 */
export const collectLibraryScanTargets = async (
    root: string,
    opts: CollectLibraryScanTargetsOpts,
): Promise<LibraryScanTarget[]> => {
    const normalizedRoot = normalizeMangaPathSegment(root);
    const remaining = Math.min(Math.max(0, opts.maxDepth), LIBRARY_SCAN_MAX_DEPTH_CEILING);
    const out: LibraryScanTarget[] = [];
    const skipRoots = skipRootsNormalized(opts.skipRoots);

    if (!window.fs.existsSync(normalizedRoot)) return out;

    const rootSkip = await shouldSkipScanSubtree(normalizedRoot, window.path.basename(normalizedRoot), {
        skipRoots,
        skipRegex: opts.skipRegex,
        isWalkRoot: true,
    });
    if (rootSkip) return out;

    const rootNode = await classifyLibraryNode(normalizedRoot);
    if (rootNode.kind !== "grouping" && rootNode.kind !== "skip") {
        emitTarget(rootNode, opts, out);
        return out;
    }

    const walk = async (dir: string, depthLeft: number): Promise<void> => {
        if (!window.fs.isDir(dir)) return;
        opts.onWalkProgress?.(dir);
        let names: string[] = [];
        try {
            names = await window.fs.readdir(dir);
        } catch {
            return;
        }
        for (const name of names) {
            const child = window.path.join(dir, name);
            if (
                await shouldSkipScanSubtree(child, name, {
                    skipRoots,
                    skipRegex: opts.skipRegex,
                    isWalkRoot: false,
                })
            ) {
                continue;
            }
            const node = await classifyLibraryNode(child);
            emitTarget(node, opts, out);
            /* skip dirs still hold epubs/packed files; do not enter series or oneshot folders */
            if (window.fs.isDir(child) && node.kind !== "series" && node.kind !== "oneshot" && depthLeft > 0) {
                await walk(child, depthLeft - 1);
            }
        }
    };

    await walk(normalizedRoot, remaining);
    return out;
};

/**
 * Grouping folders Scan now would enter to reach `absPath` from `root`.
 * The last path segment is the node itself, so a series at `root/a/b/series` is 2.
 */
const groupingsEnteredFromRoot = (root: string, absPath: string): number | null => {
    if (!pathIsInsideRoot(absPath, root)) return null;
    const a = normalizeMangaPathSegment(absPath);
    const r = normalizeMangaPathSegment(root);
    if (a === r) return 0;
    const rel = window.path.relative(r, a);
    const segs = rel.split(/[/\\]/).filter(Boolean);
    return Math.max(0, segs.length - 1);
};

/**
 * Finds one catalogue target by classifying `eventPath` then each parent up to `root`.
 * Chapter folders look like one-shots and packed chapter files look like series items;
 * those are only used when no series ancestor exists. Does not walk sibling trees.
 *
 * @returns The series, one-shot, packed file, or book to add, or `null` when the
 *   event is outside `root`, already catalogued, deeper than `maxDepth`, or in a skipped subtree.
 */
export const collectLibraryScanTargetFromEventPath = async (
    eventPath: string,
    root: string,
    opts: CollectLibraryScanTargetsOpts,
): Promise<LibraryScanTarget | null> => {
    const rootN = normalizeMangaPathSegment(root);
    let cur = normalizeMangaPathSegment(eventPath);
    if (!pathIsInsideRoot(cur, rootN)) return null;

    const skipRoots = skipRootsNormalized(opts.skipRoots);
    if (isUnderSkipRoot(cur, skipRoots)) return null;

    const remaining = Math.min(Math.max(0, opts.maxDepth), LIBRARY_SCAN_MAX_DEPTH_CEILING);
    let fallback: LibraryScanTarget | null = null;

    while (true) {
        const name = window.path.basename(cur);
        const isWalkRoot = cur === rootN;
        if (
            await shouldSkipScanSubtree(cur, name, {
                skipRoots,
                skipRegex: opts.skipRegex,
                isWalkRoot,
            })
        ) {
            return null;
        }

        const node = await classifyLibraryNode(cur);
        const entered = groupingsEnteredFromRoot(rootN, node.path);
        const withinDepth = entered !== null && entered <= remaining;

        if (node.kind === "series") {
            // event is inside a known series: do not promote a chapter folder to a new item
            if (opts.existingLinks.has(node.path)) return null;
            if (withinDepth) {
                const out: LibraryScanTarget[] = [];
                emitTarget(node, opts, out);
                if (out[0]) return out[0];
            }
        } else if (withinDepth && !opts.existingLinks.has(node.path)) {
            const out: LibraryScanTarget[] = [];
            emitTarget(node, opts, out);
            if (out[0] && !fallback) fallback = out[0];
        }

        if (cur === rootN) return fallback;
        const parent = normalizeMangaPathSegment(window.path.dirname(cur));
        if (parent === cur) return fallback;
        cur = parent;
    }
};
