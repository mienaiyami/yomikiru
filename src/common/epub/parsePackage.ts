import type { LibraryIo } from "@common/library/io";
import type { EpubManifest, EpubMetaData, EpubPackage, EpubParsedToc, EpubSpine, EpubToc } from "./types";
import { parseXml, type XmlNode, xmlAttr, xmlChildrenNamed, xmlFind, xmlFindAll } from "./xml";

const hasToken = (value: string, token: string): boolean => value.split(/\s+/).includes(token);

/** Identifies ASCII control characters that make an archive-internal path unsafe. */
const hasControlCharacter = (value: string): boolean =>
    [...value].some((character) => character.charCodeAt(0) < 32);

/** Metadata needed to catalogue an EPUB without extracting its reading package. */
export type EpubArchiveMetadata = {
    title: string;
    author: string;
    coverPath: string;
};

/** Read-only archive-entry access required by {@link parseEpubArchiveMetadata}. */
export type EpubArchiveReader = {
    readText: (entryPath: string) => Promise<string>;
};

/** Resolves an EPUB-internal reference without allowing it to escape the archive root. */
const resolveArchiveEntryPath = (basePath: string, reference: string): string => {
    const normalizedReference = reference.replace(/\\/g, "/");
    if (normalizedReference.startsWith("/") || hasControlCharacter(normalizedReference)) {
        throw new Error("parseEpubArchive: unsafe package path.");
    }
    const segments = basePath.split("/").filter(Boolean);
    for (const segment of normalizedReference.split("#")[0].split("/")) {
        if (!segment || segment === ".") continue;
        if (segment === "..") {
            if (segments.length === 0) throw new Error("parseEpubArchive: path escapes package root.");
            segments.pop();
        } else {
            segments.push(segment);
        }
    }
    if (segments.length === 0) throw new Error("parseEpubArchive: empty package path.");
    return segments.join("/");
};

/** Reads package XML as trimmed UTF-8 so leading whitespace cannot confuse XML validation. */
const readUtf8 = async (io: LibraryIo, filePath: string): Promise<string> => {
    if (!io.fs.readFile) throw new Error("parseEpubDir: LibraryFs.readFile is required.");
    return (await io.fs.readFile(filePath, "utf-8")).trim();
};

/** Returns the most recent nested TOC parent at `level`. */
const nthDeepParent = (tree: EpubParsedToc["ncx"], level: number): EpubParsedToc["ncx"][number] => {
    if (level === 0) return tree[tree.length - 1] as EpubParsedToc["ncx"][number];
    return nthDeepParent((tree[tree.length - 1] as EpubParsedToc["ncx"][number]).sub, level - 1);
};

/** Indexes spine hrefs once so large TOCs do not perform a linear spine search per entry. */
const indexSpineIdsByHref = (spine: EpubSpine): ReadonlyMap<string, string> =>
    new Map(spine.map((item) => [item.href, item.id]));

/**
 * Parses an EPUB2 NCX into the flat lookup and nested side-list tree used by the reader.
 * Matching manifest entries receive their resolved title and nesting level.
 */
