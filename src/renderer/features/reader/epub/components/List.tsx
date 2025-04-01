import { useAppSelector } from "@store/hooks";
import { memo, useState, Fragment } from "react";

const List = memo(
    ({
        epubNCX,
        epubTOC,
        onEpubLinkClick,
        sideListRef,
        currentChapterHref,
    }: {
        currentChapterHref: string;
        epubTOC: EPUB.TOC;
        epubNCX: EPUB.NCXTree[];
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
        sideListRef: React.RefObject<HTMLDivElement>;
    }) => {
        //todo add button to show toc.xhtml if exist
        const appSettings = useAppSelector((store) => store.appSettings);
        const [listShow, setListShow] = useState(new Array(epubTOC.size).fill(false));

        if (epubTOC.size === 0) return <p>No TOC found in epub</p>;

        const NestedList = ({ ncx }: { ncx: EPUB.NCXTree[] }) => {
            return (
                <ol>
                    {ncx.map((e) => (
                        <Fragment key={e.ncx_index2}>
                            <li
                                className={`${e.sub.length > 0 ? "collapsible" : ""} ${
                                    !listShow[e.ncx_index2] ? "collapsed" : ""
                                } ${epubTOC.get(e.navId)?.href === currentChapterHref ? "current" : ""}`}
                                // style={{ "--level-top": epubNCXDepth - e.level }}
                                onClick={(ev) => {
                                    ev.stopPropagation();
                                    setListShow((init) => {
                                        const dup = [...init];
                                        dup[e.ncx_index2] = !dup[e.ncx_index2];
                                        return dup;
                                    });
                                }}
                            >
                                <a
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        onEpubLinkClick(ev);
                                        sideListRef.current?.blur();
                                    }}
                                    title={epubTOC.get(e.navId)?.title}
                                    data-href={epubTOC.get(e.navId)?.href}
                                    data-depth={e.level}
                                    //todo check if works
                                    ref={
                                        appSettings.epubReaderSettings.focusChapterInList
                                            ? (node) => {
                                                  if (node && epubTOC.get(e.navId)?.href === currentChapterHref) {
                                                      if (listShow[e.ncx_index2] === false)
                                                          setListShow((init) => {
                                                              const dup = [...init];
                                                              dup[e.ncx_index2] = true;
                                                              return dup;
                                                          });
                                                      node.scrollIntoView({ block: "start" });
                                                  }
                                              }
                                            : undefined
                                    }
                                >
                                    <span className="text">
                                        {"\u00A0".repeat(e.level * 5)}
                                        {epubTOC.get(e.navId)?.title}
                                    </span>
                                </a>
                            </li>
                            {e.sub.length > 0 && <NestedList ncx={e.sub} />}
                        </Fragment>
                    ))}
                </ol>
            );
        };
        return <NestedList ncx={epubNCX} />;
    },
    //todo imp check if need in props
    // focusChapterInList will make sure that it wont rerender when its `false` for performance benefits
    // (prev, next) => !prev.focusChapterInList || prev.currentChapter.href === next.currentChapter.href
    (prev, next) => prev.currentChapterHref === next.currentChapterHref,
);
List.displayName = "List";

export default List;
