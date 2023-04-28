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
// import { setLoadingMangaPercent } from "../store/loadingMangaPercent";
// import { setLoadingManga } from "../store/isLoadingManga";
import { setLinkInReader } from "../store/linkInReader";
import { newHistory } from "../store/history";
import contextMenu, { setContextMenu } from "../store/contextMenu";
import EPUBReaderSettings from "./EPubReaderSettings";
import EPubReaderSideList from "./EPubReaderSideList";
import { setReaderSettings } from "../store/appSettings";
import { setBookInReader } from "../store/bookInReader";
import { setUnzipping } from "../store/unzipping";

// type ReaderImageSrc = string;
// type ReaderHTML = Document;

// interface DisplayData {
//     type: "image" | "html";
//     /**
//      * id from content.opf
//      */
//     id: string;
//     url: string;
//     content: ReaderHTML | ReaderImageSrc;
// }
interface DisplayData {
    /**
     * id from content.opf
     */
    id: string;
    url: string;
    content?: Document;
}
// const ImagePart = ({ src }: { src: ReaderImageSrc }) => {
//     return (
//         <div className="cont imgCont">
//             <img src={src} alt="Image" />
//         </div>
//     );
// };

const StyleSheets = memo(
    ({ sheets }: { sheets: string[] }) => {
        return (
            <div
                className="stylesheets"
                ref={(node) => {
                    if (node) {
                        sheets.forEach((url) => {
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
                                        window.path.join(window.path.dirname(url), url_old).replaceAll("\\", "/")
                                );
                            });
                            // to make sure styles dont apply outside
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
                        });
                    }
                }}
            ></div>
        );
    },
    (prev, next) => prev.sheets.length === next.sheets.length && prev.sheets[0] === next.sheets[0]
);

function parseEPubHTMLX(filePath: string, parser: DOMParser) {
    const txt = window.fs.readFileSync(decodeURIComponent(filePath), "utf-8");
    const xhtml = parser.parseFromString(txt, "application/xhtml+xml");
    xhtml.querySelectorAll("[src]").forEach((e) => {
        const src_old = e.getAttribute("src") || "";
        e.setAttribute("src", window.path.join(window.path.dirname(filePath), src_old));
    });
    // console.log(xhtml.querySelectorAll("[href]"));
    xhtml.querySelectorAll("[href]").forEach((e) => {
        const href_old = e.getAttribute("href");
        if (href_old)
            if (!href_old.startsWith("http")) {
                // (e as HTMLLinkElement).href = (e as HTMLLinkElement).href.split("#").splice(-1)[0];
                e.setAttribute("data-href", window.path.join(window.path.dirname(filePath), href_old));
                e.removeAttribute("href");
            }
    });

    xhtml.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    return xhtml;
}

