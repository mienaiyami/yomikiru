import { isBookFileName, isImageFileName, isMangaFileName } from "@common/library/formats";
import type { LibraryIo } from "@common/library/io";
import { LIBRARY_SCAN_MAX_DEPTH_CEILING } from "@common/types/libraryScan";

export type { LibraryFs, LibraryIo, LibraryPath } from "@common/library/io";

/**
 * Directory or file basenames (case-insensitive) that mark a library-scan skip.
 * A matching file inside a directory skips that directory; a matching folder skips only itself.
 */
export const LIBRARY_SCAN_IGNORE_SENTINEL_NAMES = ["yomikiru-ignore", ".yomikiru-ignore"] as const;

const LIBRARY_SCAN_IGNORE_SENTINEL_KEYS = new Set(
    LIBRARY_SCAN_IGNORE_SENTINEL_NAMES.map((name) => name.toLowerCase()),
);

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
    /** {@link resolveLibraryRealPath} keys of catalogue rows that must not be emitted again. */
    existingLinks: ReadonlySet<string>;
    /**
     * Other library-folder paths this walk must not enter.
     * Compared after {@link resolveLibraryRealPath}; the current root is never listed here by callers.
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
    /** Cooperative stop checked before each directory and child classification. */
    shouldStop?: () => boolean;
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
 * Strips a trailing separator after normalize, matching reader path joining.
 */
