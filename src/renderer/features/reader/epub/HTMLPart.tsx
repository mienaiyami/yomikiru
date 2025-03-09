import { memo, useState } from "react";
import { useAppContext } from "src/renderer/App";
import EPUB from "@utils/epub";

const HTMLPart = memo(
    ({
        epubManifest,
        onEpubLinkClick,
        currentChapter,
    }: {
        epubManifest: EPUB.Manifest;
        //todo ignoring for now, to make it easier, always true
        // loadOneChapter: boolean;
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
        const [rendered, setRendered] = useState(false);
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
        // console.log("rendered", currentChapter);
        return (
            <div
                className="cont htmlCont"
                key={currentChapter.id + currentChapter.fragment}
                ref={async (node) => {
                    if (node && !rendered) {
                        // to prevent multiple calls
                        setRendered(true);
                        const manifestItem = epubManifest.get(currentChapter.id);
                        if (!manifestItem) {
                            console.error("Error: manifest item not found for id:", currentChapter.id);
                            return;
                        }
                        const url = manifestItem.href;
                        const htmlStr = await EPUB.readChapter(url);
                        node.id = "epub-" + currentChapter.id;
                        node.innerHTML = htmlStr;
                        node.querySelectorAll("a").forEach((e) => {
                            e.addEventListener("click", onEpubLinkClick);
                        });
                        node.querySelectorAll("img, image").forEach((e) => {
                            (e as HTMLElement).oncontextmenu = onContextMenu;
                        });
                        if (currentChapter.elementQuery) {
                            setTimeout(() => {
                                const el = node.querySelector(currentChapter.elementQuery);
                                if (el) el.scrollIntoView({ block: "start" });
                            });
                        } else if (currentChapter.fragment) {
                            setTimeout(() => {
                                const el = node.querySelector(`[data-epub-id="${currentChapter.fragment}"]`);
                                if (el) el.scrollIntoView({ block: "start" });
                            });
                        }
                    }
                }}
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

export default HTMLPart;
