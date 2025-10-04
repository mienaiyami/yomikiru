import { dialogUtils } from "./dialog";
import { unzip } from "./file";

export type EPubData = {
    metadata: EPUB.MetaData;
    manifest: EPUB.Manifest;
    spine: EPUB.Spine;
    toc: EPUB.TOC;
    ncx: EPUB.NCXTree[];
    styleSheets: string[];
};

type ParsedTOC = { ncx: EPUB.NCXTree[]; ncx_depth: number; toc: EPUB.TOC };

export default class EPUB {
    static async extractEpub(
        epubPath: string,
        extractPath: string,
        keepExtractedFiles: boolean,
    ): Promise<boolean> {
        console.log("EPUB::extractEpub : extracting ", epubPath, " at ", extractPath);
        try {
            if (
                keepExtractedFiles &&
                window.fs.existsSync(window.path.join(extractPath, "SOURCE")) &&
                window.fs.readFileSync(window.path.join(extractPath, "SOURCE"), "utf-8") === epubPath
            ) {
                console.log("EPUB::extractEpub : Found old epub extract.");
                return true;
            } else {
                if (!keepExtractedFiles) window.app.deleteDirOnClose = extractPath;
                try {
                    if (window.fs.existsSync(extractPath))
                        await window.fs.rm(extractPath, {
                            recursive: true,
                        });
                    await unzip(epubPath, extractPath);
                    if (keepExtractedFiles) window.fs.writeFile(window.path.join(extractPath, "SOURCE"), epubPath);
                    return true;
                } catch (err) {
                    if (err instanceof Error) {
                        if (err.message.includes("spawn unzip ENOENT")) {
                            dialogUtils.customError({
                                message: "Error while extracting.",
                                detail: '"unzip" not found. Please install by using\n"sudo apt install unzip"',
                            });
                        } else
                            dialogUtils.customError({
                                message: "Error while extracting.",
                                detail: err.message,
                            });
                        return false;
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error || typeof err === "string")
                dialogUtils.customError({
                    message: "An Error occurred while checking/extracting epub.",
                    detail: err.toString(),
                });
            else window.logger.error("An Error occurred while checking/extracting epub:", err);
            return false;
        }
        return false;
    }
    static async readEpubFile(epubPath: string, keepExtractedFiles: boolean): Promise<EPubData> {
        const extractPath = window.path.join(
            window.electron.app.getPath("temp"),
            `yomikiru-temp-EPub-${epubPath.split(window.path.sep).at(-1)}`,
        );
        // const now = performance.now();
        const extractSuccess = await EPUB.extractEpub(epubPath, extractPath, keepExtractedFiles);
        if (!extractSuccess) throw new Error("Error while extracting.");
        const parsed = await EPUB.parseEpubDir(extractPath);
        // console.log(performance.now() - now);
        return parsed;
    }
    /**
     *
     * @param path path of extracted epub file
     */
    private static async parseEpubDir(dirPath: string): Promise<EPubData> {
        try {
            const exists = (p: string) => window.fs.existsSync(p);
            if (!window.fs.existsSync) throw new Error("parseEpubDir: Path does not exist.");
            const parser = new DOMParser();
            const containerPath = window.path.join(dirPath, "META-INF/container.xml");
            if (!exists(containerPath)) throw new Error("parseEpubDir: container.xml not found.");
            /**
             * some files maybe have invalid start character, like new line or space,
             * will throw error in parsing
             */
            const containerRaw = (await window.fs.readFile(containerPath, "utf-8")).trim();
            const container = parser.parseFromString(containerRaw, "application/xml");
            const rootfile = container.querySelector("rootfile")?.getAttribute("full-path");
            if (!rootfile) throw new Error("parseEpubDir: rootfile not found.");
            const opfPath = window.path.join(dirPath, rootfile);
            if (!exists(opfPath)) throw new Error("parseEpubDir: opf file not found.");
            const opfRaw = (await window.fs.readFile(opfPath, "utf-8")).trim();
            const opf = parser.parseFromString(opfRaw, "application/xml");

            //
            const coverId = opf.querySelector("meta[name='cover']")?.getAttribute("content");
            let coverSrc = "";
            if (coverId) {
                coverSrc = opf.querySelector(`manifest > item[id='${coverId}']`)?.getAttribute("href") || "";
            }
            /**
             * epub v3 doesn't have cover id
             * some v3 might not even have this property
             */
            if (!coverSrc) {
                coverSrc =
                    opf.querySelector("manifest > item[properties='cover-image']")?.getAttribute("href") || "";
            }
            if (!coverSrc) {
                // edge case, some epub v3 might not have cover id or properties
                const coverItem = Array.from(
                    opf.querySelectorAll("manifest > item[media-type='image/jpeg']"),
                ).find((el) => el.getAttribute("id")?.startsWith("cover"));
                if (coverItem) {
                    coverSrc = coverItem.getAttribute("href") || "";
                }
            }
            if (coverSrc) {
                coverSrc = window.path.join(window.path.dirname(opfPath), coverSrc);
                if (!window.fs.isFile(coverSrc)) coverSrc = "";
            }
            //

            const metadata: EPUB.MetaData = {
                title: opf.getElementsByTagName("dc:title")[0]?.textContent || "No Title",
                author: [...opf.getElementsByTagName("dc:creator")].map((el) => el.textContent).join(", "),
                // description: opf.querySelector("dc:description")?.textContent || "No Description",
                cover: coverSrc,
                opfDir: window.path.dirname(opfPath),
                ncx_depth: 0,
                //! navId wont work if it is not present in spine
                navId: opf.querySelector("manifest > item[properties='nav']")?.getAttribute("id") || "",
            };
            const manifestItems = opf.querySelectorAll("manifest > item");
            if (manifestItems.length === 0) throw new Error("parseEpubDir: No manifest items found.");
            const styleSheets = Array.from(manifestItems)
                .filter((el) => el.getAttribute("media-type") === "text/css")
                .map((el) => {
                    const href = el.getAttribute("href");
                    if (!href) return "";
                    return window.path.join(metadata.opfDir, href);
                })
                .filter((el) => el);
            const manifest: EPUB.Manifest = new Map();
            manifestItems.forEach((el) => {
                const id = el.getAttribute("id");
                let href = el.getAttribute("href");
                if (!id || !href) return;
                href = window.path.join(metadata.opfDir, href);
                manifest.set(id, {
                    id,
                    href,
                    mediaType: el.getAttribute("media-type") || "",
                });
            });

            const spineEl = opf.querySelector("spine");
            if (!spineEl) throw new Error("parseEpubDir: No spine found.");
            // display order is taken from spine, not from ncx
            const spine: EPUB.Spine = Array.from(spineEl.querySelectorAll("itemref")).map((el, i) => {
                const id = el.getAttribute("idref");
                const item = opf.querySelector(`manifest > item[id='${id}']`);
                if (!item || !id) throw new Error("parseEpubDir: Error reading spine data.");
                const manifestItem = manifest.get(id)!;
                manifestItem.order = i;
                return {
                    id,
                    href: manifestItem.href,
                };
            });
            const ncxPathRelative = opf
                .querySelector("manifest > item[media-type='application/x-dtbncx+xml']")
                ?.getAttribute("href");
            // this is full path
            const tocPath = metadata.navId ? manifest.get(metadata.navId)?.href : "";
            if (!ncxPathRelative)
                window.logger.warn("parseEpubDir: No ncx file found. Checking for toc.xhtml instead.");
            if (!ncxPathRelative && !tocPath)
                window.logger.error("parseEpubDir: No navId/toc.xhtml found. Sidebar will not be available.");
            let ncx: EPUB.NCXTree[] = [];
            let toc: EPUB.TOC = new Map();
            if (ncxPathRelative) {
                const parsed = await EPUB.parseNCX(
                    window.path.join(window.path.dirname(opfPath), ncxPathRelative),
                    spine,
                    manifest,
                );
                ncx = parsed.ncx;
                toc = parsed.toc;
                metadata.ncx_depth = parsed.ncx_depth;
            } else if (tocPath) {
                const parsed = await EPUB.parseEpubV3TOC(tocPath, spine, manifest);
                ncx = parsed.ncx;
                toc = parsed.toc;
                metadata.ncx_depth = parsed.ncx_depth;
            }
            return { metadata, manifest, spine, toc, ncx, styleSheets };
        } catch (e) {
            if (e instanceof Error || e instanceof String)
                dialogUtils.customError({
                    message: "Error while parsing epub.",
                    detail: e.toString(),
                });
            throw e;
        }
    }

    /**
     * only for epub version 3
     * @param tocPath path to toc.xhtml file, manifest.get(metadata.navId)
     */
    private static async parseEpubV3TOC(
        tocPath: string,
        spine: EPUB.Spine,
        manifest: EPUB.Manifest,
    ): Promise<ParsedTOC> {
        const parser = new DOMParser();
        const tocRaw = (await window.fs.readFile(tocPath, "utf-8")).trim();
        const tocXML = parser.parseFromString(tocRaw, "application/xhtml+xml");
        const nav = tocXML.querySelector("nav");
        if (!nav) throw new Error("parseEpubV3TOC: No TOC nav found.");

        const toc: EPUB.TOC = new Map();
        const ncx: EPUB.NCXTree[] = [];
        let realLength = 0;
        let ncx_depth = 0;

        const getNthDeepParent = (tree: EPUB.NCXTree[], level: number): EPUB.NCXTree => {
            if (level === 0) return tree[tree.length - 1];
            return getNthDeepParent(tree[tree.length - 1].sub, level - 1);
        };

        const processListItem = (li: Element, level: number) => {
            const anchor = li.querySelector(":scope > a");
            const span = !anchor ? li.querySelector(":scope > span") : null;
            const nestedList = li.querySelector(":scope > ol");

            if (!anchor && !span) {
                console.error("parseEpubV3TOC: No anchor or span found in list item. Skipping.");
                return;
            }

            const navId = `toc-${realLength}`;
            let title = "";
            let href = "";

            if (anchor) {
                title = anchor.textContent?.trim() || "~";
                href = anchor.getAttribute("href") || "";
                if (href && !href.startsWith("http") && !href.startsWith("#")) {
                    href = window.path.join(window.path.dirname(tocPath), href);
                }
            } else if (span) {
                title = span.textContent?.trim() || "~";
            }

            const id = href ? spine.find((el) => el.href === href.split("#")[0])?.id : undefined;

            toc.set(navId, { navId, title, href, level, chapterId: id });

            if (id) {
                const item = manifest.get(id);
                if (item) {
                    item.title = title;
                    item.level = level;
                }
            }

            if (level > ncx_depth) ncx_depth = level;

            if (level === 0) {
                ncx.push({ navId, ncx_index1: ncx.length, ncx_index2: realLength, sub: [], level });
            } else {
                const parent = getNthDeepParent(ncx, level - 1);
                parent.sub.push({
                    navId,
                    ncx_index1: parent.sub.length,
                    ncx_index2: realLength,
                    sub: [],
                    level,
                });
            }

            realLength++;

            if (nestedList) {
                const nestedItems = nestedList.querySelectorAll(":scope > li");
                nestedItems.forEach((nestedLi) => {
                    processListItem(nestedLi, level + 1);
                });
            }
        };

        const ol = nav.querySelector("ol");
        if (!ol) throw new Error("parseEpubV3TOC: No ordered list found in TOC.");

        const listItems = ol.querySelectorAll(":scope > li");
        listItems.forEach((li) => {
            processListItem(li, 0);
        });

        return { ncx, ncx_depth, toc };
    }

    /**
     * only for epub version 2, most v3 epub don't have ncx
     */
    private static async parseNCX(
        ncxPath: string,
        spine: EPUB.Spine,
        manifest: EPUB.Manifest,
    ): Promise<ParsedTOC> {
        const parser = new DOMParser();

        const ncxRaw = (await window.fs.readFile(ncxPath, "utf-8")).trim();
        const ncxXML = parser.parseFromString(ncxRaw, "application/xml");
        // toc is different from contents, toc mostly doesn't include all elements.
        // toc and ncx can be merged? or should be kept separate?
        const toc: EPUB.TOC = new Map();
        const ncx: EPUB.NCXTree[] = [];
        let observedDepth = 0;
        let realLength = 0;
        const getNthDeepParent = (tree: EPUB.NCXTree[], level: number): EPUB.NCXTree => {
            if (level === 0) return tree[tree.length - 1];
            return getNthDeepParent(tree[tree.length - 1].sub, level - 1);
        };
        let ncx_depth = 0;
        const fillNavPoint = (el: Element, level: number) => {
            const navPoints = [...el.querySelectorAll(":scope > navPoint")];
            if (navPoints.length === 0) return;
            if (level > observedDepth) observedDepth = level;
            navPoints.forEach((navPoint, i) => {
                const content = navPoint.querySelector(":scope > content");
                let src = content?.getAttribute("src");
                const title = navPoint.querySelector(":scope > navLabel > text")?.textContent || "~";
                const navId = navPoint.getAttribute("id");
                if (!navId) {
                    console.error("EPUB::parseEpubDir: No id found in navPoint. Skipping.");
                    return;
                }
                if (!src) {
                    console.error("EPUB::parseEpubDir: No src found in navPoint. Skipping.");
                    return;
                }
                //todo check if need to add check for duplicate starting string in src, like "Text/Text/",
                // check comment in prev version, mostly in web scrapped epub
                // 2024-04-09 : decided to add just for edge cases
                src = src.replace("Text/Text/", "Text/");
                src = window.path.join(window.path.dirname(ncxPath), src);

                // doing this takes around 1000ms on 2500 chapters, ~200ms without it
                // on 1900 chapters, ~700ms with, ~160ms without
                const id = spine.find((el) => el.href === src?.split("#")[0])?.id;
                toc.set(navId, { navId, title, href: src, level, chapterId: id });
                // toc.push({ navId, title, href: src, level });
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
                    const parent = getNthDeepParent(ncx, level - 1);
                    parent.sub.push({ navId, ncx_index1: i, ncx_index2: realLength, sub: [], level });
                }
                realLength++;
                fillNavPoint(navPoint, level + 1);
            });
        };
        const navMap = ncxXML.querySelector("navMap");
        if (!navMap) throw new Error("parseEpubDir: No navMap found.");
        fillNavPoint(navMap, 0);
        return { ncx, ncx_depth, toc };
    }

    static async parseChapter(str: string, chapterPath: string): Promise<string> {
        // const now = performance.now();

        /*
             was planning to only use regex, but some tags don't get parsed right if
             it is set to container using `.innerHTML`, because it uses "text/html"
             parsing with "application/xhtml+xml" is required;
            */

        const domP = new DOMParser();
        const doc = domP.parseFromString(str.trim(), "application/xhtml+xml");
        doc.querySelectorAll("script").forEach((el) => void el.remove());
        doc.querySelectorAll("[src]").forEach((el) => {
            const src = el.getAttribute("src") as string;
            if (src.startsWith("http")) return;
            el.setAttribute("src", window.path.join(window.path.dirname(chapterPath), src));
            el.setAttribute("data-original-src", src);
        });
        doc.querySelectorAll("[href]").forEach((el) => {
            const href = el.getAttribute("href") as string;
            el.removeAttribute("href");
            if (href.startsWith("http")) {
                el.setAttribute("data-href", href);
            } else {
                el.setAttribute(
                    "data-href",
                    href.startsWith("#") ? href : window.path.join(window.path.dirname(chapterPath), href),
                );
                el.setAttribute("data-original-href", href);
            }
        });
        doc.querySelectorAll("svg image").forEach((el) => {
            const href = el.getAttribute("xlink:href") as string;
            if (href.startsWith("http")) return;
            el.setAttribute("xlink:href", window.path.join(window.path.dirname(chapterPath), href));
            el.setAttribute("data-src", window.path.join(window.path.dirname(chapterPath), href));
            el.setAttribute("data-original-xlink:href", href);
        });
        doc.querySelectorAll("[id]").forEach((el) => {
            const id = el.getAttribute("id") as string;
            el.setAttribute("data-epub-id", id);
            el.removeAttribute("id");
        });
        let txt = "";
        if (doc.documentElement.nodeName.toLowerCase() === "svg") {
            txt = doc.documentElement.outerHTML;
        } else {
            txt = doc.body.innerHTML;
        }

        //todo check if something like this can be done, test "[*|href]"
        // doc.querySelectorAll("[on*]").forEach((el) => el.removeAttribute("on*"));
        //remove all on* attributes
        txt = txt.replace(/(\s)(on\w+)(\s*=\s*["']?[^"'\s>]*?["'\s>])/gi, "");

        /*
             ! with a lot of performance testing on multiple large epub, using regex is significantly slower
             ! code is here for reference, remove later
            */
        return txt;
    }
    /**
     * Reading chapter using chapterPath is better instead of id, to avoid passing EPUB.EPUBContent[]
     * @param chapterPath path of chapter file inside extracted epub dir
     */
    static async readChapter(chapterPath: string): Promise<string> {
        try {
            chapterPath = window.decodeURI(chapterPath);
            if (!window.fs.existsSync(chapterPath)) throw new Error("EPUB::readChapter: Chapter file not found.");
            const raw = await window.fs.readFile(chapterPath, "utf-8");
            return await EPUB.parseChapter(raw, chapterPath);
        } catch (e) {
            if (e instanceof Error || typeof e === "string") window.logger.error(e);
            else window.logger.error("EPUB::readChapter: Error while reading chapter:", e);
            return `
            <p>An error occurred while reading epub files. It is possible that temporary files are deleted, try reloading.</p>
            <p>If it does not help then its possible that your epub file is malformed. You can try raising an issue 
            <a data-href="https://github.com/mienaiyami/yomikiru/issues">here</a> if you have original file.</p>
            <p>Keep it in mind that Yomikiru's EPUB reader is only a basic one, it does not follow full epub specs.</p>
            <code>${e}</code>
            `;
        }
    }
}
