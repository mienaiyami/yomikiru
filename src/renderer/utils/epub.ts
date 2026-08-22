import {
    parseExtractedEpubDir,
    resolveEpubChapterReference,
    stripEpubInlineEventHandlers,
    type EpubPackage,
} from "@common/epub";
import i18n from "@renderer/i18n";
import { dialogUtils } from "./dialog";
import { rendererLibraryIo, unzip } from "./file";
import { createRendererLogger } from "./logger";

const log = createRendererLogger("utils/epub");

/** Marker used to verify that a reusable extraction belongs to the requested EPUB. */
const EPUB_SOURCE_MARKER = "SOURCE";

/** Project issue page linked from the recoverable chapter-read error shown inside the reader. */
const EPUB_ISSUES_URL = "https://github.com/mienaiyami/yomikiru/issues";

/** Converts an unknown failure to safe diagnostic text for dialogs and reader markup. */
const errorDetail = (error: unknown): string => {
    if (error instanceof Error || typeof error === "string") return error.toString();
    return i18n.t("errors.unknownError", { ns: "reader" });
};

/** Shows an extraction failure with the platform-specific unzip guidance when available. */
const showEpubExtractError = async (error: unknown): Promise<void> => {
    const detail = errorDetail(error);
    await dialogUtils.customError({
        message: i18n.t("errors.extractError", { ns: "reader" }),
        detail: detail.includes("spawn unzip ENOENT")
            ? i18n.t("errors.unzipNotFound", { ns: "reader" })
            : detail,
    });
};

/**
 * Extracts an EPUB into `extractPath`, reusing a matching retained extraction when allowed.
 * Non-retained directories are registered for window-close cleanup.
 */
export const extractEpub = async (
    epubPath: string,
    extractPath: string,
    keepExtractedFiles: boolean,
): Promise<boolean> => {
    log.log(`EPUB extract: "${epubPath}" -> "${extractPath}"`);
    try {
        const sourceMarker = window.path.join(extractPath, EPUB_SOURCE_MARKER);
        if (
            keepExtractedFiles &&
            window.fs.existsSync(sourceMarker) &&
            window.fs.readFileSync(sourceMarker, "utf-8") === epubPath
        ) {
            log.log(`EPUB extract: reusing existing folder for "${epubPath}"`);
            return true;
        }

        if (!keepExtractedFiles) window.app.deleteDirOnClose = extractPath;
        if (window.fs.existsSync(extractPath)) {
            await window.fs.rm(extractPath, { recursive: true });
        }
        const result = await unzip(epubPath, extractPath);
        if (!result.ok) throw new Error(result.message);
        return true;
    } catch (error) {
        log.error("EPUB extract failed", { epubPath, extractPath }, error);
        await showEpubExtractError(error);
        return false;
    }
};

/** Parses an extracted EPUB with the shared package parser and reports reader-facing failures. */
const parseEpubPackage = async (extractPath: string): Promise<EpubPackage> => {
    try {
        return await parseExtractedEpubDir(extractPath, rendererLibraryIo());
    } catch (error) {
        log.error("EPUB package parse failed", { extractPath }, error);
        await dialogUtils.customError({
            message: i18n.t("errors.epubParseError", { ns: "reader" }),
            detail: errorDetail(error),
        });
        throw error;
    }
};

/**
 * Extracts and parses an EPUB for the reader.
 * The extraction directory is stable per basename so retained files can be reused.
 *
 * @throws {Error} When extraction or package parsing fails
 */
export const readEpubFile = async (epubPath: string, keepExtractedFiles: boolean): Promise<EpubPackage> => {
    const extractPath = window.path.join(
        window.electron.app.getPath("temp"),
        `yomikiru-temp-EPub-${window.path.basename(epubPath)}`,
    );
    if (!(await extractEpub(epubPath, extractPath, keepExtractedFiles))) {
        throw new Error("EPUB extraction failed");
    }
    return parseEpubPackage(extractPath);
};

/**
 * Rewrites one XHTML/SVG chapter for safe insertion into the reader DOM.
 * Package-relative resources become filesystem paths, navigation moves to `data-href`,
 * scripts and inline event handlers are removed, and ids move to `data-epub-id`.
 *
 * @throws {Error} When the chapter is malformed XML
 */
