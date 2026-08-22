/**
 * Shared EPUB package parse and process-neutral chapter reference helpers.
 * Chapter DOM rewriting stays in the renderer because main has no DOM implementation.
 */
export {
    isExternalEpubReference,
    resolveEpubChapterReference,
    stripEpubInlineEventHandlers,
} from "./chapter";
export { parseExtractedEpubDir } from "./parsePackage";
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
