# EPUB package parse (`src/common/epub`)

Shared **package** parsing for extracted EPUB trees: `container.xml`, OPF (title, authors, cover, manifest, spine), then NCX or EPUB3 `nav`. Used by library scan in main and by the book reader after unzip. The shared package types replace the old renderer-global `EPUB` namespace.

Process-neutral chapter reference resolution and serialized event-handler removal live in `chapter.ts`. Chapter DOM traversal (`script` removal, attribute rewriting, id remapping) stays in `src/renderer/utils/epub.ts` because main has no DOM implementation. Renderer EPUB APIs are named functions rather than a static class.

XML is parsed with `fast-xml-parser` in `xml.ts`, then adapted to the small namespace-agnostic tree API used by the package readers. XML is validated before conversion while retaining compatibility with EPUB 2 DTD declarations, internal entities, and common HTML entities found in web-generated package files. Spine hrefs are indexed once before NCX/nav processing so large tables of contents do not repeatedly scan the spine. Tests cover namespace-prefixed metadata, legacy declarations and entities, nested nav text, multi-token manifest properties, malformed XML, chapter references and event handlers, and `meta[name=cover]`.
