import { formatUtils } from "@utils/file";
import { normalizeMangaPathSegment } from "@utils/mangaChapterPath";

/**
 * Hard cap on grouping-folder recursion for {@link collectLibraryScanTargets},
 * regardless of the caller `maxDepth`. Upgrade: skip-lists / confirm before
 * walking a drive root.
 */
export const LIBRARY_SCAN_MAX_DEPTH_CEILING = 12;

/**
 * Default grouping-folder steps for a new extra library folder.
 * The walk ceiling stays {@link LIBRARY_SCAN_MAX_DEPTH_CEILING}.
 */
export const LIBRARY_SCAN_DEFAULT_MAX_DEPTH = 2;

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

/**
 * Direct children of `seriesDir` that are readable chapters: image-bearing folders
 * or packed/PDF files. Root image files (including covers) are omitted; empty dirs too.
 */
export const listMangaChapterChildren = async (seriesDir: string): Promise<MangaChapterChild[]> => {
    const root = normalizeMangaPathSegment(seriesDir);
    if (!window.fs.existsSync(root) || !window.fs.isDir(root)) return [];

    const names = await window.fs.readdir(root);
    const out: MangaChapterChild[] = [];
    for (const fileName of names) {
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
 * series are not swallowed.
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
 * Walks `root` for catalogue paths. Recurses grouping and skip dirs (epubs in otherwise-empty
 * folders); does not enter series or oneshot folders.
 */
export const collectLibraryScanTargets = async (
    root: string,
    opts: CollectLibraryScanTargetsOpts,
): Promise<LibraryScanTarget[]> => {
    const normalizedRoot = normalizeMangaPathSegment(root);
    const remaining = Math.min(Math.max(0, opts.maxDepth), LIBRARY_SCAN_MAX_DEPTH_CEILING);
    const out: LibraryScanTarget[] = [];

    if (!window.fs.existsSync(normalizedRoot)) return out;

    const rootNode = await classifyLibraryNode(normalizedRoot);
    if (rootNode.kind !== "grouping" && rootNode.kind !== "skip") {
        emitTarget(rootNode, opts, out);
        return out;
    }

    const walk = async (dir: string, depthLeft: number): Promise<void> => {
        if (!window.fs.isDir(dir)) return;
        let names: string[] = [];
        try {
            names = await window.fs.readdir(dir);
        } catch {
            return;
        }
        for (const name of names) {
            const child = window.path.join(dir, name);
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

const pathIsInsideRoot = (absPath: string, root: string): boolean => {
    const a = normalizeMangaPathSegment(absPath);
    const r = normalizeMangaPathSegment(root);
    if (a === r) return true;
    const rel = window.path.relative(r, a);
    return rel !== "" && !rel.startsWith("..") && !window.path.isAbsolute(rel);
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
 *   event is outside `root`, already catalogued, or deeper than `maxDepth`.
 */
export const collectLibraryScanTargetFromEventPath = async (
    eventPath: string,
    root: string,
    opts: CollectLibraryScanTargetsOpts,
): Promise<LibraryScanTarget | null> => {
    const rootN = normalizeMangaPathSegment(root);
    let cur = normalizeMangaPathSegment(eventPath);
    if (!pathIsInsideRoot(cur, rootN)) return null;

    const remaining = Math.min(Math.max(0, opts.maxDepth), LIBRARY_SCAN_MAX_DEPTH_CEILING);
    let fallback: LibraryScanTarget | null = null;

    while (true) {
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
