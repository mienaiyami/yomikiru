import { useAppSelector } from "@store/hooks";
import EPUB from "@utils/epub";
import { HighlightRange, highlightUtils } from "@utils/highlight";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shallowEqual } from "react-redux";
import { useAppContext } from "src/renderer/App";

type ChapterEvents = {
    link: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement>) => void;
    image: (ev: MouseEvent) => void;
} | null;

const HTMLPart = memo(
    ({
        epubManifest,
        onEpubLinkClick,
        currentChapter,
    }: {
        epubManifest: EPUB.Manifest;
        currentChapter: {
            id: string;
            /** id of element to scroll to, `#` part of url */
            fragment: string;
            /** query string of element to scroll to, take priority over `fragment` */
            elementQuery: string;
        };
        // bookmarkedElem: string;
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    }) => {
        const { setContextMenuData } = useAppContext();
        const eventsRef = useRef<ChapterEvents>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const [htmlContent, setHtmlContent] = useState<string>("");
        const [initialScrolled, setInitialScrolled] = useState(false);
        const notes = useAppSelector((store) => {
            const link = store.reader.content?.link;
            if (!link) return [];
            return store.bookNotes.book[link]?.filter((note) => note.chapterId === currentChapter.id) || [];
        }, shallowEqual);

        const cleanupEvents = () => {
            if (!containerRef.current) return;
            containerRef.current.querySelectorAll("a").forEach((elem) => {
                elem.removeEventListener("click", eventsRef.current?.link as EventListener);
            });
            containerRef.current.querySelectorAll("img, image").forEach((elem) => {
                elem.removeEventListener("contextmenu", eventsRef.current?.image as EventListener);
            });
            eventsRef.current = null;
        };

        useLayoutEffect(() => {
            const setHTML = async () => {
                const manifestItem = epubManifest.get(currentChapter.id);
                if (!manifestItem) {
                    console.error("Error: manifest item not found for id:", currentChapter.id);
                    return "Error: manifest item not found for id: " + currentChapter.id;
                }
                setHtmlContent(await EPUB.readChapter(manifestItem.href));
            };
            setHTML();
        }, [currentChapter.id, epubManifest]);

        useEffect(() => {
            if (currentChapter.elementQuery || currentChapter.fragment) {
                setInitialScrolled(false);
            }
        }, [currentChapter.elementQuery, currentChapter.fragment]);

        useLayoutEffect(() => {
            if (!containerRef.current) return;
            /**
             * ! node must be present in the DOM
             */
            const highlight = (node: HTMLElement) => {
                const highlights = node.querySelectorAll(".text-highlight");
                highlights.forEach((h) => {
                    const parent = h.parentNode;
                    if (parent) {
                        parent.replaceChild(document.createTextNode(h.textContent || ""), h);
                        parent.normalize();
                    }
                });
                notes.forEach((note) => {
                    try {
                        containerRef.current &&
                            highlightUtils.highlight(containerRef.current, {
                                id: note.id.toString(),
                                range: note.range,
                                color: note.color || "yellow",
                                content: note.content || "",
                            });
                    } catch (error) {
                        console.error("Error highlighting note:", error);
                    }
                });
            };
            const injectHTML = () => {
                const node = containerRef.current;
                if (!node) return;
                const fragment = document.createRange().createContextualFragment(htmlContent);
                node.innerHTML = "";
                node.appendChild(fragment);
            };
            const attachEvents = (node: HTMLElement) => {
                const linkEventHandler = (e: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) =>
                    onEpubLinkClick(e);
                const imageEventHandler = (e: Event) => onContextMenu(e as MouseEvent);
                eventsRef.current = {
                    link: linkEventHandler,
                    image: imageEventHandler,
                };
                node.querySelectorAll("a").forEach((link) => {
                    link.addEventListener("click", linkEventHandler);
                });
                node.querySelectorAll("img, image").forEach((img) => {
                    img.addEventListener("contextmenu", imageEventHandler);
                    if (img instanceof HTMLImageElement) {
                        img.loading = "lazy";
                    }
                });
            };
            const scrollToElem = () => {
                if (initialScrolled || !htmlContent) return;
                if (currentChapter.elementQuery) {
                    setTimeout(() => {
                        containerRef.current
                            ?.querySelector(currentChapter.elementQuery)
                            ?.scrollIntoView({ block: "start" });
                        setInitialScrolled(true);
                    });
                } else if (currentChapter.fragment) {
                    setTimeout(() => {
                        containerRef.current
                            ?.querySelector(`[data-epub-id="${currentChapter.fragment}"]`)
                            ?.scrollIntoView({ block: "start" });
                        setInitialScrolled(true);
                    });
                }
            };
            injectHTML();
            highlight(containerRef.current);
            attachEvents(containerRef.current);
            scrollToElem();

            return cleanupEvents;
        }, [notes, htmlContent, currentChapter]);

        const onContextMenu = (ev: MouseEvent) => {
            ev.stopPropagation();
            const target = ev.currentTarget as Element;
            const url = target.getAttribute("src") || target.getAttribute("data-src") || "";
            setContextMenuData({
                clickX: ev.clientX,
                clickY: ev.clientY,
                items: [
                    window.contextMenu.template.copyImage(url),
                    window.contextMenu.template.showInExplorer(url),
                    window.contextMenu.template.copyPath(url),
                ],
            });
        };

        return (
            <div
                className="cont htmlCont"
                key={currentChapter.id + currentChapter.fragment}
                id={`epub-${currentChapter.id}`}
                ref={containerRef}
            ></div>
        );
    },
    (prev, next) => {
        const currentChapterId = prev.currentChapter.id === next.currentChapter.id;
        const currentChapterFragment = prev.currentChapter.fragment === next.currentChapter.fragment;
        const epubManifest = prev.epubManifest.size === next.epubManifest.size;
        return currentChapterId && currentChapterFragment && epubManifest;
    },
);
HTMLPart.displayName = "EPUB Reader HTML Content";

export default HTMLPart;
