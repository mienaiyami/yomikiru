/**
 * Shared EPUB package parse and process-neutral chapter reference helpers.
 * Chapter DOM rewriting stays in the renderer because main has no DOM implementation.
 */
export {
    findSpineIndexByHref,
    isExternalEpubReference,
    resolveEpubChapterReference,
    stripEpubInlineEventHandlers,
} from "./chapter";
export {
    type EpubArchiveMetadata,
    type EpubArchiveReader,
    parseEpubArchiveMetadata,
    parseExtractedEpubDir,
} from "./parsePackage";
export {
    countCaseInsensitiveMatches,
    estimateSpineItemHeight,
    formatPublicationPercent,
    inChapterFractionFromLayout,
    MIN_SPINE_ITEM_ESTIMATE_PX,
    normalizeSpineWeights,
    PUBLICATION_PERCENT_DECIMALS,
    publicationFraction,
    publicationPercent,
    SPINE_VIRTUAL_OVERSCAN,
    type SpineHeightEstimate,
    scrollTopFromInChapterFraction,
    spineIndexFromPublicationFraction,
    ZERO_SPINE_WEIGHT,
} from "./progress";
export type {
    EpubManifest,
    EpubManifestItem,
    EpubMetaData,
    EpubNcxTree,
    EpubPackage,
    EpubParsedToc,
    EpubSpine,
    EpubToc,
    EpubTocElement,
} from "./types";