const HTMLPart = memo(
    ({
        displayOrder,
        displayData,
        epubLinkClick,
        currentChapterURL,
        loadOneChapter,
        tocData,
    }: {
        displayOrder: string[];
        displayData: DisplayData[];
        loadOneChapter: boolean;
        currentChapterURL: string;
        tocData: TOCData | null;
        epubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    }) => {
        const dispatch = useAppDispatch();
        const onContextMenu = (ev: MouseEvent) => {
            dispatch(
                setContextMenu({
                    clickX: ev.clientX,
                    clickY: ev.clientY,
                    hasLink: {
                        link: (ev.currentTarget as Element).getAttribute("src") || "",
                        simple: {
                            isImage: true,
                        },
                    },
                })
            );
        };
        const linksInBetween: DisplayData[] = [];
        const displayDataWithOrder = useMemo(
            () => displayOrder.map((e) => displayData.find((a) => a.id === e)!),
            [displayData, displayOrder]
        );
        if (loadOneChapter && tocData) {
            /**in TOC */
            let afterCurrentIndex = tocData.nav.findIndex((e) => e.src === currentChapterURL) + 1;
            /**in displayData */
            const startIndex =
                afterCurrentIndex === 1 ? 0 : displayDataWithOrder.findIndex((e) => e.url === currentChapterURL);
            // need to be below
            if (tocData.nav[afterCurrentIndex]?.src === currentChapterURL) afterCurrentIndex++;
            /**till next item from TOC */
            let lastIndex = displayDataWithOrder.findIndex((e) => e.url === tocData.nav[afterCurrentIndex]?.src);
            if (lastIndex < 0) lastIndex = Number.MAX_SAFE_INTEGER;
            linksInBetween.push(...displayDataWithOrder.slice(startIndex, lastIndex));
            // console.log(linksInBetween, tocData);
        }
        if (!tocData) return <p>Error/Loading</p>;
        return (
            <>
                {(loadOneChapter ? linksInBetween : displayDataWithOrder).map((e, i) => (
                    <div
                        className="cont htmlCont"
                        ref={(node) => {
                            if (node && (loadOneChapter ? linksInBetween : displayDataWithOrder).length > 0) {
                                let xhtml = e.content;
                                const url = e.url;
                                const id = e.id;
                                if (!xhtml) {
                                    const parser = new DOMParser();
                                    xhtml = parseEPubHTMLX(url, parser);
                                }
                                // // ! temp, use memo or smoething
                                while (node.hasChildNodes()) {
                                    node.removeChild(node.childNodes[0]);
                                }
                                node.id = "epub-" + id;
                                node.setAttribute("data-link-id", url);
                                xhtml.body.childNodes.forEach((childNode) => {
                                    node.appendChild(childNode.cloneNode(true));
                                });
                                node.querySelectorAll("a").forEach((e) => {
                                    e.addEventListener("click", epubLinkClick);
                                });
                                node.querySelectorAll("img").forEach((e) => {
                                    e.oncontextmenu = onContextMenu;
                                });
                            }
                        }}
                        key={"key-" + i}
                    ></div>
                ))}
            </>
        );
    },
    (prev, next) => {
        const currentChapterURL = !prev.loadOneChapter || prev.currentChapterURL === next.currentChapterURL;
        const displayData = prev.displayData.length === next.displayData.length;
        const displayOrder = prev.displayOrder.length === next.displayOrder.length;
        // null == null
        const tocData = prev.tocData === next.tocData;
        let sameDisplayData = false;
        if (displayData && prev.displayData.length > 0)
            sameDisplayData = prev.displayData[0].url === next.displayData[0].url;
        return displayData && displayOrder && sameDisplayData && currentChapterURL && tocData;
    }
);

// const PartCont = memo(({ data }: { data: DisplayData | string }) => {
//     console.log("rendereddddd");
//     if (typeof data === "string") return <p className="error">{data}</p>;
//     return data.type === "html" ? (
//         <HTMLPart xhtml={data.content as ReaderHTML} url={data.url} />
//     ) : (
//         <ImagePart src={data.content as ReaderImageSrc} />
//     );
// });

