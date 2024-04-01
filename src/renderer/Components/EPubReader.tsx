import React, {
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    memo,
    useCallback,
    useMemo,
} from "react";
import css, { Rule as CSSRule } from "css";
import { AppContext } from "../App";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setReaderOpen } from "../store/isReaderOpen";
import { newHistory, updateCurrentBookHistory } from "../store/history";
import EPUBReaderSettings from "./EPubReaderSettings";
import EPubReaderSideList from "./EPubReaderSideList";
import { setAppSettings, setEpubReaderSettings, setReaderSettings } from "../store/appSettings";
import { setBookInReader } from "../store/bookInReader";
import { setUnzipping } from "../store/unzipping";
import ReaderSideList from "./ReaderSideList";
import { setMangaInReader } from "../store/mangaInReader";

import EPUB from "../utils/epub";

//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
/*
! for internal links, some may contain #, it will disrupt current chapter like in prev versions
! first check if the href with # is in toc or not, if so 

! not all epub have toc

! it might be better to use a chapter pointer(in main), which will show items from spine, independent of toc,
! and getting items in between 2 toc items for performance,
! chapter will be shown only from spine,
! but to still highlight current chapter in toc, we can move up in spine matching each item in toc to get current chapter

! it might be better to use id instead of url, and send hash to scroll to internal-id if hash in clicked url.
*/

const StyleSheets = memo(
    ({ sheets }: { sheets: string[] }) => {
        return (
            <div
                className="stylesheets"
                ref={(node) => {
                    if (node) {
                        sheets.forEach((url) => {
                            try {
                                const stylesheet = document.createElement("style");
                                let txt = window.fs.readFileSync(url, "utf-8");
                                // console.log(txt, url, epubStylesheets);
                                const matches = Array.from(txt.matchAll(/url\((.*?)\);/gi));
                                matches.forEach((e) => {
                                    // for font
                                    const url_old = e[1].slice(1, -1);
                                    txt = txt.replaceAll(
                                        url_old,
                                        "file://" +
                                            window.path
                                                .join(window.path.dirname(url), url_old)
                                                .replaceAll("\\", "/")
                                    );
                                });
                                // to make sure styles don't apply outside
                                const ast = css.parse(txt);
                                ast.stylesheet?.rules.forEach((e) => {
                                    if (e.type === "rule") {
                                        (e as CSSRule).selectors = (e as CSSRule).selectors?.map((e) =>
                                            e.includes("section.main") ? e : "#EPubReader section.main " + e
                                        );
                                    }
                                });
                                txt = css.stringify(ast);
                                stylesheet.innerHTML = txt;
                                node.appendChild(stylesheet);
                            } catch (e) {
                                window.logger.error("Error occurred while loading stylesheet.", e);
                            }
                        });
                    }
                }}
            ></div>
        );
    },
    (prev, next) => prev.sheets.length === next.sheets.length && prev.sheets[0] === next.sheets[0]
);

// function parseEPubXHTML(filePath: string, parser: DOMParser) {
//     try {
//         const txt = window.fs.readFileSync(decodeURIComponent(filePath), "utf-8");
//         const xhtml = parser.parseFromString(txt, "application/xhtml+xml");
//         xhtml.querySelectorAll("[src]").forEach((e) => {
//             const src_old = e.getAttribute("src") || "";
//             e.setAttribute("src", window.path.join(window.path.dirname(filePath), src_old));
//         });
//         // console.log(xhtml.querySelectorAll("[href]"));
//         xhtml.querySelectorAll("[href]").forEach((e) => {
//             const href_old = e.getAttribute("href");
//             if (href_old)
//                 if (!href_old.startsWith("http")) {
//                     // (e as HTMLLinkElement).href = (e as HTMLLinkElement).href.split("#").splice(-1)[0];
//                     e.setAttribute(
//                         "data-href",
//                         href_old[0] === "#"
//                             ? filePath + href_old
//                             : window.path.join(window.path.dirname(filePath), href_old)
//                     );
//                     e.removeAttribute("href");
//                 }
//         });
//         // for svg image
//         xhtml.querySelectorAll("svg image").forEach((e) => {
//             const href_old = e.getAttribute("xlink:href");
//             if (href_old)
//                 if (!href_old.startsWith("http")) {
//                     // (e as HTMLLinkElement).href = (e as HTMLLinkElement).href.split("#").splice(-1)[0];
//                     e.setAttribute("src", window.path.join(window.path.dirname(filePath), href_old));
//                     e.setAttribute("xlink:href", window.path.join(window.path.dirname(filePath), href_old));
//                     // e.removeAttribute("xlink:href");
//                 }
//         });

//         xhtml.querySelectorAll("[id]").forEach((e) => {
//             e.setAttribute("data-id", e.id);
//             e.removeAttribute("id");
//         });

//         return xhtml;
//     } catch (err) {
//         window.logger.error("EPUBReader::", err);
//         const doc = document.implementation.createHTMLDocument("Error");
//         const p = doc.createElement("p");
//         p.innerHTML =
//             "An error occurred while loading epub file / temporary file have been deleted. Please refresh.";
//         doc.body.appendChild(p);
//         return doc;
//     }
// }