const parseNcx = (
    ncxXml: XmlNode,
    ncxPath: string,
    spineIdsByHref: ReadonlyMap<string, string>,
    manifest: EpubManifest,
    io: LibraryIo,
): EpubParsedToc => {
    /*
     * `toc` is a flat navigation lookup while `ncx` preserves nesting for the
     * reader side list. They intentionally share nav ids but serve different callers.
     */
    const toc: EpubToc = new Map();
    const ncx: EpubParsedToc["ncx"] = [];
    let realLength = 0;
    let ncx_depth = 0;
    const ncxDir = io.path.dirname(ncxPath);

    /** Walks one NCX level and appends entries to the shared TOC and nested tree. */
    const fillNavPoint = (el: XmlNode, level: number): void => {
        const navPoints = xmlChildrenNamed(el, "navPoint");
        navPoints.forEach((navPoint, i) => {
            const content = xmlChildrenNamed(navPoint, "content")[0];
            let src = content ? xmlAttr(content, "src") : "";
            const label = xmlFind(navPoint, "navLabel");
            const titleNode = label ? xmlChildrenNamed(label, "text")[0] : undefined;
            const title = titleNode?.text || "~";
            const navId = xmlAttr(navPoint, "id");
            if (!navId || !src) return;
            // tolerate a duplicated Text prefix emitted by some generated EPUB packages
            src = src.replace("Text/Text/", "Text/");
            src = io.path.join(ncxDir, src);
            const id = spineIdsByHref.get(src.split("#")[0]);
            toc.set(navId, { navId, title, href: src, level, chapterId: id });
            if (id) {
                const item = manifest.get(id);
                if (item) {
                    item.title = title;
                    item.level = level;
                }
            }
            if (level > ncx_depth) ncx_depth = level;
            if (level === 0) ncx.push({ navId, ncx_index1: i, ncx_index2: realLength, sub: [], level });
            else {
                const parent = nthDeepParent(ncx, level - 1);
                parent.sub.push({ navId, ncx_index1: i, ncx_index2: realLength, sub: [], level });
            }
            realLength += 1;
            fillNavPoint(navPoint, level + 1);
        });
    };

    const navMap = xmlFind(ncxXml, "navMap");
    if (!navMap) throw new Error("parseEpubDir: No navMap found.");
    fillNavPoint(navMap, 0);
    return { ncx, ncx_depth, toc };
};

/**
 * Parses an EPUB3 nav document into the flat lookup and nested side-list tree used by the reader.
 * Matching manifest entries receive their resolved title and nesting level.
 */
const parseNav = (
    tocXml: XmlNode,
    tocPath: string,
    spineIdsByHref: ReadonlyMap<string, string>,
    manifest: EpubManifest,
    io: LibraryIo,
): EpubParsedToc => {
    const navElements = [...(tocXml.name === "nav" ? [tocXml] : []), ...xmlFindAll(tocXml, "nav")];
    const nav = navElements.find((element) => hasToken(xmlAttr(element, "type"), "toc")) ?? navElements[0];
    if (!nav) throw new Error("parseEpubV3TOC: No TOC nav found.");
    const ol = xmlChildrenNamed(nav, "ol")[0] ?? xmlFind(nav, "ol");
    if (!ol) throw new Error("parseEpubV3TOC: No ordered list found in TOC.");

    const toc: EpubToc = new Map();
    const ncx: EpubParsedToc["ncx"] = [];
    let realLength = 0;
    let ncx_depth = 0;
    const tocDir = io.path.dirname(tocPath);

    /** Walks one EPUB3 list entry and appends its descendants to the shared TOC and nested tree. */
    const processListItem = (li: XmlNode, level: number): void => {
        const anchor = xmlChildrenNamed(li, "a")[0];
        const span = !anchor ? xmlChildrenNamed(li, "span")[0] : undefined;
        const nestedList = xmlChildrenNamed(li, "ol")[0];
        if (!anchor && !span) return;

        const navId = `toc-${realLength}`;
        let title = "";
        let href = "";
        if (anchor) {
            title = (anchor.text || "~").trim() || "~";
            href = xmlAttr(anchor, "href");
            if (href && !href.startsWith("http") && !href.startsWith("#")) {
                href = io.path.join(tocDir, href);
            }
        } else if (span) {
            title = (span.text || "~").trim() || "~";
        }

        const id = href ? spineIdsByHref.get(href.split("#")[0]) : undefined;
        toc.set(navId, { navId, title, href, level, chapterId: id });
        if (id) {
            const item = manifest.get(id);
            if (item) {
                item.title = title;
                item.level = level;
            }
        }
        if (level > ncx_depth) ncx_depth = level;
        if (level === 0) ncx.push({ navId, ncx_index1: ncx.length, ncx_index2: realLength, sub: [], level });
        else {
            const parent = nthDeepParent(ncx, level - 1);
            parent.sub.push({ navId, ncx_index1: parent.sub.length, ncx_index2: realLength, sub: [], level });
        }
        realLength += 1;
        if (nestedList) {
            for (const nestedLi of xmlChildrenNamed(nestedList, "li")) {
                processListItem(nestedLi, level + 1);
            }
        }
    };

    for (const li of xmlChildrenNamed(ol, "li")) {
        processListItem(li, 0);
    }
    return { ncx, ncx_depth, toc };
};

