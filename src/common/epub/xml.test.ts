import { describe, expect, it } from "vitest";
import { parseXml, xmlAttr, xmlChildrenNamed, xmlFind, xmlFindAll } from "./xml";

describe("parseXml", () => {
    it("reads namespaced elements by local name and attributes", () => {
        const root = parseXml(`<?xml version="1.0"?>
            <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/">
              <metadata>
                <dc:title>Hello &amp; World</dc:title>
                <dc:creator>A</dc:creator>
                <dc:creator>B</dc:creator>
                <meta name="cover" content="cover-id"/>
              </metadata>
              <manifest>
                <item id="cover-id" href="Images/cover.jpg" media-type="image/jpeg"/>
              </manifest>
            </package>`);
        expect(root.name).toBe("package");
        expect(xmlFind(root, "title")?.text).toBe("Hello & World");
        expect(xmlFindAll(root, "creator").map((n) => n.text)).toEqual(["A", "B"]);
        const meta = xmlFindAll(root, "meta").find((el) => xmlAttr(el, "name") === "cover");
        expect(xmlAttr(meta!, "content")).toBe("cover-id");
        const item = xmlChildrenNamed(xmlFind(root, "manifest")!, "item")[0];
        expect(xmlAttr(item!, "href")).toBe("Images/cover.jpg");
    });

    it("parses self-closing rootfile and CDATA", () => {
        const root = parseXml(`<container>
            <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
            <x><![CDATA[a<b>]]></x>
          </container>`);
        expect(xmlAttr(xmlFind(root, "rootfile")!, "full-path")).toBe("OEBPS/content.opf");
        expect(xmlFind(root, "x")?.text).toBe("a<b>");
    });

    it("preserves descendant text and rejects malformed XML", () => {
        const root = parseXml("<nav><a href='chapter.xhtml'>Chapter <span>One</span></a></nav>");
        expect(xmlFind(root, "a")?.text).toBe("Chapter One");
        expect(() => parseXml("<package><metadata></package>")).toThrow("parseXml:");
    });

    it("accepts EPUB 2 public DTD declarations", () => {
        const root = parseXml(`<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN"
            "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
            <ncx><navMap/></ncx>`);
        expect(root.name).toBe("ncx");
        expect(xmlFind(root, "navMap")?.name).toBe("navmap");
    });

    it("accepts internal DTD entities used by older package documents", () => {
        const root = parseXml(`<!DOCTYPE package [<!ENTITY title "Old Book">]>
            <package><metadata><title>&title;</title></metadata></package>`);
        expect(xmlFind(root, "title")?.text).toBe("Old Book");
    });

    it("decodes common HTML entities found in scraped package metadata", () => {
        const root = parseXml("<package><metadata><title>Old&nbsp;Book &copy;</title></metadata></package>");
        expect(xmlFind(root, "title")?.text).toBe("Old\u00a0Book \u00a9");
    });
});
