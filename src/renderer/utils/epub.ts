import { unzip } from "cross-zip";
import fs from "fs/promises";
import path from "path";

const unzipAsync = (zipPath: string, extractPath: string) => {
    return new Promise<void>((resolve, reject) => {
        unzip(zipPath, extractPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

export default class EPUB {
    static async extractEpub(epubPath: string, extractPath: string, keepExtractedFiles: boolean) {
        console.log("EPUB::extractEpub : extracting ", epubPath, " at ", extractPath);
        try {
            if (
                keepExtractedFiles &&
                window.fs.existsSync(path.join(extractPath, "SOURCE")) &&
                window.fs.readFileSync(path.join(extractPath, "SOURCE"), "utf-8") === epubPath
            ) {
                console.log("EPUB::extractEpub : Found old epub extract.");
                return true;
            } else {
                if (!keepExtractedFiles) window.app.deleteDirOnClose = extractPath;
                try {
                    await unzipAsync(epubPath, extractPath);
                    if (keepExtractedFiles) window.fs.writeFileSync(path.join(extractPath, "SOURCE"), epubPath);
                    return true;
                } catch (err) {
                    if (err instanceof Error) {
                        if (err.message.includes("spawn unzip ENOENT")) {
                            window.dialog.customError({
                                message: "Error while extracting.",
                                detail: '"unzip" not found. Please install by using\n"sudo apt install unzip"',
                            });
                        } else
                            window.dialog.customError({
                                message: "Error while extracting.",
                                detail: err.message,
                            });
                        throw new Error("Error while extracting.");
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error || typeof err === "string")
                window.dialog.customError({
                    message: "An Error occurred while checking/extracting epub.",
                    detail: err.toString(),
                });
            else window.logger.error("An Error occurred while checking/extracting epub:", err);
            throw new Error("Error while extracting.");
        }
    }
    /**
     *
     * @param path path of extracted epub file
     */
    static async parseEpubDir(dirPath: string): Promise<{
        metadata: EPUB.MetaData;
        manifest: EPUB.Manifest;
        spine: EPUB.Spine;
        toc: EPUB.TOC;
        ncx: EPUB.NCXTree[];
        styleSheets: string[];
    }> {
        try {
            const exists = (p: string) => window.fs.existsSync(p);
            if (!window.fs.existsSync) throw new Error("parseEpubDir: Path does not exist.");
            const parser = new DOMParser();
            const containerPath = path.join(dirPath, "META-INF/container.xml");
            if (!exists(containerPath)) throw new Error("parseEpubDir: container.xml not found.");
            const containerRaw = await fs.readFile(containerPath, "utf-8");
            const container = parser.parseFromString(containerRaw, "text/xml");
            const rootfile = container.querySelector("rootfile")?.getAttribute("full-path");
            if (!rootfile) throw new Error("parseEpubDir: rootfile not found.");
            const opfPath = path.join(dirPath, rootfile);
            if (!exists(opfPath)) throw new Error("parseEpubDir: opf file not found.");
            const opfRaw = await fs.readFile(opfPath, "utf-8");
            const opf = parser.parseFromString(opfRaw, "text/xml");

            const coverId = opf.querySelector("meta[name='cover']")?.getAttribute("content");
            const coverSrc = coverId
                ? opf.querySelector(`manifest > item[id='${coverId}']`)?.getAttribute("href") || ""
                : "";
            const metadata: EPUB.MetaData = {
                title: opf.getElementsByTagName("dc:title")[0]?.textContent || "No Title",
                author: [...opf.getElementsByTagName("dc:creator")].map((el) => el.textContent).join(", "),
                // description: opf.querySelector("dc:description")?.textContent || "No Description",
                cover: path.join(path.dirname(opfPath), coverSrc),
                opfDir: path.dirname(opfPath),
                ncx_depth: 0,
                navId: opf.querySelector("manifest > item[properties='nav']")?.getAttribute("id") || "",
            };
            const manifestItems = opf.querySelectorAll("manifest > item");
            if (manifestItems.length === 0) throw new Error("parseEpubDir: No manifest items found.");
            const styleSheets = Array.from(manifestItems)
                .filter((el) => el.getAttribute("media-type") === "text/css")
                .map((el) => {
                    const href = el.getAttribute("href");
                    if (!href) return "";
                    return path.join(metadata.opfDir, href);
                })
                .filter((el) => el);
            const manifest: EPUB.Manifest = new Map();
            manifestItems.forEach((el) => {
                const id = el.getAttribute("id");
                let href = el.getAttribute("href");
                if (!id || !href) return;
                href = path.join(metadata.opfDir, href);
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

            const ncxPath = opf
                .querySelector("manifest > item[media-type='application/x-dtbncx+xml']")
                ?.getAttribute("href");
            if (!ncxPath)
                throw new Error("parseEpubDir: No ncx file found. todo: display whole spine if no ncx found");
            const ncxRaw = await fs.readFile(path.join(path.dirname(opfPath), ncxPath), "utf-8");
            const ncxXML = parser.parseFromString(ncxRaw, "text/xml");
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
                    src = path.join(path.dirname(path.join(path.dirname(opfPath), ncxPath)), src);
                    //todo check if need to add check for duplicate starting string in src, like "Text/Text/",
                    // check comment in prev version

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
            metadata.ncx_depth = ncx_depth;
            return { metadata, manifest, spine, toc, ncx, styleSheets };
        } catch (e) {
            if (e instanceof Error || e instanceof String)
                window.dialog.customError({
                    message: "Error while parsing epub.",
                    detail: e.toString(),
                });
            throw e;
        }
    }
    static async readEpubFile(epubPath: string, keepExtractedFiles: boolean) {
        const extractPath = path.join(
            window.electron.app.getPath("temp"),
            `yomikiru-temp-EPub-${epubPath.split(path.sep).at(-1)}`
        );
        // const now = performance.now();
        const extractSuccess = await EPUB.extractEpub(epubPath, extractPath, keepExtractedFiles);
        if (!extractSuccess) throw new Error("Error while extracting.");
        const parsed = await EPUB.parseEpubDir(extractPath);
        // console.log(performance.now() - now);
        return parsed;
    }
    /**
     * Reading chapter using chapterPath is better instead of id, to avoid passing EPUB.EPUBContent[]
     * @param chapterPath path of chapter file inside extracted epub dir
     */
    static async readChapter(chapterPath: string) {
        try {
            chapterPath = window.decodeURI(chapterPath);
            if (!window.fs.existsSync(chapterPath)) throw new Error("EPUB::readChapter: Chapter file not found.");
            const raw = await fs.readFile(chapterPath, "utf-8");
            // const now = performance.now();

            /*
             was planning to only use regex, but some tags don't get parsed right if
             it is set to container using `.innerHTML`, because it uses "text/html"
             parsing with "application/xhtml+xml" is required;
            */

            const domP = new DOMParser();
            const doc = domP.parseFromString(raw, "application/xhtml+xml");
            doc.querySelectorAll("script").forEach((el) => el.remove());
            doc.querySelectorAll("[src]").forEach((el) => {
                const src = el.getAttribute("src") as string;
                if (src.startsWith("http")) return;
                el.setAttribute("src", path.join(path.dirname(chapterPath), src));
                el.setAttribute("data-original-src", src);
            });
            doc.querySelectorAll("[href]").forEach((el) => {
                const href = el.getAttribute("href") as string;
                if (href.startsWith("http")) {
                    el.setAttribute("data-href", href);
                } else {
                    el.setAttribute(
                        "data-href",
                        href.startsWith("#") ? href : path.join(path.dirname(chapterPath), href)
                    );
                    el.setAttribute("data-original-href", href);
                }
            });
            doc.querySelectorAll("svg image").forEach((el) => {
                const href = el.getAttribute("xlink:href") as string;
                if (href.startsWith("http")) return;
                el.setAttribute("xlink:href", path.join(path.dirname(chapterPath), href));
                el.setAttribute("data-src", path.join(path.dirname(chapterPath), href));
                el.setAttribute("data-original-xlink:href", href);
            });
            doc.querySelectorAll("[id]").forEach((el) => {
                const id = el.getAttribute("id") as string;
                el.setAttribute("data-epub-id", id);
                el.removeAttribute("id");
            });
            let txt = doc.body.innerHTML;
            //todo check if something like this can be done, test "[*|href]"
            // doc.querySelectorAll("[on*]").forEach((el) => el.removeAttribute("on*"));
            //remove all on* attributes
            txt = txt.replace(/(\s)(on\w+)(\s*=\s*["']?[^"'\s>]*?["'\s>])/gi, "");

            /*
             ! with a lot of performance testing on multiple large epub, using regex is significantly slower
             ! code is here for reference, remove later
            */

            // // get body only
            // let txt = raw.match(/<body[^>]*>\1([\s\S]*)<\/body>/i)?.at(1) || "Unable to parse chapter.";

            // txt = txt.replace(/<script[^>]*>[\s\S]*?<\/script>/i, "");
            // //remove all on* attributes
            // txt = txt.replace(/(\s)(on\w+)(\s*=\s*["']?[^"'\s>]*?["'\s>])/gi, "");
            // txt = txt.replace(/(?<=\s|^)(src=)(["']?)([^"'\n]*?)(\2)/gi, (...args) => {
            //     const src = args[3];
            //     if (src.startsWith("http")) return args[0];
            //     return `src="${path.join(path.dirname(chapterPath), src)}" data-original-src="${src}" `;
            // });
            // txt = txt.replace(/(?<=\s|^)(href=)(["']?)([^"'\n]*?)(\2)/gi, (...args) => {
            //     const href = args[3] as string;
            //     if (href.startsWith("http"))
            //         // return args[0];
            //         return `data-href="${href}"`;
            //     // need to be data-href so it doesn't get modified by browser
            //     return `data-href="${
            //         href.startsWith("#") ? href : path.join(path.dirname(chapterPath), href)
            //     }" data-original-href="${href}"`;
            // });
            // // for svg images
            // txt = txt.replace(/(?<=\s|^)(xlink:href=)(["']?)([^"'\n]*?)(\2)/gi, (...args) => {
            //     const href = args[3] as string;
            //     if (href.startsWith("http")) return args[0];
            //     return `xlink:href="${path.join(
            //         path.dirname(chapterPath),
            //         href
            //     )}" data-original-xlink:href="${href}"`;
            // });
            // // replacing id so that it doesn't conflict with other elements
            // txt = txt.replace(/(?<=\s|^)(id=)/gi, "data-epub-id=");

            // console.log("parsed chapter", performance.now() - now + "ms");
            return txt;
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