/** Resolves the EPUB2 cover id, EPUB3 cover property, then compatible JPEG fallback. */
const resolveCoverHref = (opf: XmlNode, manifestItems: XmlNode[]): string => {
    const metas = xmlFindAll(opf, "meta");
    const coverMeta = metas.find((el) => xmlAttr(el, "name") === "cover");
    const coverId = coverMeta ? xmlAttr(coverMeta, "content") : "";
    let coverSrc = "";
    if (coverId) {
        const item = manifestItems.find((el) => xmlAttr(el, "id") === coverId);
        coverSrc = item ? xmlAttr(item, "href") : "";
    }
    if (!coverSrc) {
        const v3 = manifestItems.find((el) => hasToken(xmlAttr(el, "properties"), "cover-image"));
        coverSrc = v3 ? xmlAttr(v3, "href") : "";
    }
    if (!coverSrc) {
        const jpeg = manifestItems.find(
            (el) => xmlAttr(el, "media-type") === "image/jpeg" && xmlAttr(el, "id").startsWith("cover"),
        );
        coverSrc = jpeg ? xmlAttr(jpeg, "href") : "";
    }
    return coverSrc;
};

/**
 * Reads the EPUB container and OPF entries needed to catalogue a book without extracting it.
 * `coverPath` is an archive-internal path that the main-process archive module can stream.
 *
 * @throws {Error} When the container or OPF cannot identify a valid package document
 */
export const parseEpubArchiveMetadata = async (reader: EpubArchiveReader): Promise<EpubArchiveMetadata> => {
    const container = parseXml((await reader.readText("META-INF/container.xml")).trim());
    const rootfile = xmlFind(container, "rootfile");
    const rootPath = rootfile ? xmlAttr(rootfile, "full-path") : "";
    if (!rootPath) throw new Error("parseEpubArchive: rootfile not found.");
    const opfPath = resolveArchiveEntryPath("", rootPath);
    const opf = parseXml((await reader.readText(opfPath)).trim());
    const manifestEl = xmlFind(opf, "manifest");
    const manifestItems = manifestEl ? xmlChildrenNamed(manifestEl, "item") : [];
    if (manifestItems.length === 0) throw new Error("parseEpubArchive: no manifest items found.");
    const coverHref = resolveCoverHref(opf, manifestItems);
    return {
        title: xmlFind(opf, "title")?.text || "No Title",
        author: xmlFindAll(opf, "creator")
            .map((element) => element.text)
            .filter(Boolean)
            .join(", "),
        coverPath: coverHref ? resolveArchiveEntryPath(opfPath.split("/").slice(0, -1).join("/"), coverHref) : "",
    };
};

/**
 * Parses an extracted EPUB directory (container.xml + OPF + NCX or nav).
 *
 * @throws {Error} When required package files or elements are missing
 */
