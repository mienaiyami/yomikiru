import type { EpubNcxTree, EpubToc } from "@common/epub";
import { useAppSelector } from "@store/hooks";
import { selectLiveBookReaderSettings } from "@store/reader";
import { Fragment, memo, useState } from "react";
import { useTranslation } from "react-i18next";

const ContentList = memo(
    ({
        epubNCX,
        epubTOC,
        onEpubLinkClick,
        sideListRef,
        currentChapterHref,
    }: {
        currentChapterHref: string;
        epubTOC: EpubToc;
        epubNCX: EpubNcxTree[];
        onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
        sideListRef: React.RefObject<HTMLDivElement>;
    }) => {
        //todo add button to show toc.xhtml if exist
        const { t } = useTranslation("reader");
        const focusChapterInList = useAppSelector(
            (store) => selectLiveBookReaderSettings(store).focusChapterInList,
        );
        const [listShow, setListShow] = useState(new Array(epubTOC.size).fill(false));

        if (epubTOC.size === 0) return <p>{t("sideList.noToc")}</p>;

        const NestedList = ({ ncx }: { ncx: EpubNcxTree[] }) => {
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
                                        focusChapterInList
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
    /*
     * Navigation callbacks and TOC maps remain stable while the current href changes.
     * Restricting the comparator keeps large nested lists out of unrelated reader renders.
     */
    (prev, next) => prev.currentChapterHref === next.currentChapterHref,
);
ContentList.displayName = "ContentList";

export default ContentList;
