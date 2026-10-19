import type { EpubManifest } from "@common/epub";
import { useAppContext } from "@renderer/App";
import { useAppSelector } from "@store/hooks";
import { queryEpubPosition, readEpubChapter } from "@utils/epub";
import { highlightUtils } from "@utils/highlight";
import { createRendererLogger } from "@utils/logger";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { shallowEqual } from "react-redux";

const log = createRendererLogger("epub/HTMLPart");

/** Injects one chapter and its notes while preserving DOM across progress and callback updates. */
const HTMLPart = memo(
    ({
        epubManifest,
        onEpubLinkClick,
        currentChapter,
        onHtmlInjected,
    }: {
        epubManifest: EpubManifest;
        currentChapter: {
            id: string;
            /** Fragment identifier within the chapter. */
            fragment: string;
            /** Initial stored locator, with priority over the fragment. */
            elementQuery: string;
        };
        onEpubLinkClick: (event: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
        /** Signals completed injection, including valid empty chapters, for continuous row measurement. */
        onHtmlInjected?: (chapterId: string) => void;
    }) => {
        const { setContextMenuData } = useAppContext();
        const containerRef = useRef<HTMLDivElement>(null);
        const [htmlContent, setHtmlContent] = useState<string | null>(null);
        const linkHandlerRef = useRef(onEpubLinkClick);
        linkHandlerRef.current = onEpubLinkClick;
        const contextMenuRef = useRef(setContextMenuData);
        contextMenuRef.current = setContextMenuData;
        const initialPositionRef = useRef(currentChapter.elementQuery);
        const notes = useAppSelector((state) => {
            const itemLink = state.reader.content?.link;
            if (!itemLink) return [];
            return state.bookNotes.book[itemLink]?.filter((note) => note.chapterId === currentChapter.id) || [];
        }, shallowEqual);

        useLayoutEffect(() => {
            let cancelled = false;
            /** Discards IO that finishes after this chapter leaves the mounted spine window. */
            const loadChapter = async () => {
                const manifestItem = epubManifest.get(currentChapter.id);
                if (!manifestItem) {
                    log.error("EPUB manifest item missing", { chapterId: currentChapter.id });
                    return;
                }
                const chapterMarkup = await readEpubChapter(manifestItem.href);
                if (!cancelled) setHtmlContent(chapterMarkup);
            };
            void loadChapter();
            return () => {
                cancelled = true;
            };
        }, [currentChapter.id, epubManifest]);

        useLayoutEffect(() => {
            const chapterRoot = containerRef.current;
            if (!chapterRoot || htmlContent === null) return;
            const fragment = document.createRange().createContextualFragment(htmlContent);
            chapterRoot.replaceChildren(fragment);
            for (const note of notes) {
                try {
                    highlightUtils.highlight(chapterRoot, {
                        id: note.id.toString(),
                        range: note.range,
                        color: note.color || "yellow",
                        content: note.content || "",
                    });
                } catch (error) {
                    log.error("EPUB note highlight: DOM highlight failed", error);
                }
            }

            const onLinkClick = (event: MouseEvent) => linkHandlerRef.current(event);
            /** Keeps image actions bound to the latest shell context without replacing chapter markup. */
            const onImageContextMenu = (event: Event) => {
                if (!(event instanceof MouseEvent)) return;
                event.stopPropagation();
                const target = event.currentTarget as Element;
                const imageUrl = target.getAttribute("src") || target.getAttribute("data-src") || "";
                contextMenuRef.current({
                    clickX: event.clientX,
                    clickY: event.clientY,
                    items: [
                        window.contextMenu.template.copyImage(imageUrl),
                        window.contextMenu.template.showInExplorer(imageUrl),
                        window.contextMenu.template.copyPath(imageUrl),
                    ],
                });
            };
            const links = chapterRoot.querySelectorAll("a");
            const images = chapterRoot.querySelectorAll<HTMLElement | SVGElement>("img, image");
            for (const link of links) link.addEventListener("click", onLinkClick);
            for (const image of images) {
                image.addEventListener("contextmenu", onImageContextMenu);
                if (image instanceof HTMLImageElement) image.loading = "lazy";
            }
            chapterRoot.dataset.epubReady = "true";
            onHtmlInjected?.(currentChapter.id);
            return () => {
                for (const link of links) link.removeEventListener("click", onLinkClick);
                for (const image of images) image.removeEventListener("contextmenu", onImageContextMenu);
            };
        }, [notes, htmlContent, currentChapter.id, onHtmlInjected]);

        useLayoutEffect(() => {
            if (htmlContent === null) return;
            const position = initialPositionRef.current;
            const fragment = currentChapter.fragment;
            if (!position && !fragment) return;
            // chapter-at-a-time owns its initial scroll; continuous mode supplies neither target here
            const timeoutId = window.setTimeout(() => {
                const chapterRoot = containerRef.current;
                if (!chapterRoot) return;
                const target = position
                    ? queryEpubPosition(chapterRoot, position)
                    : chapterRoot.querySelector(`[data-epub-id="${CSS.escape(fragment)}"]`);
                target?.scrollIntoView({ block: "start" });
            });
            return () => window.clearTimeout(timeoutId);
        }, [htmlContent, currentChapter.fragment]);

        return <div className="cont htmlCont" id={`epub-${currentChapter.id}`} ref={containerRef} />;
    },
    (previous, current) =>
        previous.currentChapter.id === current.currentChapter.id &&
        previous.currentChapter.fragment === current.currentChapter.fragment &&
        previous.epubManifest === current.epubManifest &&
        previous.onHtmlInjected === current.onHtmlInjected &&
        previous.onEpubLinkClick === current.onEpubLinkClick,
);
HTMLPart.displayName = "EPUB Reader HTML Content";

export default HTMLPart;
