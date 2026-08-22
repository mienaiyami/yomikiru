import path from "node:path";
import type { LibraryIo } from "@common/library/io";
import { describe, expect, it } from "vitest";
import { parseExtractedEpubDir } from "./parsePackage";

/**
 * In-memory {@link LibraryIo} keyed by `path.join` paths.
 */
const ioForFiles = (files: Record<string, string>): LibraryIo => ({
    fs: {
        existsSync: (p) => p in files,
        isDir: () => false,
        isFile: (p) => p in files,
        readdir: async () => [],
        readFile: async (p) => {
            const body = files[p];
            if (body === undefined) throw new Error(`missing ${p}`);
            return body;
        },
        access: async () => undefined,
        stat: async () => ({ mtimeMs: 0 }),
        constants: { R_OK: 4 },
    },
    path,
});

describe("parseExtractedEpubDir", () => {
    it("reads dc:title, creators, and meta[name=cover] from the OPF", async () => {
        const root = path.join("epub");
        const container = path.join(root, "META-INF", "container.xml");
        const opf = path.join(root, "OEBPS", "content.opf");
        const cover = path.join(root, "OEBPS", "Images", "cover.jpg");
        const chapter = path.join(root, "OEBPS", "Text", "ch1.xhtml");
        const files: Record<string, string> = {
            [root]: "",
            [container]: `<?xml version="1.0"?>
                <container>
                  <rootfiles>
                    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
                  </rootfiles>
                </container>`,
            [opf]: `<?xml version="1.0"?>
                <package xmlns:dc="http://purl.org/dc/elements/1.1/">
                  <metadata>
                    <dc:title>Namespaced Title</dc:title>
                    <dc:creator>Ann</dc:creator>
                    <dc:creator>Bob</dc:creator>
                    <meta name="cover" content="cov"/>
                  </metadata>
                  <manifest>
                    <item id="cov" href="Images/cover.jpg" media-type="image/jpeg"/>
                    <item id="c1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>
                  </manifest>
                  <spine>
                    <itemref idref="c1"/>
                  </spine>
                </package>`,
            [cover]: "jpeg",
            [chapter]: "<html/>",
        };
        const pkg = await parseExtractedEpubDir(root, ioForFiles(files));
        expect(pkg.metadata.title).toBe("Namespaced Title");
        expect(pkg.metadata.author).toBe("Ann, Bob");
        expect(pkg.metadata.cover).toBe(cover);
        expect(pkg.spine).toEqual([{ id: "c1", href: chapter }]);
    });

    it("falls back to properties=cover-image when meta cover is absent", async () => {
        const root = path.join("epub3");
        const container = path.join(root, "META-INF", "container.xml");
        const opf = path.join(root, "content.opf");
        const cover = path.join(root, "cover.jpg");
        const nav = path.join(root, "nav.xhtml");
        const chapter = path.join(root, "c.xhtml");
        const files: Record<string, string> = {
            [root]: "",
            [container]: `<container><rootfile full-path="content.opf"/></container>`,
            [opf]: `<package>
                  <metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">V3</dc:title></metadata>
                  <manifest>
                    <item id="cov" href="cover.jpg" media-type="image/jpeg" properties="cover-image scripted"/>
                    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="scripted nav"/>
                    <item id="c1" href="c.xhtml" media-type="application/xhtml+xml"/>
                  </manifest>
                  <spine><itemref idref="c1"/></spine>
                </package>`,
            [cover]: "x",
            [nav]: `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
                <nav epub:type="landmarks"><ol><li><a href="cover.jpg">Cover</a></li></ol></nav>
                <nav epub:type="toc"><ol><li><a href="c.xhtml">Chapter <span>One</span></a></li></ol></nav>
              </html>`,
            [chapter]: "<html/>",
        };
        const pkg = await parseExtractedEpubDir(root, ioForFiles(files));
        expect(pkg.metadata.title).toBe("V3");
        expect(pkg.metadata.cover).toBe(cover);
        expect(pkg.metadata.navId).toBe("nav");
        expect([...pkg.toc.values()][0]?.title).toBe("Chapter One");
    });

    it("reads an EPUB 2 package and NCX with legacy declarations and entities", async () => {
        const root = path.join("epub2-legacy");
        const container = path.join(root, "META-INF", "container.xml");
        const opf = path.join(root, "OEBPS", "content.opf");
        const ncx = path.join(root, "OEBPS", "toc.ncx");
        const chapter = path.join(root, "OEBPS", "Text", "chapter.xhtml");
        const files: Record<string, string> = {
            [root]: "",
            [container]: `<container><rootfile full-path="OEBPS/content.opf"/></container>`,
            [opf]: `<!DOCTYPE package [<!ENTITY bookTitle "Archive Book">]>
                <package xmlns:dc="http://purl.org/dc/elements/1.1/">
                  <metadata><dc:title>&bookTitle;</dc:title></metadata>
                  <manifest>
                    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
                    <item id="chapter" href="Text/chapter.xhtml" media-type="application/xhtml+xml"/>
                  </manifest>
                  <spine toc="ncx"><itemref idref="chapter"/></spine>
                </package>`,
            [ncx]: `<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN"
                "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
                <ncx><navMap><navPoint id="chapter-nav">
                  <navLabel><text>Chapter&nbsp;One</text></navLabel>
                  <content src="Text/chapter.xhtml"/>
                </navPoint></navMap></ncx>`,
            [chapter]: "<html/>",
        };
        const pkg = await parseExtractedEpubDir(root, ioForFiles(files));
        expect(pkg.metadata.title).toBe("Archive Book");
        expect(pkg.toc.get("chapter-nav")).toMatchObject({
            title: "Chapter\u00a0One",
            href: chapter,
            chapterId: "chapter",
        });
    });
});