export const parseExtractedEpubDir = async (dirPath: string, io: LibraryIo): Promise<EpubPackage> => {
    if (!io.fs.existsSync(dirPath)) throw new Error("parseEpubDir: Path does not exist.");
    const containerPath = io.path.join(dirPath, "META-INF", "container.xml");
    if (!io.fs.existsSync(containerPath)) throw new Error("parseEpubDir: container.xml not found.");
    const container = parseXml(await readUtf8(io, containerPath));
    const rootfile = xmlFind(container, "rootfile");
    const rootPath = rootfile ? xmlAttr(rootfile, "full-path") : "";
    if (!rootPath) throw new Error("parseEpubDir: rootfile not found.");
    const opfPath = io.path.join(dirPath, ...rootPath.split("/"));
    if (!io.fs.existsSync(opfPath)) throw new Error("parseEpubDir: opf file not found.");
    const opf = parseXml(await readUtf8(io, opfPath));
    const opfDir = io.path.dirname(opfPath);
    const manifestEl = xmlFind(opf, "manifest");
    const manifestItems = manifestEl ? xmlChildrenNamed(manifestEl, "item") : [];
    if (manifestItems.length === 0) throw new Error("parseEpubDir: No manifest items found.");

    let coverSrc = resolveCoverHref(opf, manifestItems);
    if (coverSrc) {
        coverSrc = io.path.join(opfDir, coverSrc);
        if (!io.fs.isFile(coverSrc)) coverSrc = "";
    }

    const titleNode = xmlFind(opf, "title");
    const creators = xmlFindAll(opf, "creator");
    const navItem = manifestItems.find((el) => hasToken(xmlAttr(el, "properties"), "nav"));
    const metadata: EpubMetaData = {
        title: titleNode?.text || "No Title",
        author: creators
            .map((el) => el.text)
            .filter(Boolean)
            .join(", "),
        cover: coverSrc,
        opfDir,
        ncx_depth: 0,
        navId: navItem ? xmlAttr(navItem, "id") : "",
    };

    const styleSheets = manifestItems
        .filter((el) => xmlAttr(el, "media-type") === "text/css")
        .map((el) => {
            const href = xmlAttr(el, "href");
            return href ? io.path.join(metadata.opfDir, href) : "";
        })
        .filter(Boolean);

    const manifest: EpubManifest = new Map();
    for (const el of manifestItems) {
        const id = xmlAttr(el, "id");
        const hrefRaw = xmlAttr(el, "href");
        if (!id || !hrefRaw) continue;
        manifest.set(id, {
            id,
            href: io.path.join(metadata.opfDir, hrefRaw),
            mediaType: xmlAttr(el, "media-type"),
        });
    }

    const spineEl = xmlFind(opf, "spine");
    if (!spineEl) throw new Error("parseEpubDir: No spine found.");
    const spine: EpubSpine = xmlChildrenNamed(spineEl, "itemref").map((el, i) => {
        const id = xmlAttr(el, "idref");
        const manifestItem = id ? manifest.get(id) : undefined;
        if (!id || !manifestItem) throw new Error("parseEpubDir: Error reading spine data.");
        manifestItem.order = i;
        return { id, href: manifestItem.href };
    });
    const spineIdsByHref = indexSpineIdsByHref(spine);

    const ncxItem = manifestItems.find((el) => xmlAttr(el, "media-type") === "application/x-dtbncx+xml");
    const ncxHref = ncxItem ? xmlAttr(ncxItem, "href") : "";
    const tocPath = metadata.navId ? manifest.get(metadata.navId)?.href : "";
    let ncx: EpubPackage["ncx"] = [];
    let toc: EpubToc = new Map();
    if (ncxHref) {
        const ncxPath = io.path.join(opfDir, ncxHref);
        const parsed = parseNcx(parseXml(await readUtf8(io, ncxPath)), ncxPath, spineIdsByHref, manifest, io);
        ncx = parsed.ncx;
        toc = parsed.toc;
        metadata.ncx_depth = parsed.ncx_depth;
    } else if (tocPath) {
        const parsed = parseNav(parseXml(await readUtf8(io, tocPath)), tocPath, spineIdsByHref, manifest, io);
        ncx = parsed.ncx;
        toc = parsed.toc;
        metadata.ncx_depth = parsed.ncx_depth;
    }
    return { metadata, manifest, spine, toc, ncx, styleSheets };
};
