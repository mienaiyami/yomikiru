import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import css, { Rule as CSSRule } from "css";
import { AppContext } from "../App";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setMangaInReader } from "../store/mangaInReader";
import { setReaderOpen } from "../store/isReaderOpen";
import { setLoadingMangaPercent } from "../store/loadingMangaPercent";
import { setLoadingManga } from "../store/isLoadingManga";
import { setLinkInReader } from "../store/linkInReader";
import { newHistory } from "../store/history";
import { setContextMenu } from "../store/contextMenu";
import EPUBReaderSettings from "./EPubReaderSettings";
import EPubReaderSideList from "./EPubReaderSideList";
import { setReaderSettings } from "../store/appSettings";

type ReaderImageSrc = string;
type ReaderHTML = Document;

interface DisplayData {
    type: "image" | "html";
    /**
     * id from content.opf
     */
    id: string;
    url: string;
    content: ReaderHTML | ReaderImageSrc;
}

const EPubReader = () => {
    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const isReaderOpen = useAppSelector((store) => store.isReaderOpen);
    const linkInReader = useAppSelector((store) => store.linkInReader);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);
    const isLoadingManga = useAppSelector((store) => store.isLoadingManga);
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const pageNumChangeDisabled = useAppSelector((store) => store.pageNumChangeDisabled);
    const prevNextChapter = useAppSelector((store) => store.prevNextChapter);

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
    const [tocData, settocData] = useState<TOCData>();
    const [sideListWidth, setSideListWidth] = useState(appSettings.readerSettings.sideListWidth || 450);

    const readerRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLSelectElement>(null);
    const readerSettingExtender = useRef<HTMLButtonElement>(null);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const openPrevChapterRef = useRef<HTMLButtonElement>(null);
    const openNextChapterRef = useRef<HTMLButtonElement>(null);

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
    const epubLinkClick = (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        ev.preventDefault();
        const data_href = (ev.currentTarget as Element).getAttribute("data-href");
        if (data_href) {
            const idFromURL = displayData.find((a) => a.url === data_href)?.id;
            if (idFromURL) document.getElementById("epub-" + idFromURL)?.scrollIntoView();
        } else {
            if ((ev.currentTarget as HTMLAnchorElement).href) {
                window.electron.shell.openExternal((ev.currentTarget as HTMLAnchorElement).href);
            }
        }
    };

    const ImagePart = ({ src }: { src: ReaderImageSrc }) => {
        return (
            <div className="cont imgCont">
                <img src={src} alt="Image" />
            </div>
        );
    };

    const StyleSheets = ({ sheets }: { sheets: string[] }) => {
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
    };

    const HTMLPart = ({ xhtml, url }: { xhtml: ReaderHTML; url: string }) => {
        return (
            <div
                className="cont htmlCont"
                ref={(node) => {
                    if (node) {
                        // // ! temp, use memo or smoething
                        // while (node.hasChildNodes()) {
                        //     node.removeChild(node.childNodes[0]);
                        // }
                        node.id = "epub-" + xhtml.body.id;
                        node.setAttribute("data-link-id", url);
                        xhtml.body.childNodes.forEach((childNode) => {
                            node.appendChild(childNode.cloneNode(true));
                        });
                        node.querySelectorAll("a").forEach((e) => {
                            e.addEventListener("click", epubLinkClick);
                        });
                        node.querySelectorAll("img").forEach((e) => {
                            e.oncontextmenu = (ev) => {
                                dispatch(
                                    setContextMenu({
                                        clickX: ev.clientX,
                                        clickY: ev.clientY,
                                        hasLink: {
                                            link: e.getAttribute("src") || "",
                                            simple: {
                                                isImage: true,
                                            },
                                        },
                                    })
                                );
                            };
                        });
                    }
                }}
            ></div>
        );
    };

    const PartCont = ({ data }: { data: DisplayData | string }) => {
        if (typeof data === "string") return <p className="error">{data}</p>;
        return data.type === "html" ? (
            <HTMLPart xhtml={data.content as ReaderHTML} url={data.url} />
        ) : (
            <ImagePart src={data.content as ReaderImageSrc} />
        );
    };

    const loadEPub = (link: string) => {
        link = window.path.normalize(link);
        const linkSplitted = link.split(window.path.sep).filter((e) => e !== "");
        const extractPath = window.path.join(
            window.electron.app.getPath("temp"),
            `yomikiru-temp-EPub-${linkSplitted[linkSplitted.length - 1]}-${window.crypto.randomUUID()}`
        );
        console.log("extracting ", link, " at ", extractPath);
        window.crossZip.unzip(link, extractPath, (err) => {
            dispatch(setLoadingMangaPercent(50));
            if (err) {
                dispatch(setLoadingManga(false));
                dispatch(setLoadingMangaPercent(0));
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
                    manifestData.forEach((e) => {
                        const mediaType = e.getAttribute("media-type");
                        if (mediaType === "application/xhtml+xml") {
                            const href = e.getAttribute("href");
                            if (href) {
                                const filePath = window.path.join(window.path.dirname(CONTENT_PATH), href);
                                const txt = window.fs.readFileSync(decodeURIComponent(filePath), "utf-8");
                                const xhtml = parser.parseFromString(txt, "application/xhtml+xml");
                                xhtml.querySelectorAll("[src]").forEach((e) => {
                                    const src_old = e.getAttribute("src") || "";
                                    e.setAttribute(
                                        "src",
                                        window.path.join(window.path.dirname(filePath), src_old)
                                    );
                                });
                                // console.log(xhtml.querySelectorAll("[href]"));
                                xhtml.querySelectorAll("[href]").forEach((e) => {
                                    const href_old = e.getAttribute("href");
                                    if (href_old)
                                        if (!href_old.startsWith("http")) {
                                            // (e as HTMLLinkElement).href = (e as HTMLLinkElement).href.split("#").splice(-1)[0];
                                            e.setAttribute(
                                                "data-href",
                                                window.path.join(window.path.dirname(filePath), href_old)
                                            );
                                            e.removeAttribute("href");
                                        }
                                });

                                xhtml.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
                                xhtml.body.id = e.getAttribute("id") || "";
                                tempDisplayData.push({
                                    type: "html",
                                    content: xhtml,
                                    id: e.getAttribute("id") || "",
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
                            const href_old = e.getAttribute("href");
                            if (href_old) {
                                const href = window.path.join(window.path.dirname(CONTENT_PATH), href_old);
                                tempStylesheets.push(href);
                            }
                        }
                        if (mediaType === "application/x-dtbncx+xml") {
                            const href = window.path.join(
                                window.path.dirname(CONTENT_PATH),
                                e.getAttribute("href") || ""
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
                                    const getData = (selector: string, depth: number) => {
                                        const navData: TOCData["nav"][] = [];
                                        const elems = tocXML.querySelectorAll(selector);
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
                                    console.log(tempTOCData);
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
                        setDisplayData(tempDisplayData);
                        setEpubStylesheets(tempStylesheets);
                        setDisplayOrder(tempIDREf);

                        dispatch(setLoadingMangaPercent(100));
                        dispatch(setLoadingManga(false));

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
                        scrollReader(0 - appSettings.readerSettings.largeScrollMultiplier);
                        return;
                    }

                    switch (e.key) {
                        case shortcutkey.largeScroll?.key1:
                        case shortcutkey.largeScroll?.key2:
                            e.preventDefault();
                            scrollReader(appSettings.readerSettings.largeScrollMultiplier);
                            break;
                        case shortcutkey.scrollDown?.key1:
                        case shortcutkey.scrollDown?.key2:
                            scrollReader(appSettings.readerSettings.scrollSpeed);
                            break;
                        case shortcutkey.scrollUp?.key1:
                        case shortcutkey.scrollUp?.key2:
                            scrollReader(0 - appSettings.readerSettings.scrollSpeed);
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
            className={(isSideListPinned ? "sideListPinned " : "") + "reader"}
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
                    // addToBookmarkRef={addToBookmarkRef}
                    // setshortcutText={setshortcutText}
                    // isBookmarked={isBookmarked}
                    // setBookmarked={setBookmarked}
                    isSideListPinned={isSideListPinned}
                    setSideListPinned={setSideListPinned}
                    setSideListWidth={setSideListWidth}
                    makeScrollPos={makeScrollPos}
                />
            )}
            <section
                className={
                    "main " +
                    (appSettings.epubReaderSettings.useDefault_fontFamily ? "" : "forceFont ") +
                    (appSettings.epubReaderSettings.useDefault_paragraphSpacing ? "" : "forceParaGap ")
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
            >
                <StyleSheets sheets={epubStylesheets} />
                {displayOrder.map((e, i) => (
                    <PartCont data={displayData.find((a) => a.id === e) || e} key={"key-" + i} />
                ))}
            </section>
        </div>
    );
};

export default EPubReader;
