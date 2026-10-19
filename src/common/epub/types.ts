/**
 * EPUB package shapes shared by the reader and library scan.
 * These are the canonical package types for both the reader and library scan.
 */

/** Package metadata from the OPF (and TOC depth after NCX/nav parse). */
export type EpubMetaData = {
    title: string;
    author: string;
    cover: string;
    /** Directory that contains the OPF, inside the extracted EPUB tree. */
    opfDir: string;
    ncx_depth: number;
    /** Manifest id of the EPUB3 `properties="nav"` document, when present. */
    navId?: string;
};

/** One OPF manifest item, enriched with reader display data when a TOC entry matches it. */
export type EpubManifestItem = {
    id: string;
    href: string;
    mediaType: string;
    /** Reader display title copied from the matching TOC entry for quick access. */
    title?: string;
    /** Display order comes from the OPF spine, not the TOC. */
    order?: number;
    /** Nesting level copied from the matching TOC entry. */
    level?: number;
};

/** Manifest map keyed by item id. */
export type EpubManifest = Map<string, EpubManifestItem>;

/** Spine display order (`idref` + resolved href). */
export type EpubSpine = {
    id: string;
    href: string;
}[];

/** One TOC row (`navId` is not the spine id). */
export type EpubTocElement = {
    navId: string;
    title: string;
    href: string;
    level: number;
    chapterId?: string;
};

/** TOC keyed by `navId`. */
export type EpubToc = Map<string, EpubTocElement>;

/** Nested NCX/nav tree used by the reader sidebar. */
export type EpubNcxTree = {
    navId: string;
    ncx_index1: number;
    ncx_index2: number;
    level: number;
    sub: EpubNcxTree[];
};

/** Parsed extracted EPUB directory (package + TOC). */
export type EpubPackage = {
    metadata: EpubMetaData;
    manifest: EpubManifest;
    spine: EpubSpine;
    toc: EpubToc;
    ncx: EpubNcxTree[];
    styleSheets: string[];
};

/** NCX or nav parse result. */
export type EpubParsedToc = {
    ncx: EpubNcxTree[];
    ncx_depth: number;
    toc: EpubToc;
};