const HTMLSolo = memo(
    ({
        content,
        url,
        epubLinkClick,
    }: {
        content: Document;
        url: string;
        epubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    }) => {
        const { setContextMenuData } = useContext(AppContext);
        // const [rendered, setRendered] = useState(false);;
        return (
            <div
                className="cont htmlCont"
                ref={(node) => {
                    if (node && content) {
                        const xhtml = content;
                        // const url = e.url;
                        // const id = e.id;
                        while (node.hasChildNodes()) {
                            node.removeChild(node.childNodes[0]);
                        }
                        // node.id = "epub-" + id;
                        node.setAttribute("data-link-id", url);
                        xhtml.body.childNodes.forEach((childNode) => {
                            node.appendChild(childNode.cloneNode(true));
                        });
                        node.querySelectorAll("a").forEach((e) => {
                            e.addEventListener("click", epubLinkClick);
                        });
                        node.querySelectorAll("img").forEach((e) => {
                            e.oncontextmenu = (ev) => {
                                ev.stopPropagation();
                                const url = (ev.currentTarget as Element).getAttribute("src") || "";
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
                        });
                    }
                }}
            ></div>
        );
    }
);

// todo : maybe need redo
const HTMLPart = memo(
    ({
        epubManifest,
        // epubSpine,
        // epubToc,
        onEpubLinkClick,
        // currentChapterURL,
        currentChapter,
    }: // loadOneChapter,
    // bookmarkedElem,
    {
        epubManifest: EPUB.Manifest;
        // epubSpine: EPUB.Spine;
        // epubToc: EPUB.TOC;
        //todo ignoring for now, to make it easier, always true
        // loadOneChapter: boolean;
        // currentChapterURL: string;
        currentChapter: {
            id: string;
            /** id of element to scroll to, `#` part of url */
            fragment: string;
        };
        // bookmarkedElem: string;
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    }) => {
        const { setContextMenuData } = useContext(AppContext);
        const [rendered, setRendered] = useState(false);
        // useLayoutEffect(() => {
        //     setRendered(false);
        // }, [currentChapter]);
        const onContextMenu = (ev: MouseEvent) => {
            ev.stopPropagation();
            const url = (ev.currentTarget as Element).getAttribute("src") || "";
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

        console.log("rendered", currentChapter);
        return (
            <div
                className="cont htmlCont"
                ref={async (node) => {
                    if (node && !rendered) {
                        const manifestItem = epubManifest.get(currentChapter.id);
                        if (!manifestItem) {
                            console.error("Error: manifest item not found for id:", currentChapter.id);
                            return;
                        }
                        const url = manifestItem.href;
                        const htmlStr = await EPUB.readChapter(url);
                        // // ! temp, use memo or smoething
                        // while (node.hasChildNodes()) {
                        //     node.removeChild(node.childNodes[0]);
                        // }
                        node.id = "epub-" + currentChapter.id;
                        // node.setAttribute("data-link-id", url);
                        // xhtml.body.childNodes.forEach((childNode) => {
                        //     node.appendChild(childNode.cloneNode(true));
                        // });

                        node.innerHTML = htmlStr;

                        node.querySelectorAll("a").forEach((e) => {
                            e.addEventListener("click", onEpubLinkClick);
                        });
                        node.querySelectorAll("img, image").forEach((e) => {
                            (e as HTMLElement).oncontextmenu = onContextMenu;
                        });
                        //todo for bookmarkedElem
                        // if (!rendered && bookmarkedElem) {
                        //     setTimeout(() => {
                        //         const elem = node.querySelector(bookmarkedElem);
                        //         if (elem) elem.scrollIntoView({ block: "start" });
                        //     }, 200);
                        // } else if (
                        //     tocData &&
                        //     tocData.nav[0].src !== currentChapterURL &&
                        //     currentChapterURL.includes("#") &&
                        //     currentChapterURL.includes(url)
                        // ) {
                        //     setTimeout(() => {
                        //         const el = node.querySelector(
                        //             `[data-id="${currentChapterURL.split("#")[1]}"]`
                        //         );
                        //         if (el) el.scrollIntoView({ block: "start" });
                        //     }, 100);
                        // }
                        if (currentChapter.fragment) {
                            setTimeout(() => {
                                const el = node.querySelector(`[data-epub-id="${currentChapter.fragment}"]`);
                                console.log("test", el);
                                if (el) el.scrollIntoView({ block: "start" });
                            });
                        }
                        setRendered(true);
                    }
                }}
            ></div>
        );
    },
    (prev, next) => {
        //todo important, rerendering on setting change
        const currentChapterId = prev.currentChapter.id === next.currentChapter.id;
        const currentChapterFragment = prev.currentChapter.fragment === next.currentChapter.fragment;
        const epubManifest = prev.epubManifest.size === next.epubManifest.size;
        // console.log(currentChapterId && currentChapterFragment && epubManifest);
        return currentChapterId && currentChapterFragment && epubManifest;
    }
);

const EPubReader = () => {
    const { bookProgressRef, setContextMenuData } = useContext(AppContext);

    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const isReaderOpen = useAppSelector((store) => store.isReaderOpen);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    const bookInReader = useAppSelector((store) => store.bookInReader);
    const isLoadingManga = useAppSelector((store) => store.isLoadingManga);
    const isSettingOpen = useAppSelector((store) => store.isSettingOpen);
    const bookmarks = useAppSelector((store) => store.bookmarks);

    const dispatch = useAppDispatch();

    // const [displayData, setDisplayData] = useState<DisplayData[]>([]);
    // /**
    //  * string of id
    //  */
    // const [displayOrder, setDisplayOrder] = useState<string[]>([]);
    // /**
    //  * url of stylesheets
    //  */
    // const [epubStylesheets, setEpubStylesheets] = useState<string[]>([]);
    // const [tocData, settocData] = useState<TOCData | null>(null);
    const [epubData, setEpubData] = useState<{
        metadata: EPUB.MetaData;
        manifest: EPUB.Manifest;
        spine: EPUB.Spine;
        toc: EPUB.TOC;
        ncx: EPUB.NCXTree[];
        styleSheets: string[];
    } | null>(null);
    /** index of current chapter in EPUB.Spine */
    const [currentChapter, setCurrentChapter] = useState({
        index: 0,
        fragment: "",
    });
    /**
     *  css selector of element which was on top of view before changing size,etc.
     */
    const [elemBeforeChange, setElemBeforeChange] = useState(linkInReader.queryStr || "");
    const [isSideListPinned, setSideListPinned] = useState(false);
    // const [currentChapterURL, setCurrentChapterURL] = useState("~");
    const [sideListWidth, setSideListWidth] = useState(appSettings.readerSettings.sideListWidth || 450);
    const [zenMode, setZenMode] = useState(appSettings.openInZenMode || false);
    const [isBookmarked, setBookmarked] = useState(false);
    const [wasMaximized, setWasMaximized] = useState(false);
    // display this text then shortcuts clicked
    const [shortcutText, setshortcutText] = useState("");
    // [0-100]
    const [bookProgress, setBookProgress] = useState(0);
    // to auto scroll on opening bookmark
    // const [bookmarkedElem, setBookmarkedElem] = useState("");

    const [nonEPUBFile, setNonEPUBFile] = useState<null | Document>(null);

    const readerRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLSelectElement>(null);
    const readerSettingExtender = useRef<HTMLButtonElement>(null);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const fontSizePlusRef = useRef<HTMLButtonElement>(null);
    const fontSizeMinusRef = useRef<HTMLButtonElement>(null);
    // const openPrevChapterRef = useRef<HTMLButtonElement>(null);
    // const openNextChapterRef = useRef<HTMLButtonElement>(null);
    const shortcutTextRef = useRef<HTMLDivElement>(null);
    const addToBookmarkRef = useRef<HTMLButtonElement>(null);

    useLayoutEffect(() => {
        window.app.linkInReader = linkInReader;
        loadEPub(linkInReader.link);
    }, [linkInReader]);

    useLayoutEffect(() => {
        if (appSettings.epubReaderSettings.loadOneChapter && readerRef.current) readerRef.current.scrollTop = 0;
        // const simpleChapterURL = currentChapterURL.split("#")[0];
        // window.app.epubHistorySaveData = {
        //     chapter: "~",
        //     chapterURL: currentChapterURL,
        //     queryString: "",
        // };
        // if (tocData)
        //     window.app.epubHistorySaveData.chapter =
        //         tocData.nav.find((e) => e.src.includes(simpleChapterURL))?.name || "~";
        // if (
        //     window.app.epubHistorySaveData.chapter === "~" ||
        //     window.app.epubHistorySaveData.chapter === linkInReader.chapter
        // )
        //     window.app.epubHistorySaveData.queryString = linkInReader.queryStr || "";
        // if (bookInReader)
        //     dispatch(
        //         setBookInReader({
        //             ...bookInReader,
        //             chapter: window.app.epubHistorySaveData.chapter as string,
        //             chapterURL: currentChapterURL,
        //         })
        //     );
        // dispatch(updateCurrentBookHistory());
    }, [currentChapter]);

    /**previous find in page resulting p */
    const findInPageRefs = useRef<{
        prevResult: HTMLParagraphElement;
        prevStr: string;
    } | null>(null);
    const [findInPageIndex, setFindInPageIndex] = useState(0);

    const scrollReader = (intensity: number) => {
        if (readerRef.current) {
            // let startTime: number
            let prevTime: number;
            const anim = (timeStamp: number) => {
                // if (startTime === undefined) startTime = timeStamp;
                // const elapsed = timeStamp - startTime;
                if (prevTime !== timeStamp && readerRef.current) {
                    // if (isSideListPinned && mainRef.current) {
                    //     mainRef.current.scrollBy(0, intensity);
                    // } else {
                    readerRef.current.scrollBy(0, intensity);
                    // }
                }
                // if (elapsed < window.app.clickDelay) {
                if (window.app.keydown) {
                    prevTime = timeStamp;
                    window.requestAnimationFrame(anim);
                }
            };
            window.requestAnimationFrame(anim);
            return;
        }
    };
    const openNextChapter = () => {
        setCurrentChapter((prev) => {
            if (epubData && prev.index + 1 < epubData.spine.length) {
                return { index: prev.index + 1, fragment: "" };
            }
            return prev;
        });
    };
    const openPrevChapter = () => {
        setCurrentChapter((prev) => {
            if (prev.index - 1 >= 0) return { index: prev.index - 1, fragment: "" };
            return prev;
        });
    };
    /**
     * scroll to internal links or open extrrnal link
     * * `data-href` - scroll to internal
     * * `href     ` - open external
     */
    const onEpubLinkClick = useCallback(
        (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
            ev.preventDefault();
            if (!epubData) return;
            const href = (ev.currentTarget as HTMLAnchorElement).getAttribute("data-href");
            if (href) {
                if (href.startsWith("http")) {
                    window.dialog
                        .warn({
                            message: "Open external link?",
                            detail: href,
                            noOption: false,
                        })
                        .then((res) => {
                            if (res.response === 0) window.electron.shell.openExternal(href);
                        });
                } else {
                    if (appSettings.epubReaderSettings.loadOneChapter) {
                        const fragment = href.split("#")[1] || "";
                        if (href.startsWith("#")) {
                            // setCurrentChapter(prev=>({...prev, fragment}))
                            if (
                                ev.currentTarget instanceof HTMLElement &&
                                ev.currentTarget.getAttribute("epub:type")?.includes("note")
                            ) {
                                // for test use lotm.epub
                                const note =
                                    document.querySelector(`[data-epub-id="${fragment}"]`)?.innerHTML || "";
                                window.dialog.confirm({
                                    message: ev.currentTarget.innerText,
                                    detail: note,
                                    title: "Note",
                                });
                                return;
                            }
                            document
                                .querySelector(`[data-epub-id="${fragment}"]`)
                                ?.scrollIntoView({ block: "start" });
                            return;
                        }
                        const itemIdx = epubData.spine.findIndex((e) => e.href === href.split("#")[0]);
                        if (itemIdx < 0) {
                            window.dialog.customError({
                                message: "Could not find the chapter for corresponding link.",
                            });
                            return;
                        }
                        setCurrentChapter({ index: itemIdx, fragment: fragment });
                    } else {
                        //todo
                    }
                }
            }
        },
        [epubData]
    );

    const loadEPub = (link: string) => {
        if (window.fs.existsSync(window.app.deleteDirOnClose))
            window.fs.rm(
                window.app.deleteDirOnClose,
                {
                    recursive: true,
                },
                (err) => {
                    if (err) window.logger.error(err);
                }
            );

        link = window.path.normalize(link);
        setBookmarked(bookmarks.map((e) => e.data.link).includes(link));
        if ([".xhtml", ".html", ".txt"].includes(window.path.extname(link).toLowerCase())) {
            // const ext = window.path.extname(link).toLowerCase();
            // try {
            //     let doc = null as null | Document;
            //     const parser = new DOMParser();
            //     if (ext === ".xhtml" || ext === "html") {
            //         doc = parseEPubXHTML(link, parser);
            //     } else if (ext === ".txt") {
            //         const raw = window.fs.readFileSync(link, "utf-8");
            //         if (!raw) throw Error();
            //         const paras = raw.split("\r\n");
            //         const html = `
            //         <!DOCTYPE html>
            //         <html>
            //         <head>
            //         <title></title>
            //         </head>
            //         <body>
            //         ${paras.map((e) => `<p>${e}</p>`).join("")}
            //         </body>
            //         </html>
            //         `;
            //         doc = parser.parseFromString(html, "text/html");
            //     }
            //     if (doc) {
            //         setNonEPUBFile(doc);
            //         const mangaOpened = {
            //             chapterName: linkSplitted.at(-1) || "~",
            //             link,
            //             pages: 0,
            //             mangaName: linkSplitted.at(-2) || "~",
            //         };
            //         if (readerRef.current) readerRef.current.scrollTop = 0;
            //         dispatch(
            //             newHistory({
            //                 type: "image",
            //                 data: {
            //                     mangaOpened,
            //                     page: 0,
            //                     recordChapter: appSettings.recordChapterRead,
            //                 },
            //             })
            //         );

            //         dispatch(setMangaInReader(mangaOpened));
            //         dispatch(setReaderOpen(true));
            //     }
            // } catch (reason) {
            //     console.error(reason);
            //     window.dialog.customError({
            //         message: "Error while reading file.",
            //     });
            // }
            window.dialog.customError({
                message: "This mode is not supported yet, will be implemented in future.",
            });
            dispatch(setUnzipping(false));
            return;
        }
        EPUB.readEpubFile(link, appSettings.keepExtractedFiles)
            .then((ed) => {
                // console.warn(
                //     "TODO : When current chapter is not top level(level=0), make BookItem.chapter concat of all parent chapters."
                // );
                // todo handle later
                // let currentChapterURL = "";
                // if(linkInReader.chapter) currentChapterURL = ed.toc.find(e=>e.title === linkInReader.chapter)?.href||"";
                // if(!currentChapterURL) currentChapterURL = ed.toc[0].href;
                const bookOpened: BookItem = {
                    author: ed.metadata.author,
                    //todo modify BookItem
                    // cover: ed.metadata.cover,
                    link,
                    title: ed.metadata.title,
                    //todo: change to ISO date and modify other places
                    date: new Date().toLocaleString("en-UK", { hour12: true }),
                    // todo, replace with id
                    chapterURL: "",
                };
                dispatch(setBookInReader(bookOpened));
                // dispatch(
                //     newHistory({
                //         type: "book",
                //         data: {
                //             bookOpened,
                //             elementQueryString: elemBeforeChange || "",
                //         },
                //     })
                // );
                setEpubData(ed);
                // if (ed.toc.length > 200 && !appSettings.epubReaderSettings.loadOneChapter)
                //     window.dialog.warn({
                //         message: "Too many chapters in book.",
                //         detail: "It might cause instability and high RAM usage. It is recommended to enable option to load and show only chapter at a time from Settings → Other Settings.",
                //         noOption: false,
                //     });
                dispatch(setUnzipping(false));
                dispatch(setReaderOpen(true));
            })
            .catch(() => {
                dispatch(setUnzipping(false));
            });
    };

    const makeScrollPos = useCallback(
        (callback?: (queryString?: string) => void) => {
            // todo, isn't a great way maybe, sometimes doesn't work, catches wrong element
            // but using % is not good either because height change is not constant if it contains images
            if (mainRef.current) {
                let y = (zenMode ? 0 : window.app.titleBarHeight) + 10;
                let x = mainRef.current.offsetLeft + mainRef.current.offsetWidth / 3;
                let elem: Element | null = null;
                const sectionMain = document.querySelector("#EPubReader > section");
                while (x < mainRef.current.offsetLeft + mainRef.current.offsetWidth / 1.3) {
                    if (y > window.innerHeight / 2) {
                        y = 50;
                        x += 20;
                    }
                    elem = document.elementFromPoint(x, y);
                    if (elem) if (elem.tagName !== "SECTION" && elem.parentElement !== sectionMain) break;
                    y += 10;
                }
                if (elem) {
                    const fff = window.getCSSPath(elem);
                    //todo
                    // window.app.epubHistorySaveData = {
                    //     chapter: "~",
                    //     queryString: fff,
                    //     chapterURL: currentChapterURL,
                    // };
                    // if (tocData)
                    //     window.app.epubHistorySaveData.chapter =
                    //         tocData.nav.find((e) => e.src.includes(currentChapterURL))?.name || "~";
                    if (callback) callback(fff);
                    setElemBeforeChange(fff);
                }
            }
        },
        [mainRef.current, zenMode]
    );

    // todo: find in innerHTML and replace with span.highlight
    const findInPage = useCallback(
        (str: string, forward = true) => {
            if (str === "") {
                if (findInPageRefs.current) {
                    findInPageRefs.current.prevResult?.classList.remove("findInPage");
                }
                findInPageRefs.current = null;
                setFindInPageIndex(0);
                return;
            }
            str = str.toLowerCase();
            let index = findInPageIndex + (forward ? 0 : -2);
            if (findInPageRefs.current && findInPageRefs.current.prevStr !== str) index = 0;
            if (mainRef.current) {
                const paras = [...mainRef.current.querySelectorAll("p")].filter((e) =>
                    e.textContent?.toLowerCase().includes(str)
                );
                if (index < 0) index = paras.length - 1;
                if (index >= paras.length) index = 0;
                const para = paras[index];
                if (para) {
                    findInPageRefs.current?.prevResult?.classList.remove("findInPage");
                    para.classList.add("findInPage");
                    para.scrollIntoView({
                        behavior: "auto",
                        block: "start",
                    });
                    findInPageRefs.current = {
                        prevResult: para,
                        prevStr: str,
                    };
                    // index+=forward ? 1 : 0;
                    // if (index === paras.length - 1) setFindInPageIndex(0);
                    // else
                    setFindInPageIndex(index + 1);
                }
            }
        },
        [findInPageRefs.current, mainRef.current, findInPageIndex]
    );

    const updateProgress = () => {
        let progress = 0;
        if (readerRef.current)
            progress = Math.round(
                (readerRef.current.scrollTop / (readerRef.current.scrollHeight - readerRef.current.offsetHeight)) *
                    100
            );
        if (bookProgressRef.current) bookProgressRef.current.value = progress.toString();
        setBookProgress(progress || 0);
        makeScrollPos();
    };
    //todo remove behavior
    const scrollToPage = (percent: number, behavior: ScrollBehavior = "smooth", callback?: () => void) => {
        const reader = document.querySelector("#EPubReader") as HTMLDivElement;
        if (reader) {
            reader.scrollTo(0, (percent / 100) * (reader.scrollHeight - reader.offsetHeight));
            if (callback) callback();
        }
    };
    window.app.scrollToPage = scrollToPage;
    useEffect(() => {
        if ((zenMode && !window.electron.getCurrentWindow().isMaximized()) || (!zenMode && !wasMaximized)) {
            setTimeout(() => {
                if (elemBeforeChange)
                    document.querySelector(elemBeforeChange)?.scrollIntoView({
                        behavior: "auto",
                        block: "start",
                    });
            }, 100);
        }
        if (zenMode) {
            setSideListPinned(false);
            setWasMaximized(window.electron.getCurrentWindow().isMaximized());
            document.body.classList.add("zenMode");
            window.electron.getCurrentWindow().setFullScreen(true);
        } else {
            document.body.classList.remove("zenMode");
            setWasMaximized(false);
            if (window.electron.getCurrentWindow().isFullScreen())
                window.electron.getCurrentWindow().setFullScreen(false);
        }
    }, [zenMode]);

    useLayoutEffect(() => {
        if (isSideListPinned) {
            // readerRef.current?.scrollTo(0, scrollPosPercent * readerRef.current.scrollHeight);
            if (elemBeforeChange)
                document.querySelector(elemBeforeChange)?.scrollIntoView({
                    behavior: "auto",
                    block: "start",
                });
        }
        const timeOutId = setTimeout(() => {
            if (sideListWidth !== appSettings?.readerSettings?.sideListWidth)
                dispatch(setReaderSettings({ sideListWidth }));
        }, 500);
        return () => {
            clearTimeout(timeOutId);
        };
    }, [sideListWidth]);

    useLayoutEffect(() => {
        window.app.clickDelay = 100;
        const wheelFunction = (e: WheelEvent) => {
            if (e.ctrlKey) {
                if (e.deltaY < 0) {
                    sizePlusRef.current?.click();
                    return;
                }
                if (e.deltaY > 0) {
                    sizeMinusRef.current?.click();
                    return;
                }
            }
        };

        const shortcutsMapped = Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<
            ShortcutCommands,
            string[]
        >;
        const registerShortcuts = (e: KeyboardEvent) => {
            // /&& document.activeElement!.tagName === "BODY"
            window.app.keyRepeated = e.repeat;
            const keyStr = window.keyFormatter(e);
            if (keyStr === "" && e.key !== "Escape") return;

            const is = (keys: string[]) => {
                return keys.includes(keyStr);
            };
            if (is(shortcutsMapped["contextMenu"])) {
                e.stopPropagation();
                e.preventDefault();
                if (mainRef.current)
                    mainRef.current.dispatchEvent(
                        window.contextMenu.fakeEvent(
                            { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                            readerRef.current
                        )
                    );
                return;
            }
            const topBottomLogic =
                readerRef.current &&
                !e.repeat &&
                (Math.ceil(
                    readerRef.current.scrollTop +
                        window.innerHeight +
                        (1 + Math.abs(1 - window.electron.webFrame.getZoomFactor()))
                ) >= readerRef.current.scrollHeight ||
                    readerRef.current.scrollTop < window.innerHeight / 4);
            if (!isSettingOpen && window.app.isReaderOpen && !isLoadingManga) {
                if ([" ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                if (!e.repeat) {
                    switch (true) {
                        case is(shortcutsMapped["readerSettings"]):
                            readerSettingExtender.current?.click();
                            readerSettingExtender.current?.focus();
                            break;
                        case is(shortcutsMapped["toggleZenMode"]):
                            // makeScrollPos();
                            setZenMode((prev) => !prev);
                            break;
                        case e.key === "Escape":
                            // makeScrollPos();
                            setZenMode(false);
                            break;

                        case is(shortcutsMapped["nextPage"]):
                            if (topBottomLogic) openNextChapter();
                            break;
                        case is(shortcutsMapped["prevPage"]):
                            if (topBottomLogic) openPrevChapter();
                            break;
                        case is(shortcutsMapped["nextChapter"]):
                            if (!e.repeat) openNextChapter();
                            break;
                        case is(shortcutsMapped["prevChapter"]):
                            if (!e.repeat) openPrevChapter();
                            break;
                        case is(shortcutsMapped["bookmark"]):
                            if (!e.repeat) addToBookmarkRef.current?.click();
                            break;
                        case is(shortcutsMapped["sizePlus"]):
                            sizePlusRef.current?.click();
                            break;
                        case is(shortcutsMapped["sizeMinus"]):
                            sizeMinusRef.current?.click();
                            break;
                        case is(shortcutsMapped["fontSizePlus"]):
                            fontSizePlusRef.current?.click();
                            break;
                        case is(shortcutsMapped["fontSizeMinus"]):
                            fontSizeMinusRef.current?.click();
                            break;
                        default:
                            break;
                    }
                    if (
                        document.activeElement!.tagName === "BODY" ||
                        document.activeElement === readerRef.current
                    ) {
                        window.app.keydown = true;

                        switch (true) {
                            case is(shortcutsMapped["largeScrollReverse"]):
                                e.preventDefault();
                                scrollReader(0 - appSettings.epubReaderSettings.scrollSpeedB);
                                break;
                            case is(shortcutsMapped["largeScroll"]):
                                e.preventDefault();
                                scrollReader(appSettings.epubReaderSettings.scrollSpeedB);
                                break;
                            case is(shortcutsMapped["scrollDown"]):
                                scrollReader(appSettings.epubReaderSettings.scrollSpeedA);
                                break;
                            case is(shortcutsMapped["scrollUp"]):
                                scrollReader(0 - appSettings.epubReaderSettings.scrollSpeedA);
                                break;
                            case is(shortcutsMapped["showHidePageNumberInZen"]):
                                setshortcutText(
                                    (!appSettings.epubReaderSettings.showProgressInZenMode ? "Show" : "Hide") +
                                        " progress in Zen Mode"
                                );
                                dispatch(
                                    setEpubReaderSettings({
                                        showProgressInZenMode:
                                            !appSettings.epubReaderSettings.showProgressInZenMode,
                                    })
                                );
                                break;
                        }
                    }
                }
            }
        };

        const aaa = () => {
            window.app.keydown = false;
        };
        window.addEventListener("wheel", wheelFunction);
        window.addEventListener("keydown", registerShortcuts);
        window.addEventListener("keyup", aaa);
        return () => {
            window.removeEventListener("wheel", wheelFunction);
            window.removeEventListener("keydown", registerShortcuts);
            window.removeEventListener("keyup", aaa);
        };
    }, [isSideListPinned, appSettings, isLoadingManga, shortcuts, isSettingOpen, epubData]);

    useLayoutEffect(() => {
        console.log(elemBeforeChange);
        if (elemBeforeChange)
            document.querySelector(elemBeforeChange)?.scrollIntoView({
                behavior: "auto",
                block: "start",
            });
    }, [
        appSettings.epubReaderSettings.readerWidth,
        isSideListPinned,
        appSettings.epubReaderSettings.fontSize,
        appSettings.epubReaderSettings.lineSpacing,
        appSettings.epubReaderSettings.paragraphSpacing,
        //! these were not needed caused bad auto scroll
        // appSettings.epubReaderSettings.fontFamily,
        // appSettings.epubReaderSettings.wordSpacing,
        // appSettings.epubReaderSettings.useDefault_fontFamily,
        appSettings.epubReaderSettings.useDefault_lineSpacing,
        appSettings.epubReaderSettings.useDefault_paragraphSpacing,
        // appSettings.epubReaderSettings.useDefault_wordSpacing,
    ]);

    useEffect(() => {
        let timeOutId: NodeJS.Timeout;
        const e = shortcutTextRef.current;
        if (shortcutText !== "") {
            if (e) {
                e.innerText = shortcutText;
                e.classList.remove("faded");
                timeOutId = setTimeout(() => {
                    e.classList.add("faded");
                }, 500);
            }
        }
        return () => {
            clearTimeout(timeOutId);
            e?.classList.add("faded");
        };
    }, [shortcutText]);

    return (
        <div
            ref={readerRef}
            id="EPubReader"
            className={
                (isSideListPinned ? "sideListPinned " : "") +
                "reader " +
                (zenMode && appSettings.hideCursorInZenMode ? "noCursor " : "") +
                (nonEPUBFile ? "fake " : "")
            }
            style={{
                gridTemplateColumns: sideListWidth + "px auto",
                display: isReaderOpen ? (isSideListPinned ? "grid" : "block") : "none",
                "--sideListWidth": sideListWidth + "px",
            }}
            onScroll={updateProgress}
            tabIndex={-1}
        >
            <EPUBReaderSettings
                readerRef={readerRef}
                makeScrollPos={makeScrollPos}
                readerSettingExtender={readerSettingExtender}
                sizePlusRef={sizePlusRef}
                sizeMinusRef={sizeMinusRef}
                setshortcutText={setshortcutText}
                fontSizePlusRef={fontSizePlusRef}
                fontSizeMinusRef={fontSizeMinusRef}
            />
            {
                epubData && (
                    <EPubReaderSideList
                        onEpubLinkClick={onEpubLinkClick}
                        // openNextChapterRef={openNextChapterRef}
                        // openPrevChapterRef={openPrevChapterRef}
                        epubNCX={epubData.ncx}
                        epubTOC={epubData.toc}
                        epubMetadata={epubData.metadata}
                        openNextChapter={openNextChapter}
                        openPrevChapter={openPrevChapter}
                        currentChapter={epubData.spine[currentChapter.index]}
                        // currentChapterURL={currentChapterURL}

                        // setCurrentChapterURL={setCurrentChapterURL}
                        addToBookmarkRef={addToBookmarkRef}
                        setshortcutText={setshortcutText}
                        isBookmarked={isBookmarked}
                        setBookmarked={setBookmarked}
                        isSideListPinned={isSideListPinned}
                        setSideListPinned={setSideListPinned}
                        setSideListWidth={setSideListWidth}
                        makeScrollPos={makeScrollPos}
                        findInPage={findInPage}
                        zenMode={zenMode}
                    />
                )
                // {nonEPUBFile && (
                //     <ReaderSideList
                //         addToBookmarkRef={addToBookmarkRef}
                //         isBookmarked={isBookmarked}
                //         setBookmarked={setBookmarked}
                //         isSideListPinned={isSideListPinned}
                //         setSideListPinned={setSideListPinned}
                //         setSideListWidth={setSideListWidth}
                //         makeScrollPos={makeScrollPos}
                //         openNextChapterRef={openNextChapterRef}
                //         openPrevChapterRef={openPrevChapterRef}
                //         setshortcutText={setshortcutText}
                //     />
                // )}
            }
            {appSettings.epubReaderSettings.showProgressInZenMode && (
                <div
                    className={"zenModePageNumber " + " show"}
                    style={{
                        backgroundColor: appSettings.epubReaderSettings.useDefault_progressBackgroundColor
                            ? "var(--body-bg-color)"
                            : appSettings.epubReaderSettings.progressBackgroundColor,
                        color: appSettings.epubReaderSettings.useDefault_fontColor
                            ? "currentColor"
                            : appSettings.epubReaderSettings.fontColor,
                    }}
                >
                    {bookProgress}%
                </div>
            )}
            <div className="shortcutClicked faded" ref={shortcutTextRef}>
                {shortcutText}
            </div>
            {appSettings.epubReaderSettings.forceLowBrightness.enabled && (
                <div
                    className="forcedLowBrightness"
                    style={{ "--neg-brightness": appSettings.epubReaderSettings.forceLowBrightness.value }}
                ></div>
            )}
            <section
                className={
                    "main " +
                    (appSettings.epubReaderSettings.useDefault_fontFamily ? "" : "forceFont ") +
                    (appSettings.epubReaderSettings.useDefault_fontWeight ? "" : "forceFontWeight ") +
                    (appSettings.epubReaderSettings.useDefault_paragraphSpacing ? "" : "forceParaGap ") +
                    (appSettings.epubReaderSettings.hyphenation ? "hyphen " : "") +
                    (appSettings.epubReaderSettings.limitImgHeight ? "limitImgHeight " : "") +
                    (appSettings.epubReaderSettings.noIndent ? "noIndent " : "") +
                    (appSettings.epubReaderSettings.invertImageColor ? "blendImage " : "") +
                    (appSettings.epubReaderSettings.textSelect ? "textSelect " : "")
                }
                ref={mainRef}
                style={{
                    fontSize: appSettings.epubReaderSettings.fontSize + "px",
                    "--font-family": appSettings.epubReaderSettings.useDefault_fontFamily
                        ? "inherit"
                        : appSettings.epubReaderSettings.fontFamily,
                    "--font-weight": appSettings.epubReaderSettings.useDefault_fontWeight
                        ? "inherit"
                        : appSettings.epubReaderSettings.fontWeight,
                    "--line-height": appSettings.epubReaderSettings.useDefault_lineSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.lineSpacing + "em",
                    "--word-spacing": appSettings.epubReaderSettings.useDefault_wordSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.wordSpacing + "em",
                    "--letter-spacing": appSettings.epubReaderSettings.useDefault_letterSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.letterSpacing + "em",
                    "--paragraph-gap": appSettings.epubReaderSettings.useDefault_paragraphSpacing
                        ? "auto"
                        : appSettings.epubReaderSettings.paragraphSpacing / 2 + "em 0",
                    "--width": appSettings.epubReaderSettings.readerWidth + "%",
                    "--epub-font-color": appSettings.epubReaderSettings.useDefault_fontColor
                        ? "none"
                        : appSettings.epubReaderSettings.fontColor,
                    "--epub-link-color": appSettings.epubReaderSettings.useDefault_linkColor
                        ? "none"
                        : appSettings.epubReaderSettings.linkColor,
                    "--epub-background-color": appSettings.epubReaderSettings.useDefault_backgroundColor
                        ? "var(--body-bg-color)"
                        : appSettings.epubReaderSettings.backgroundColor,
                }}
                onContextMenu={(e) => {
                    e.stopPropagation();
                    const items: MenuListItem[] = [
                        {
                            label: "Zen Mode",
                            selected: zenMode,
                            action() {
                                setZenMode((init) => !init);
                            },
                        },
                        {
                            label: "Hide Cursor in Zen Mode",
                            selected: appSettings.hideCursorInZenMode,
                            action() {
                                dispatch(
                                    setAppSettings({
                                        hideCursorInZenMode: !appSettings.hideCursorInZenMode,
                                    })
                                );
                            },
                        },
                        {
                            label: "Double Click Zen Mode",
                            selected: !appSettings.epubReaderSettings.textSelect,
                            action() {
                                dispatch(
                                    setEpubReaderSettings({
                                        textSelect: !appSettings.epubReaderSettings.textSelect,
                                    })
                                );
                            },
                        },
                        window.contextMenu.template.divider(),
                        {
                            label: "Bookmark",
                            action() {
                                addToBookmarkRef.current?.click();
                            },
                        },
                        window.contextMenu.template.divider(),
                        window.contextMenu.template.openInNewWindow(linkInReader.link),
                        window.contextMenu.template.showInExplorer(linkInReader.link),
                        window.contextMenu.template.copyPath(linkInReader.link),
                    ];
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        items,
                        padLeft: true,
                    });
                }}
                onClick={(e) => {
                    if (readerRef.current && appSettings.epubReaderSettings.loadOneChapter) {
                        if (
                            Math.ceil(
                                readerRef.current.scrollTop +
                                    window.innerHeight +
                                    (1 + Math.abs(1 - window.electron.webFrame.getZoomFactor()))
                            ) >= readerRef.current.scrollHeight ||
                            readerRef.current.scrollTop < window.innerHeight / 4
                        ) {
                            let clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                            if (isSideListPinned) {
                                clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                            }
                            if (clickPos <= 5) openPrevChapter();
                            if (clickPos > 95) openNextChapter();
                        }
                    }
                }}
                onDoubleClick={(e) => {
                    if (!appSettings.epubReaderSettings.textSelect) {
                        let clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                        if (isSideListPinned) {
                            clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                        }
                        if (clickPos > 5 && clickPos < 95) setZenMode((init) => !init);
                    }
                }}
            >
                <StyleSheets sheets={epubData?.styleSheets || []} />
                {nonEPUBFile ? (
                    <HTMLSolo content={nonEPUBFile} epubLinkClick={onEpubLinkClick} url={linkInReader.link} />
                ) : (
                    epubData && (
                        <HTMLPart
                            // loadOneChapter={appSettings.epubReaderSettings.loadOneChapter}
                            key={"epub" + currentChapter.index}
                            onEpubLinkClick={onEpubLinkClick}
                            currentChapter={{
                                id: epubData.spine[currentChapter.index].id,
                                //todo
                                fragment: currentChapter.fragment,
                            }}
                            epubManifest={epubData.manifest}
                            // bookmarkedElem={bookmarkedElem}
                        />
                    )
                )}
            </section>
        </div>
    );
};

export default EPubReader;