const EPubReader = () => {
    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const isReaderOpen = useAppSelector((store) => store.isReaderOpen);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    // const bookInReader = useAppSelector((store) => store.bookInReader);
    const isLoadingManga = useAppSelector((store) => store.isLoadingManga);
    // const bookmarks = useAppSelector((store) => store.bookmarks);
    // const pageNumChangeDisabled = useAppSelector((store) => store.pageNumChangeDisabled);
    // const prevNextChapter = useAppSelector((store) => store.prevNextChapter);

    const dispatch = useAppDispatch();

    const [displayData, setDisplayData] = useState<DisplayData[]>([]);
    /**
     * string of id
     */
    const [displayOrder, setDisplayOrder] = useState<string[]>([]);
    /**
     * url of stylesheets
     */
    const [epubStylesheets, setEpubStylesheets] = useState<string[]>([]);
    /**
     *  css selector of element which was on top of view before changing size,etc.
     */
    const [elemBeforeChange, setElemBeforeChange] = useState("");
    const [isSideListPinned, setSideListPinned] = useState(false);
    const [tocData, settocData] = useState<TOCData | null>(null);
    const [currentChapterURL, setCurrentChapterURL] = useState("~");
    const [sideListWidth, setSideListWidth] = useState(appSettings.readerSettings.sideListWidth || 450);
    const [zenMode, setZenMode] = useState(false);
    const [wasMaximized, setWasMaximized] = useState(false);

    const readerRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLSelectElement>(null);
    const readerSettingExtender = useRef<HTMLButtonElement>(null);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const openPrevChapterRef = useRef<HTMLButtonElement>(null);
    const openNextChapterRef = useRef<HTMLButtonElement>(null);

    useLayoutEffect(() => {
        if (appSettings.epubReaderSettings.loadOneChapter && readerRef.current) readerRef.current.scrollTop = 0;
    }, [currentChapterURL]);

    /**previous find in page resulting p */
    const findInPageRefs = useRef<{
        prevResult: HTMLParagraphElement;
        prevStr: string;
    } | null>(null);
    const [findInPageIndex, setFindInPageIndex] = useState(0);

    const scrollReader = (intensity: number) => {
        if (readerRef.current) {
            let startTime: number, prevTime: number;
            const anim = (timeStamp: number) => {
                if (startTime === undefined) startTime = timeStamp;
                const elapsed = timeStamp - startTime;
                if (prevTime !== timeStamp && readerRef.current) {
                    if (isSideListPinned && mainRef.current) {
                        mainRef.current.scrollBy(0, intensity);
                    } else {
                        readerRef.current.scrollBy(0, intensity);
                    }
                }
                if (elapsed < window.app.clickDelay) {
                    prevTime = timeStamp;
                    window.requestAnimationFrame(anim);
                }
            };
            window.requestAnimationFrame(anim);
            return;
        }
    };
    /**
     * scroll to internal links or open extrrnal link
     * * data-href - scroll to internal
     * * href      - open external
     */
    const epubLinkClick = useCallback(
        (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
            ev.preventDefault();
            const data_href = (ev.currentTarget as Element).getAttribute("data-href");
            if (data_href) {
                if (appSettings.epubReaderSettings.loadOneChapter) {
                    const linkExist = displayData.find((a) => a.url === data_href);
                    if (linkExist) setCurrentChapterURL(data_href);
                } else {
                    const idFromURL = displayData.find((a) => a.url === data_href)?.id;
                    if (idFromURL) document.getElementById("epub-" + idFromURL)?.scrollIntoView();
                }
            } else {
                if ((ev.currentTarget as HTMLAnchorElement).href) {
                    window.electron.shell.openExternal((ev.currentTarget as HTMLAnchorElement).href);
                }
            }
        },
        [displayData]
    );

    const loadEPub = (link: string) => {
        link = window.path.normalize(link);
        const linkSplitted = link.split(window.path.sep).filter((e) => e !== "");
        const extractPath = window.path.join(
            window.electron.app.getPath("temp"),
            `yomikiru-temp-EPub-${linkSplitted[linkSplitted.length - 1]}-${window.crypto.randomUUID()}`
        );
        console.log("extracting ", link, " at ", extractPath);
        window.crossZip.unzip(link, extractPath, (err) => {
            // dispatch(setLoadingMangaPercent(50));
            if (err) {
                dispatch(setUnzipping(false));
                // dispatch(setLoadingManga(false));
                // dispatch(setLoadingMangaPercent(0));
                // dispatch(setUnzipping(false));
                if (err.message.includes("spawn unzip ENOENT"))
                    return window.dialog.customError({
                        message: "Error while extracting.",
                        detail: '"unzip" not found. Please install by using\n"sudo apt install unzip"',
                    });
                return window.dialog.customError({
                    message: "Error while extracting.",
                    detail: err.message,
                    log: false,
                });
            }
            console.log("done extraxting epub file.");
            const parser = new DOMParser();
            const META_INF_TEXT = window.fs.readFileSync(
                window.path.join(extractPath, "META-INF/container.xml"),
                "utf-8"
            );
            const META_INF = parser.parseFromString(META_INF_TEXT, "text/xml");
            const CONTENT_PATH = window.path.join(
                extractPath,
                META_INF.querySelector("rootfile")?.getAttribute("full-path") || ""
            );
            if (
                CONTENT_PATH &&
                window.fs.existsSync(CONTENT_PATH) &&
                !window.fs.lstatSync(CONTENT_PATH).isDirectory()
            ) {
                const CONTENT_OPF_TEXT = window.fs.readFileSync(CONTENT_PATH, "utf-8");
                const CONTENT_OPF = parser.parseFromString(CONTENT_OPF_TEXT, "text/xml");
                const manifestData = CONTENT_OPF.querySelectorAll("manifest > item");
                if (manifestData.length > 0) {
                    const tempDisplayData: DisplayData[] = [];
                    const tempStylesheets: string[] = [];
                    manifestData.forEach((manifest) => {
                        const mediaType = manifest.getAttribute("media-type");
                        if (mediaType === "application/xhtml+xml") {
                            const href = manifest.getAttribute("href");
                            if (href) {
                                const filePath = window.path.join(window.path.dirname(CONTENT_PATH), href);
                                if (!appSettings.epubReaderSettings.loadOneChapter) {
                                    const xhtml = parseEPubHTMLX(filePath, parser);
                                    tempDisplayData.push({
                                        // type: "html",
                                        content: xhtml,
                                        id: manifest.getAttribute("id") || "",
                                        url: filePath,
                                    });
                                } else
                                    tempDisplayData.push({
                                        id: manifest.getAttribute("id") || "",
                                        url: filePath,
                                    });
                            }
                        }
                        // if (mediaType?.startsWith("image/")) {
                        //     const href = window.path.join(
                        //         window.path.dirname(CONTENT_PATH),
                        //         e.getAttribute("href") || ""
                        //     );
                        //     if (href) {
                        //         // const filePath = window.path.join(window.path.dirname(CONTENT_PATH), href);
                        //         tempDisplayData.push({
                        //             type: "image",
                        //             content: href,
                        //             id: e.getAttribute("id") || "",
                        //             url: href,
                        //         });
                        //     }
                        // }
                        if (mediaType === "text/css") {
                            const href_old = manifest.getAttribute("href");
                            if (href_old) {
                                const href = window.path.join(window.path.dirname(CONTENT_PATH), href_old);
                                tempStylesheets.push(href);
                            }
                        }
                        if (mediaType === "application/x-dtbncx+xml") {
                            const href = window.path.join(
                                window.path.dirname(CONTENT_PATH),
                                manifest.getAttribute("href") || ""
                            );
                            if (href) {
                                window.fs.readFile(href, "utf8", (err, data) => {
                                    if (err) return console.error(err);
                                    const tocXML = parser.parseFromString(data, "application/xml");
                                    const depth_original = parseInt(
                                        tocXML.querySelector('meta[name="dtb:depth"]')?.getAttribute("content") ||
                                            "1"
                                    );
                                    const tempTOCData: TOCData = {
                                        title: tocXML.querySelector("docTitle text")?.textContent || "~",
                                        author: tocXML.querySelector("docAuthor text")?.textContent || "~",
                                        depth: depth_original,
                                        nav: [],
                                    };

                                    /**idk y some epub had depth=2 but only had one navPoint, so making this */
                                    let changedDepth = false;
                                    /** some have useless depth making errors later  */
                                    let depth_real = depth_original;
                                    const getData = (selector: string, depth: number) => {
                                        const elems = tocXML.querySelectorAll(selector);
                                        if (elems.length <= 0) return;
                                        if (depth < depth_real) {
                                            changedDepth = true;
                                            depth_real = depth;
                                        }
                                        elems.forEach((e, i) => {
                                            tempTOCData.nav.push({
                                                name: e.querySelector("navLabel text")?.textContent || "~",
                                                src: window.path.join(
                                                    window.path.dirname(href),
                                                    // dunno why but some toc.ncx have src like "Text/Text/0202_Chapter_202_-_Seems_Like_Never_Coming_Back.xhtml"
                                                    e
                                                        .querySelector("content")
                                                        ?.getAttribute("src")
                                                        ?.replace("Text/Text/", "Text/") || ""
                                                ),
                                                depth: depth,
                                            });
                                            if (depth > 1) {
                                                getData(selector + `:nth-of-type(${i + 1}) > navPoint`, depth - 1);
                                            }
                                        });
                                    };
                                    getData("navMap > navPoint", depth_original);
                                    dispatch(
                                        setBookInReader({
                                            author: tempTOCData.author,
                                            link,
                                            title: tempTOCData.title,
                                            data: new Date().toLocaleString("en-UK", { hour12: true }),
                                        })
                                    );
                                    // console.log(depth_real, depth_original, depth_original - depth_real + 1);
                                    // if (!changedDepth)
                                    tempTOCData.depth = depth_original - depth_real + 1;
                                    tempTOCData.nav = tempTOCData.nav.map((e) => {
                                        return { ...e, depth: e.depth - depth_real + 1 };
                                    });
                                    // // first with lowest depth
                                    // setCurrentChapterURL(tempTOCData.nav.find((e) => e.depth === 1)!.src);
                                    setCurrentChapterURL(tempTOCData.nav[0].src);
                                    settocData(tempTOCData);
                                });
                            }
                        }
                    });
                    const spineData = CONTENT_OPF.querySelectorAll("spine > itemref");
                    if (spineData.length > 0) {
                        const tempIDREf: string[] = [];
                        spineData.forEach((e, i) => {
                            tempIDREf.push(e.getAttribute("idref") || "no-idref-found-" + i);
                        });
                        if (tempIDREf.length > 200 && !appSettings.epubReaderSettings.loadOneChapter)
                            window.dialog.warn({
                                message: "Too many chapters detected",
                                noOption: true,
                                detail: "It might cause instability and high RAM usage. It is recommended to enable option to load and show only chapter at a time from Settings → Other Settings.",
                            });
                        setDisplayData(tempDisplayData);
                        setEpubStylesheets(tempStylesheets);
                        setDisplayOrder(tempIDREf);

                        dispatch(setUnzipping(false));

                        // dispatch(setLoadingMangaPercent(100));
                        // dispatch(setLoadingManga(false));

                        dispatch(setReaderOpen(true));
                    }
                }
            }
        });
    };

    const makeScrollPos = () => {
        let y = 50;
        let elem: Element | null = null;
        while (y < window.innerHeight / 2) {
            elem = document.elementFromPoint(window.innerWidth / 2, y);
            if (elem) if (elem.tagName !== "SECTION") break;
            y += 10;
        }
        if (elem) {
            const fff = window.getCSSPath(elem);
            setElemBeforeChange(fff);
        }
    };

    const findInPage = (str: string, forward = true) => {
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
    };

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
            document.body.requestFullscreen();
        } else {
            document.body.classList.remove("zenMode");
            setWasMaximized(false);
            if (document.fullscreenElement) document.exitFullscreen();
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
        /**
         * todo: do only when mouse up
         */
        dispatch(setReaderSettings({ sideListWidth }));
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

        const shortcutkey: { [e in ShortcutCommands]?: { key1: string; key2: string } } = {};
        shortcuts.forEach((e) => {
            shortcutkey[e.command] = { key1: e.key1, key2: e.key2 };
        });
        const registerShortcuts = (e: KeyboardEvent) => {
            // /&& document.activeElement!.tagName === "BODY"
            window.app.keyRepeated = e.repeat;
            if (window.app.isReaderOpen && !isLoadingManga && !e.ctrlKey) {
                switch (e.key) {
                    case shortcutkey.readerSettings?.key1:
                    case shortcutkey.readerSettings?.key2:
                        readerSettingExtender.current?.click();
                        readerSettingExtender.current?.focus();
                        break;
                    case shortcutkey.toggleZenMode?.key1:
                    case shortcutkey.toggleZenMode?.key2:
                        makeScrollPos();
                        setZenMode((prev) => !prev);
                        break;
                    case "Escape":
                        makeScrollPos();
                        setZenMode(false);
                        break;
                    case shortcutkey.nextChapter?.key1:
                    case shortcutkey.nextChapter?.key2:
                    case shortcutkey.nextPage?.key1:
                    case shortcutkey.nextPage?.key2:
                        if (!e.repeat) openNextChapterRef.current?.click();
                        break;
                    case shortcutkey.prevChapter?.key1:
                    case shortcutkey.prevChapter?.key2:
                    case shortcutkey.prevPage?.key1:
                    case shortcutkey.prevPage?.key2:
                        if (!e.repeat) openPrevChapterRef.current?.click();
                        break;
                    case shortcutkey.sizePlus?.key1:
                    case shortcutkey.sizePlus?.key2:
                        sizePlusRef.current?.click();
                        break;
                    case shortcutkey.sizeMinus?.key1:
                    case shortcutkey.sizeMinus?.key2:
                        sizeMinusRef.current?.click();
                        break;
                    default:
                        break;
                }

                if (document.activeElement!.tagName === "BODY" || document.activeElement === readerRef.current) {
                    window.app.keydown = true;
                    if (
                        e.shiftKey &&
                        (e.key === shortcutkey.largeScroll?.key1 || e.key === shortcutkey.largeScroll?.key2)
                    ) {
                        e.preventDefault();
                        scrollReader(0 - appSettings.readerSettings.scrollSpeedB);
                        return;
                    }

                    switch (e.key) {
                        case shortcutkey.largeScroll?.key1:
                        case shortcutkey.largeScroll?.key2:
                            e.preventDefault();
                            scrollReader(appSettings.readerSettings.scrollSpeedB);
                            break;
                        case shortcutkey.scrollDown?.key1:
                        case shortcutkey.scrollDown?.key2:
                            scrollReader(appSettings.readerSettings.scrollSpeedA);
                            break;
                        case shortcutkey.scrollUp?.key1:
                        case shortcutkey.scrollUp?.key2:
                            scrollReader(0 - appSettings.readerSettings.scrollSpeedA);
                            break;
                    }
                }
            }
        };

        window.addEventListener("wheel", wheelFunction);
        window.addEventListener("keydown", registerShortcuts);
        window.addEventListener("keyup", () => {
            window.app.keydown = false;
        });
        return () => {
            window.removeEventListener("wheel", wheelFunction);
            window.removeEventListener("keydown", registerShortcuts);
            window.removeEventListener("keyup", () => {
                window.app.keydown = false;
            });
        };
    }, [appSettings, isLoadingManga, shortcuts]);

    useLayoutEffect(() => {
        if (elemBeforeChange)
            document.querySelector(elemBeforeChange)?.scrollIntoView({
                behavior: "auto",
                block: "start",
            });
    }, [
        appSettings.epubReaderSettings.readerWidth,
        appSettings.epubReaderSettings.fontSize,
        appSettings.epubReaderSettings.fontFamily,
        appSettings.epubReaderSettings.lineSpacing,
        appSettings.epubReaderSettings.paragraphSpacing,
        appSettings.epubReaderSettings.wordSpacing,
        appSettings.epubReaderSettings.useDefault_fontFamily,
        appSettings.epubReaderSettings.useDefault_lineSpacing,
        appSettings.epubReaderSettings.useDefault_paragraphSpacing,
        appSettings.epubReaderSettings.useDefault_wordSpacing,
        isSideListPinned,
    ]);

    useLayoutEffect(() => {
        loadEPub(linkInReader.link);
    }, [linkInReader]);

    return (
        <div
            ref={readerRef}
            id="EPubReader"
            className={(isSideListPinned ? "sideListPinned " : "") + "reader "}
            style={{
                gridTemplateColumns: sideListWidth + "px auto",
                display: isReaderOpen ? (isSideListPinned ? "grid" : "block") : "none",
                "--sideListWidth": sideListWidth + "px",
            }}
            tabIndex={-1}
        >
            <EPUBReaderSettings
                readerRef={readerRef}
                makeScrollPos={makeScrollPos}
                readerSettingExtender={readerSettingExtender}
                sizePlusRef={sizePlusRef}
                sizeMinusRef={sizeMinusRef}
                // setshortcutText={setshortcutText}
            />

            {tocData && (
                <EPubReaderSideList
                    tocData={tocData}
                    epubLinkClick={epubLinkClick}
                    openNextChapterRef={openNextChapterRef}
                    openPrevChapterRef={openPrevChapterRef}
                    currentChapterURL={currentChapterURL}
                    setCurrentChapterURL={setCurrentChapterURL}
                    // addToBookmarkRef={addToBookmarkRef}
                    // setshortcutText={setshortcutText}
                    // isBookmarked={isBookmarked}
                    // setBookmarked={setBookmarked}
                    isSideListPinned={isSideListPinned}
                    setSideListPinned={setSideListPinned}
                    setSideListWidth={setSideListWidth}
                    makeScrollPos={makeScrollPos}
                    findInPage={findInPage}
                />
            )}
            <section
                className={
                    "main " +
                    (appSettings.epubReaderSettings.useDefault_fontFamily ? "" : "forceFont ") +
                    (appSettings.epubReaderSettings.useDefault_paragraphSpacing ? "" : "forceParaGap ") +
                    (appSettings.epubReaderSettings.hyphenation ? "hyphen " : "")
                }
                ref={mainRef}
                style={{
                    fontSize: appSettings.epubReaderSettings.fontSize + "px",
                    "--font-family": appSettings.epubReaderSettings.useDefault_fontFamily
                        ? "inherit"
                        : appSettings.epubReaderSettings.fontFamily,
                    "--line-height": appSettings.epubReaderSettings.useDefault_lineSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.lineSpacing + "em",
                    "--word-spacing": appSettings.epubReaderSettings.useDefault_wordSpacing
                        ? "normal"
                        : appSettings.epubReaderSettings.wordSpacing + "em",
                    "--paragraph-gap": appSettings.epubReaderSettings.useDefault_paragraphSpacing
                        ? "auto"
                        : appSettings.epubReaderSettings.paragraphSpacing / 2 + "em 0",
                    "--width": appSettings.epubReaderSettings.readerWidth + "%",
                }}
                onClick={(e) => {
                    if (readerRef.current && appSettings.epubReaderSettings.loadOneChapter) {
                        if (
                            readerRef.current.scrollTop + window.innerHeight >= readerRef.current.scrollHeight ||
                            readerRef.current.scrollTop < window.innerHeight / 4
                        ) {
                            let clickPos = (e.clientX / e.currentTarget.offsetWidth) * 100;
                            if (isSideListPinned) {
                                clickPos = ((e.clientX - sideListWidth) / e.currentTarget.offsetWidth) * 100;
                            }
                            if (clickPos <= 5) openPrevChapterRef.current?.click();
                            if (clickPos > 95) openNextChapterRef.current?.click();
                        }
                    }
                }}
            >
                <StyleSheets sheets={epubStylesheets} />
                <HTMLPart
                    loadOneChapter={appSettings.epubReaderSettings.loadOneChapter}
                    currentChapterURL={currentChapterURL}
                    displayOrder={displayOrder}
                    displayData={displayData}
                    epubLinkClick={epubLinkClick}
                    tocData={tocData || null}
                />
            </section>
        </div>
    );
};

export default EPubReader;
