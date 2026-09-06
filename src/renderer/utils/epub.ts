import {
    type EpubPackage,
    inChapterFractionFromLayout,
    normalizeSpineWeights,
    parseExtractedEpubDir,
    resolveEpubChapterReference,
    stripEpubInlineEventHandlers,
} from "@common/epub";
import i18n from "@renderer/i18n";
import { dialogUtils } from "./dialog";
import { rendererLibraryIo, unzip } from "./file";
import { createRendererLogger } from "./logger";
import { getCSSPath } from "./utils";

const log = createRendererLogger("utils/epub");

/** Marker used to verify that a reusable extraction belongs to the requested EPUB. */
const EPUB_SOURCE_MARKER = "SOURCE";

/** Project issue page linked from the recoverable chapter-read error shown inside the reader. */
const EPUB_ISSUES_URL = "https://github.com/mienaiyami/yomikiru/issues";

/** Class on in-chapter find marks; CSS lives on `#EPubReader .findInPage-highlight`. */
const FIND_HIGHLIGHT_CLASS = "findInPage-highlight";

/** HTMLPart root id prefix (`epub-${chapterId}`). */
export const EPUB_CHAPTER_ROOT_PREFIX = "epub-";

/** Bounds layout settling while newly mounted chapters are measured. */
export const EPUB_LOCATOR_SETTLE_FRAMES = 60;

/** Stop settling when the target is this close to the scroller top (px). */
export const EPUB_LOCATOR_SETTLE_PX = 2;

/** Consecutive layout frames with no correction before releasing a navigation target. */
const EPUB_LOCATOR_STABLE_FRAMES = 3;

/** Bounds waiting for an asynchronously read chapter without tying IO to display frame rate. */
const EPUB_CHAPTER_MOUNT_TIMEOUT_MS = 8000;

/** A persisted chapter locator and its optional window-local alignment during reflow. */
export type EpubReadingPlace = {
    chapterId: string;
    position: string;
    /** Pixel position inside the viewport; omitted when reopening a persisted paragraph. */
    viewportOffset?: number;
};

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
        detail: detail.includes("spawn unzip ENOENT") ? i18n.t("errors.unzipNotFound", { ns: "reader" }) : detail,
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

    doc.querySelectorAll("script").forEach((element) => {
        element.remove();
    });
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
        doc.documentElement.nodeName.toLowerCase() === "svg" ? doc.documentElement.outerHTML : doc.body.innerHTML;
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

/**
 * File sizes of extracted spine hrefs, normalized so empty files still have weight.
 */
export const spineFileWeights = async (spineHrefs: readonly string[]): Promise<number[]> => {
    const sizes = await Promise.all(
        spineHrefs.map(async (href) => {
            try {
                const decodedPath = window.decodeURI(href);
                if (!window.fs.existsSync(decodedPath)) return 0;
                const stats = await window.fs.stat(decodedPath);
                const size = "size" in stats && typeof stats.size === "number" ? stats.size : 0;
                return size;
            } catch {
                return 0;
            }
        }),
    );
    return normalizeSpineWeights(sizes);
};

/** Unwraps find marks so click handlers on surrounding nodes stay attached. */
export const clearEpubFindHighlights = (root: ParentNode): void => {
    root.querySelectorAll(`span.${FIND_HIGHLIGHT_CLASS}`).forEach((span) => {
        const parent = span.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(span.textContent ?? ""), span);
        parent.normalize();
    });
};

/**
 * Wraps case-insensitive substring hits in `root` and returns the nth mark, or null.
 * ponytail: substring only; does not compile the query as a regex.
 */
export const highlightNthFindMatch = (
    root: HTMLElement,
    query: string,
    occurrenceInChapter: number,
): HTMLElement | null => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    clearEpubFindHighlights(root);
    const lowerQuery = trimmed.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.data.length > 0) textNodes.push(node);
    }
    let seen = 0;
    let currentMark: HTMLElement | null = null;
    for (const textNode of textNodes) {
        const lowerData = textNode.data.toLowerCase();
        const parts: (string | HTMLElement)[] = [];
        let from = 0;
        while (from <= lowerData.length - lowerQuery.length) {
            const at = lowerData.indexOf(lowerQuery, from);
            if (at < 0) break;
            if (at > from) parts.push(textNode.data.slice(from, at));
            const mark = document.createElement("span");
            mark.className = FIND_HIGHLIGHT_CLASS;
            mark.textContent = textNode.data.slice(at, at + trimmed.length);
            if (seen === occurrenceInChapter) {
                mark.classList.add("current");
                currentMark = mark;
            }
            parts.push(mark);
            seen += 1;
            from = at + lowerQuery.length;
        }
        if (parts.length === 0) continue;
        if (from < textNode.data.length) parts.push(textNode.data.slice(from));
        const parent = textNode.parentNode;
        if (!parent) continue;
        for (const part of parts) {
            parent.insertBefore(typeof part === "string" ? document.createTextNode(part) : part, textNode);
        }
        parent.removeChild(textNode);
    }
    return currentMark;
};