export const parseEpubChapter = (source: string, chapterPath: string): string => {
    /*
     * Parsing as XHTML is required here. Assigning the source to an HTML container
     * changes XML/SVG semantics in malformed but commonly encountered books.
     */
    const doc = new DOMParser().parseFromString(source.trim(), "application/xhtml+xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) throw new Error(`EPUB chapter XML parse failed: ${parseError.textContent ?? "unknown error"}`);

    doc.querySelectorAll("script").forEach((element) => element.remove());
    doc.querySelectorAll("[src]").forEach((element) => {
        const original = element.getAttribute("src");
        if (original === null) return;
        element.setAttribute("src", resolveEpubChapterReference(original, chapterPath, window.path));
        element.setAttribute("data-original-src", original);
    });
    doc.querySelectorAll("svg image").forEach((element) => {
        const attributeName = element.hasAttribute("href") ? "href" : "xlink:href";
        const original = element.getAttribute(attributeName);
        if (original === null) return;
        const resolved = resolveEpubChapterReference(original, chapterPath, window.path);
        element.setAttribute(attributeName, resolved);
        element.setAttribute("data-src", resolved);
        element.setAttribute("data-original-xlink-href", original);
    });
    doc.querySelectorAll("[href]").forEach((element) => {
        if (element.matches("svg image")) return;
        const original = element.getAttribute("href");
        if (original === null) return;
        element.removeAttribute("href");
        element.setAttribute("data-href", resolveEpubChapterReference(original, chapterPath, window.path));
        if (!original.startsWith("#")) element.setAttribute("data-original-href", original);
    });
    doc.querySelectorAll("[id]").forEach((element) => {
        const id = element.getAttribute("id");
        if (id === null) return;
        element.setAttribute("data-epub-id", id);
        element.removeAttribute("id");
    });

    const markup =
        doc.documentElement.nodeName.toLowerCase() === "svg"
            ? doc.documentElement.outerHTML
            : doc.body.innerHTML;
    /*
     * The serialized pass is retained because scanning attribute names through the
     * whole DOM is measurably expensive on very large chapters.
     */
    return stripEpubInlineEventHandlers(markup);
};

/** Builds escaped, localized recovery markup for a chapter that could not be read. */
const renderEpubChapterError = (error: unknown): string => {
    const doc = document.implementation.createHTMLDocument("");
    const appendParagraph = (text: string): void => {
        const paragraph = doc.createElement("p");
        paragraph.textContent = text;
        doc.body.appendChild(paragraph);
    };
    appendParagraph(i18n.t("errors.epubReadTemporaryFiles", { ns: "reader" }));
    appendParagraph(i18n.t("errors.epubReadMalformed", { ns: "reader" }));

    const support = doc.createElement("p");
    support.append(i18n.t("errors.epubReadSupportBefore", { ns: "reader" }));
    const link = doc.createElement("a");
    link.setAttribute("data-href", EPUB_ISSUES_URL);
    link.textContent = i18n.t("errors.epubReadSupportLink", { ns: "reader" });
    support.append(link, i18n.t("errors.epubReadSupportAfter", { ns: "reader" }));
    doc.body.appendChild(support);
    appendParagraph(i18n.t("errors.epubReaderScope", { ns: "reader" }));

    const code = doc.createElement("code");
    code.textContent = errorDetail(error);
    doc.body.appendChild(code);
    return doc.body.innerHTML;
};

/**
 * Reads and rewrites a chapter by its extracted file path.
 * Using the path avoids passing the complete manifest into each chapter component.
 */
export const readEpubChapter = async (chapterPath: string): Promise<string> => {
    try {
        const decodedPath = window.decodeURI(chapterPath);
        if (!window.fs.existsSync(decodedPath)) throw new Error("EPUB chapter file not found");
        const raw = await window.fs.readFile(decodedPath, "utf-8");
        return parseEpubChapter(raw, decodedPath);
    } catch (error) {
        log.error("EPUB chapter read failed", { chapterPath }, error);
        return renderEpubChapterError(error);
    }
};