export const normalizeLibraryPath = (io: LibraryIo, link: string): string => {
    let normalized = io.path.normalize(link);
    if (normalized[normalized.length - 1] === io.path.sep) {
        normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
};

/**
 * Drops a Windows `\\?\` prefix from {@link LibraryFs.realpath} so catalogue keys match
 * ordinary absolute paths. No-op on other platforms and on paths without the prefix.
 */
export const stripWindowsLongPathPrefix = (resolved: string): string => {
    if (resolved.startsWith("\\\\?\\UNC\\")) return `\\\\${resolved.slice(8)}`;
    if (resolved.startsWith("\\\\?\\")) return resolved.slice(4);
    return resolved;
};

/**
 * Normalized path used as `library_items.link`: `realpath` when the adapter provides it
 * and the path exists, otherwise {@link normalizeLibraryPath}.
 *
 * ponytail: identity is realpath only. Hardlinks, NTFS case-fold, and subst/mapped-drive
 * aliases stay distinct; upgrade with inode / casefold keys if those reports show up.
 */
export const resolveLibraryRealPath = (io: LibraryIo, link: string): string => {
    const normalized = normalizeLibraryPath(io, link);
    if (!normalized) return normalized;
    const real = io.fs.realpath?.(normalized);
    if (!real) return normalized;
    return stripWindowsLongPathPrefix(normalizeLibraryPath(io, real));
};

/**
 * True when `absPath` is `root` or a descendant of `root` after {@link resolveLibraryRealPath}.
 */
export const pathIsInsideRoot = (io: LibraryIo, absPath: string, root: string): boolean => {
    const a = resolveLibraryRealPath(io, absPath);
    const r = resolveLibraryRealPath(io, root);
    if (a === r) return true;
    const rel = io.path.relative(r, a);
    return rel !== "" && !rel.startsWith("..") && !io.path.isAbsolute(rel);
};

/**
 * True when `fileName` is a series-root cover sidecar (`cover` plus optional image ext).
 */
export const isMangaSeriesCoverFileName = (io: LibraryIo, fileName: string): boolean => {
    const base = io.path.basename(fileName);
    const ext = io.path.extname(base);
    const stem = ext ? io.path.basename(base, ext) : base;
    return stem.toLowerCase() === "cover";
};

const allowsManga = (content: CollectLibraryScanTargetsOpts["content"]): boolean =>
    content === "manga" || content === "both";

const allowsBook = (content: CollectLibraryScanTargetsOpts["content"]): boolean =>
    content === "book" || content === "both";

const skipRootsNormalized = (io: LibraryIo, skipRoots: readonly string[] | undefined): string[] =>
    (skipRoots ?? []).map((root) => resolveLibraryRealPath(io, root)).filter(Boolean);

const isUnderSkipRoot = (io: LibraryIo, absPath: string, skipRoots: readonly string[]): boolean =>
    skipRoots.some((root) => pathIsInsideRoot(io, absPath, root));

/**
 * True when `dir` has a direct child *file* named as an ignore sentinel.
 */
const dirHasIgnoreSentinelFile = async (io: LibraryIo, dir: string): Promise<boolean> => {
    let names: string[] = [];
    try {
        names = await io.fs.readdir(dir);
    } catch {
        return false;
    }
    for (const name of names) {
        if (!isLibraryScanIgnoreName(name)) continue;
        const child = io.path.join(dir, name);
        if (io.fs.isFile(child)) return true;
    }
    return false;
};

/**
 * Direct children of `seriesDir` that are readable chapters: image-bearing folders
 * or packed/PDF files. Root image files (including covers) are omitted; empty dirs too.
 * Ignore-sentinel names are never chapters; an unreadable root returns an empty list.
 */
export const listMangaChapterChildren = async (io: LibraryIo, seriesDir: string): Promise<MangaChapterChild[]> => {
    const root = normalizeLibraryPath(io, seriesDir);
    if (!io.fs.existsSync(root) || !io.fs.isDir(root)) return [];

    let names: string[] = [];
    try {
        names = await io.fs.readdir(root);
    } catch {
        return [];
    }
    const out: MangaChapterChild[] = [];
    for (const fileName of names) {
        if (isLibraryScanIgnoreName(fileName)) continue;
        const filePath = io.path.join(root, fileName);
        try {
            await io.fs.access(filePath, io.fs.constants.R_OK);
        } catch {
            continue;
        }

        if (io.fs.isFile(filePath)) {
            if (!isMangaFileName(fileName, io.path.extname)) continue;
            const st = await io.fs.stat(filePath);
            out.push({ name: fileName, link: filePath, dateModified: st.mtimeMs, pages: 0 });
            continue;
        }

        if (!io.fs.isDir(filePath)) continue;
        let pages = 0;
        try {
            const kids = await io.fs.readdir(filePath);
            pages = kids.filter((f) => isImageFileName(f, io.path.extname)).length;
        } catch {
            continue;
        }
        if (pages <= 0) continue;
        const st = await io.fs.stat(filePath);
        out.push({ name: fileName, link: filePath, dateModified: st.mtimeMs, pages });
    }
    return out;
};

/**
 * Resolves the path used to start an unread manga catalogue item.
 * Packed files and image-bearing one-shots open directly; series roots open their
 * first naturally name-sorted chapter and cover-only roots are never treated as chapters.
 */
export const resolveMangaStartPath = async (io: LibraryIo, libraryPath: string): Promise<string | null> => {
    const root = normalizeLibraryPath(io, libraryPath);
    if (!io.fs.existsSync(root)) return null;
    if (io.fs.isFile(root)) return isMangaFileName(root, io.path.extname) ? root : null;
    if (!io.fs.isDir(root)) return null;

    let names: string[] = [];
    try {
        names = await io.fs.readdir(root);
    } catch {
        return null;
    }
    const hasPages = names.some((name) => {
        const child = io.path.join(root, name);
        return (
            io.fs.isFile(child) && isImageFileName(name, io.path.extname) && !isMangaSeriesCoverFileName(io, name)
        );
    });
    if (hasPages) return root;

    const chapters = await listMangaChapterChildren(io, root);
    chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    return chapters[0]?.link ?? null;
};

const classifyFile = (io: LibraryIo, normalized: string): LibraryNodeKind => {
    if (isBookFileName(normalized, io.path.extname)) return "book";
    if (isMangaFileName(normalized, io.path.extname)) return "packedManga";
    return "skip";
};

/**
 * True when `dir` has nested directories or book/packed files, so the parent should keep
 * walking instead of treating image-folder siblings as its only chapters.
 */
const dirLooksLikeGrouping = async (io: LibraryIo, dir: string): Promise<boolean> => {
    let names: string[] = [];
    try {
        names = await io.fs.readdir(dir);
    } catch {
        return false;
    }
    for (const name of names) {
        if (isLibraryScanIgnoreName(name)) continue;
        const child = io.path.join(dir, name);
        if (io.fs.isDir(child)) return true;
        if (
            io.fs.isFile(child) &&
            (isBookFileName(name, io.path.extname) || isMangaFileName(name, io.path.extname))
        ) {
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
export const classifyLibraryNode = async (io: LibraryIo, absPath: string): Promise<ClassifiedLibraryNode> => {
    const normalized = normalizeLibraryPath(io, absPath);
    if (!io.fs.existsSync(normalized)) return { kind: "skip", path: normalized };

    if (io.fs.isFile(normalized)) {
        return { kind: classifyFile(io, normalized), path: normalized };
    }
    if (!io.fs.isDir(normalized)) return { kind: "skip", path: normalized };

    const names = await io.fs.readdir(normalized);
    const chapters = await listMangaChapterChildren(io, normalized);
    const chapterNames = new Set(chapters.map((c) => c.name));
    let pageImages = 0;
    let subdirs = 0;
    let groupingShaped = 0;
    for (const fileName of names) {
        if (isLibraryScanIgnoreName(fileName)) continue;
        const child = io.path.join(normalized, fileName);
        if (io.fs.isDir(child)) {
            subdirs += 1;
            if (!chapterNames.has(fileName) && (await dirLooksLikeGrouping(io, child))) groupingShaped += 1;
            continue;
        }
        if (
            io.fs.isFile(child) &&
            isImageFileName(fileName, io.path.extname) &&
            !isMangaSeriesCoverFileName(io, fileName)
        ) {
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

/**
 * Pushes a classified node onto `out` using {@link resolveLibraryRealPath} as the catalogue path.
 */
const emitTarget = (
    io: LibraryIo,
    node: ClassifiedLibraryNode,
    opts: CollectLibraryScanTargetsOpts,
    out: LibraryScanTarget[],
): void => {
    const canonical = resolveLibraryRealPath(io, node.path);
    if (opts.existingLinks.has(canonical)) return;
    if (node.kind === "series" && allowsManga(opts.content)) {
        out.push({ type: "manga", path: canonical });
        return;
    }
    if (node.kind === "packedManga" && allowsManga(opts.content)) {
        out.push({ type: "manga", path: canonical });
        return;
    }
    if (node.kind === "book" && allowsBook(opts.content)) {
        out.push({ type: "book", path: canonical });
        return;
    }
    if (node.kind === "oneshot" && allowsManga(opts.content)) {
        out.push({ type: "manga", path: canonical });
    }
};

/**
 * True when this walk must not classify or recurse into `absPath`.
 * The scan root itself is never skipped for regex or ignore-folder name.
 */
const shouldSkipScanSubtree = async (
    io: LibraryIo,
    absPath: string,
    name: string,
    opts: {
        skipRoots: readonly string[];
        skipRegex: RegExp | null | undefined;
        isWalkRoot: boolean;
    },
): Promise<boolean> => {
    if (!opts.isWalkRoot && isLibraryScanIgnoreName(name) && io.fs.isDir(absPath)) return true;
    if (!opts.isWalkRoot && isUnderSkipRoot(io, absPath, opts.skipRoots)) return true;
    if (!opts.isWalkRoot && shouldSkipLibraryScanEntry(name, opts.skipRegex)) return true;
    if (io.fs.isDir(absPath) && (await dirHasIgnoreSentinelFile(io, absPath))) return true;
    return false;
};

/** Emits direct EPUB children that would otherwise be hidden by a terminal manga directory. */
const emitDirectBookChildren = async (
    io: LibraryIo,
    dir: string,
    opts: CollectLibraryScanTargetsOpts,
    scanOpts: { skipRoots: readonly string[] },
    out: LibraryScanTarget[],
): Promise<void> => {
    if (!allowsBook(opts.content) || !io.fs.isDir(dir)) return;
    let names: string[] = [];
    try {
        names = await io.fs.readdir(dir);
    } catch {
        return;
    }
    for (const name of names) {
        if (opts.shouldStop?.()) return;
        const child = io.path.join(dir, name);
        if (!io.fs.isFile(child) || !isBookFileName(name, io.path.extname)) continue;
        if (
            await shouldSkipScanSubtree(io, child, name, {
                skipRoots: scanOpts.skipRoots,
                skipRegex: opts.skipRegex,
                isWalkRoot: false,
            })
        ) {
            continue;
        }
        emitTarget(io, { kind: "book", path: normalizeLibraryPath(io, child) }, opts, out);
    }
};

/**
 * Walks `root` for catalogue paths. Recurses grouping and skip dirs (EPUBs in otherwise-empty
 * folders); terminal manga directories are not descended, but their direct book siblings are
 * still emitted for mixed roots. Skip regex, ignore sentinels, and
 * {@link CollectLibraryScanTargetsOpts.skipRoots} prune whole subtrees. Emitted `path` values
 * are {@link resolveLibraryRealPath}; a directory whose realpath was already walked is skipped.
 */
export const collectLibraryScanTargets = async (
    io: LibraryIo,
    root: string,
    opts: CollectLibraryScanTargetsOpts,
): Promise<LibraryScanTarget[]> => {
    const normalizedRoot = normalizeLibraryPath(io, root);
    const remaining = Math.min(Math.max(0, opts.maxDepth), LIBRARY_SCAN_MAX_DEPTH_CEILING);
    const out: LibraryScanTarget[] = [];
    const skipRoots = skipRootsNormalized(io, opts.skipRoots);
    const visitedReal = new Set<string>();

    if (opts.shouldStop?.() || !io.fs.existsSync(normalizedRoot)) return out;

    const rootSkip = await shouldSkipScanSubtree(io, normalizedRoot, io.path.basename(normalizedRoot), {
        skipRoots,
        skipRegex: opts.skipRegex,
        isWalkRoot: true,
    });
    if (rootSkip) return out;

    const rootNode = await classifyLibraryNode(io, normalizedRoot);
    if (rootNode.kind !== "grouping" && rootNode.kind !== "skip") {
        emitTarget(io, rootNode, opts, out);
        if (rootNode.kind === "series" || rootNode.kind === "oneshot") {
            await emitDirectBookChildren(io, normalizedRoot, opts, { skipRoots }, out);
        }
        return out;
    }

    const walk = async (dir: string, depthLeft: number): Promise<void> => {
        if (opts.shouldStop?.() || !io.fs.isDir(dir)) return;
        const dirReal = resolveLibraryRealPath(io, dir);
        if (visitedReal.has(dirReal)) return;
        visitedReal.add(dirReal);
        opts.onWalkProgress?.(dir);
        let names: string[] = [];
        try {
            names = await io.fs.readdir(dir);
        } catch {
            return;
        }
        for (const name of names) {
            if (opts.shouldStop?.()) return;
            const child = io.path.join(dir, name);
            if (
                await shouldSkipScanSubtree(io, child, name, {
                    skipRoots,
                    skipRegex: opts.skipRegex,
                    isWalkRoot: false,
                })
            ) {
                continue;
            }
            const node = await classifyLibraryNode(io, child);
            emitTarget(io, node, opts, out);
            if (node.kind === "series" || node.kind === "oneshot") {
                await emitDirectBookChildren(io, child, opts, { skipRoots }, out);
            }
            /* skip dirs still hold epubs/packed files; do not enter series or oneshot folders */
            if (io.fs.isDir(child) && node.kind !== "series" && node.kind !== "oneshot" && depthLeft > 0) {
                if (visitedReal.has(resolveLibraryRealPath(io, child))) continue;
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
const groupingsEnteredFromRoot = (io: LibraryIo, root: string, absPath: string): number | null => {
    if (!pathIsInsideRoot(io, absPath, root)) return null;
    const a = normalizeLibraryPath(io, absPath);
    const r = normalizeLibraryPath(io, root);
    if (a === r) return 0;
    const rel = io.path.relative(r, a);
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
    io: LibraryIo,
    eventPath: string,
    root: string,
    opts: CollectLibraryScanTargetsOpts,
): Promise<LibraryScanTarget | null> => {
    const rootN = normalizeLibraryPath(io, root);
    let cur = normalizeLibraryPath(io, eventPath);
    if (!pathIsInsideRoot(io, cur, rootN)) return null;

    const skipRoots = skipRootsNormalized(io, opts.skipRoots);
    if (isUnderSkipRoot(io, cur, skipRoots)) return null;

    const remaining = Math.min(Math.max(0, opts.maxDepth), LIBRARY_SCAN_MAX_DEPTH_CEILING);
    let fallback: LibraryScanTarget | null = null;

    while (true) {
        const name = io.path.basename(cur);
        const isWalkRoot = cur === rootN;
        if (
            await shouldSkipScanSubtree(io, cur, name, {
                skipRoots,
                skipRegex: opts.skipRegex,
                isWalkRoot,
            })
        ) {
            return null;
        }

        const node = await classifyLibraryNode(io, cur);
        const entered = groupingsEnteredFromRoot(io, rootN, node.path);
        const withinDepth = entered !== null && entered <= remaining;

        const nodeReal = resolveLibraryRealPath(io, node.path);
        if (node.kind === "series") {
            // event is inside a known series: do not promote a chapter folder to a new item
            if (opts.existingLinks.has(nodeReal)) return fallback?.type === "book" ? fallback : null;
            if (withinDepth) {
                const out: LibraryScanTarget[] = [];
                emitTarget(io, node, opts, out);
                if (out[0]) return out[0];
            }
        } else if (withinDepth && !opts.existingLinks.has(nodeReal)) {
            const out: LibraryScanTarget[] = [];
            emitTarget(io, node, opts, out);
            if (out[0] && !fallback) fallback = out[0];
        }

        if (cur === rootN) return fallback;
        const parent = normalizeLibraryPath(io, io.path.dirname(cur));
        if (parent === cur) return fallback;
        cur = parent;
    }
};