/**
 * DOM id of the {@link HTMLPart} root for `chapterId`.
 */
export const epubChapterRootId = (chapterId: string): string => `${EPUB_CHAPTER_ROOT_PREFIX}${chapterId}`;

/**
 * Spine chapter id from an `.htmlCont` node, or empty when the id is not a chapter root.
 */
export const chapterIdFromHtmlCont = (htmlCont: Element): string => {
    const { id } = htmlCont;
    return id.startsWith(EPUB_CHAPTER_ROOT_PREFIX) ? id.slice(EPUB_CHAPTER_ROOT_PREFIX.length) : "";
};

/** Resolves an internal link against the chapter containing the clicked anchor. */
export const originSpineIndexFromClick = (
    eventTarget: EventTarget | null,
    spine: EpubPackage["spine"],
    fallbackIndex: number,
): number => {
    if (!(eventTarget instanceof Element)) return fallbackIndex;
    const chapterRoot = eventTarget.closest(".htmlCont");
    if (!chapterRoot) return fallbackIndex;
    const chapterId = chapterIdFromHtmlCont(chapterRoot);
    const spineIndex = spine.findIndex((chapter) => chapter.id === chapterId);
    return spineIndex >= 0 ? spineIndex : fallbackIndex;
};

/**
 * Spine index from a virtualized row's `data-index`, or null when missing/invalid.
 */
export const spineIndexFromSpineRow = (spineRow: Element): number | null => {
    const raw = spineRow.getAttribute("data-index");
    if (raw === null || raw === "") return null;
    const spineIndex = Number(raw);
    return Number.isInteger(spineIndex) && spineIndex >= 0 ? spineIndex : null;
};

/**
 * Scroller content Y of `element` from on-screen boxes, not virtualizer `start`.
 * Unmeasured rows above make TanStack `virtualItem.start` disagree with this.
 */
export const scrollYOfElement = (scroller: HTMLElement, element: Element): number => {
    const scrollerBox = scroller.getBoundingClientRect();
    const elementBox = element.getBoundingClientRect();
    return scroller.scrollTop + (elementBox.top - scrollerBox.top);
};

/**
 * Mounted `.epubSpineItem` whose box contains the scroller's top edge.
 */
export const spineRowAtReaderTop = (reader: HTMLElement): HTMLElement | null => {
    const readerTop = reader.getBoundingClientRect().top;
    const rows = [...reader.querySelectorAll<HTMLElement>(".epubSpineItem")];
    const occupying = rows.find((row) => {
        const box = row.getBoundingClientRect();
        return box.top <= readerTop + 1 && box.bottom > readerTop + 1;
    });
    if (occupying) return occupying;
    return [...rows].reverse().find((row) => row.getBoundingClientRect().top <= readerTop + 1) ?? rows[0] ?? null;
};

/**
 * How far through a mounted spine row the scroller is, from live boxes (not estimated prefix).
 */
export const inChapterFractionFromSpineRow = (reader: HTMLElement, spineRow: HTMLElement): number => {
    const chapterRoot = spineRow.querySelector<HTMLElement>(".htmlCont") ?? spineRow;
    return inChapterFractionFromLayout(
        reader.scrollTop,
        scrollYOfElement(reader, chapterRoot),
        chapterRoot.getBoundingClientRect().height,
    );
};

/**
 * Finds a stored CSS locator inside one chapter root.
 * Tries a path scoped to the chapter first, then a document-wide path that still sits in this root.
 */
export const queryEpubPosition = (chapterRoot: HTMLElement, position: string): Element | null => {
    if (!position) return null;
    try {
        if (chapterRoot.matches(position)) return chapterRoot;
        const scoped = chapterRoot.querySelector(position);
        if (scoped) return scoped;
    } catch {
        /* invalid selector from an older locator */
    }
    try {
        const global = document.querySelector(position);
        if (global && chapterRoot.contains(global)) return global;
    } catch {
        /* invalid selector from an older locator */
    }
    return null;
};

type EpubLocatorSettleOptions = {
    /** Stop when a newer restore/seek owns the generation token. */
    shouldAbort?: () => boolean;
    /** Yield between apply passes (defaults to one animation frame). */
    waitFrame?: () => Promise<void>;
    /** Use the virtualizer's offset API to replace any outstanding index navigation. */
    scrollTo?: (scrollTop: number) => void;
};

/** Yields to layout and ResizeObserver delivery before checking a scroll target again. */
const defaultWaitFrame = (): Promise<void> =>
    new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });

