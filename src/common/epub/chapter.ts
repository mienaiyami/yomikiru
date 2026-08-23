import type { LibraryPath } from "@common/library/io";

/** Web references that may leave the EPUB reader after user confirmation. */
const EXTERNAL_EPUB_REFERENCE = /^https?:\/\//i;

/** Serialized inline event attributes removed before chapter markup enters the reader DOM. */
const INLINE_EVENT_HANDLER_ATTRIBUTE = /\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** True when an EPUB reference is an HTTP(S) URL rather than an in-package path. */
export const isExternalEpubReference = (reference: string): boolean => EXTERNAL_EPUB_REFERENCE.test(reference);

/**
 * Resolves an EPUB chapter resource or navigation reference against its chapter file.
 * Fragment-only and external references are returned unchanged.
 */
export const resolveEpubChapterReference = (
    reference: string,
    chapterPath: string,
    path: Pick<LibraryPath, "dirname" | "join">,
): string => {
    if (!reference || reference.startsWith("#") || isExternalEpubReference(reference)) return reference;
    return path.join(path.dirname(chapterPath), reference);
};

/**
 * Removes serialized inline event attributes before EPUB chapter markup is inserted with innerHTML.
 * Script elements are removed separately while the chapter is still a DOM tree.
 */
export const stripEpubInlineEventHandlers = (markup: string): string =>
    markup.replace(INLINE_EVENT_HANDLER_ATTRIBUTE, "");