/**
 * Recomputes a live DOM destination after layout frames until its offset stops changing.
 * The resolver returns null when the destination is no longer available; cancellation returns false.
 */
export const settleEpubScroll = async (
    reader: HTMLElement,
    resolveScrollTop: () => number | null,
    options: EpubLocatorSettleOptions = {},
): Promise<boolean> => {
    const waitFrame = options.waitFrame ?? defaultWaitFrame;
    let stableFrames = 0;
    for (let pass = 0; pass < EPUB_LOCATOR_SETTLE_FRAMES; pass++) {
        await waitFrame();
        if (options.shouldAbort?.() || !reader.isConnected) return false;
        const scrollTop = resolveScrollTop();
        if (scrollTop === null || !Number.isFinite(scrollTop)) return false;
        if (Math.abs(scrollTop - reader.scrollTop) <= EPUB_LOCATOR_SETTLE_PX) {
            stableFrames += 1;
            if (stableFrames >= EPUB_LOCATOR_STABLE_FRAMES) return true;
        } else {
            stableFrames = 0;
            if (options.scrollTo) options.scrollTo(scrollTop);
            else reader.scrollTop = scrollTop;
        }
    }
    return false;
};

/**
 * Captures a chapter-scoped reading place with a bounded number of viewport hit tests.
 * The stored selector includes the chapter root so chapter-at-a-time restore remains compatible.
 */
export const captureEpubReadingPlace = (reader: HTMLElement): EpubReadingPlace | null => {
    const readerBox = reader.getBoundingClientRect();
    const readerTop = Math.max(0, readerBox.top);
    const readerBottom = Math.min(window.innerHeight, readerBox.bottom);
    const spineRow = spineRowAtReaderTop(reader);
    const chapterRoot =
        spineRow?.querySelector<HTMLElement>(".htmlCont") ?? reader.querySelector<HTMLElement>(".htmlCont");
    if (!chapterRoot || readerBottom <= readerTop) return null;
    const chapterBox = chapterRoot.getBoundingClientRect();
    const left = Math.max(readerBox.left, chapterBox.left);
    const right = Math.min(readerBox.right, chapterBox.right);
    let hitChapterSurface = false;
    for (const yOffset of [4, 20, 48]) {
        const sampleY = Math.min(readerBottom - 1, readerTop + yOffset);
        for (const xFraction of [0.5, 0.25, 0.75]) {
            const target = document.elementFromPoint(left + (right - left) * xFraction, sampleY);
            if (target && (target === chapterRoot || (spineRow && spineRow.contains(target))))
                hitChapterSurface = true;
            if (!target || target === chapterRoot || !chapterRoot.contains(target)) continue;
            // skip transient find/highlight wrappers so clearing highlights cannot invalidate progress
            const element = target.closest(".findInPage-highlight, .text-highlight")?.parentElement ?? target;
            return {
                chapterId: chapterIdFromHtmlCont(chapterRoot),
                position: getCSSPath(element),
                viewportOffset: element.getBoundingClientRect().top - readerBox.top,
            };
        }
    }
    // an overlay can hide every sample; keep the last locator instead of replacing it with chapter start
    if (!hitChapterSurface) return null;
    return {
        chapterId: chapterIdFromHtmlCont(chapterRoot),
        position: getCSSPath(chapterRoot),
        viewportOffset: chapterBox.top - readerBox.top,
    };
};

/**
 * Waits for chapter injection, including valid empty chapters, and disconnects on completion or abort.
 */
export const waitForEpubChapterRoot = (
    reader: HTMLElement,
    chapterId: string,
    signal: AbortSignal,
): Promise<HTMLElement | null> =>
    new Promise((resolve) => {
        const findReadyChapter = () => {
            const chapterRoot = document.getElementById(epubChapterRootId(chapterId));
            return chapterRoot && reader.contains(chapterRoot) && chapterRoot.dataset.epubReady === "true"
                ? chapterRoot
                : null;
        };
        const readyChapter = findReadyChapter();
        if (signal.aborted || readyChapter) {
            resolve(signal.aborted ? null : readyChapter);
            return;
        }
        const finish = (chapterRoot: HTMLElement | null) => {
            observer.disconnect();
            window.clearTimeout(timeoutId);
            signal.removeEventListener("abort", onAbort);
            resolve(chapterRoot);
        };
        const onAbort = () => finish(null);
        const observer = new MutationObserver(() => {
            const chapterRoot = findReadyChapter();
            if (chapterRoot) finish(chapterRoot);
        });
        const timeoutId = window.setTimeout(() => finish(null), EPUB_CHAPTER_MOUNT_TIMEOUT_MS);
        observer.observe(reader, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-epub-ready"],
        });
        signal.addEventListener("abort", onAbort, { once: true });
    });
