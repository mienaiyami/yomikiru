import type { EpubNcxTree, EpubToc } from "@common/epub";
import { useAppSelector } from "@store/hooks";
import { selectLiveBookReaderSettings } from "@store/reader";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
    expandedWithAncestorsVisible,
    findNavIdByHref,
    flattenVisibleNcxRows,
    visibleRowIndexForNavId,
} from "../contentList";

/** Fixed TOC row height (px); keep in sync with side-list row padding. */
const TOC_ROW_PX = 30;

/** Imperative locate API for the EPUB Content TOC (parent locate button). */
export type ContentListHandle = {
    /**
     * Expands ancestors of the current chapter and scrolls that row into view.
     * @param align Virtualizer scroll alignment (`start` for auto-focus, `center` for locate)
     */
    locateCurrent: (align?: "start" | "center") => void;
};

type ContentListProps = {
    currentChapterHref: string;
    epubTOC: EpubToc;
    epubNCX: EpubNcxTree[];
    onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    sideListRef: React.RefObject<HTMLDivElement | null>;
    /** Overflow parent (`.location-cont`); required for TanStack scroll. */
    scrollContainerRef: React.RefObject<HTMLElement | null>;
};

const ContentListInner = forwardRef<ContentListHandle, ContentListProps>(
    (
        { epubNCX, epubTOC, onEpubLinkClick, sideListRef, currentChapterHref, scrollContainerRef },
        contentListRef,
    ) => {
        const { t } = useTranslation("reader");
        const focusChapterInList = useAppSelector(
            (store) => selectLiveBookReaderSettings(store).focusChapterInList,
        );
        const [listShow, setListShow] = useState(() => new Array(epubTOC.size).fill(false) as boolean[]);
        /* pending scroll after expand; applied once the flattened row exists */
        const pendingScrollRef = useRef<{ navId: string; align: "start" | "center" } | null>(null);

        const visibleRows = useMemo(() => flattenVisibleNcxRows(epubNCX, listShow), [epubNCX, listShow]);

        const virtualizer = useVirtualizer({
            count: visibleRows.length,
            getScrollElement: () => scrollContainerRef.current,
            estimateSize: () => TOC_ROW_PX,
            /* navId keys so expand/collapse remounts the correct row identity */
            getItemKey: (rowIndex) => visibleRows[rowIndex]?.navId ?? rowIndex,
            overscan: 8,
        });

        const revealAndScroll = useCallback(
            (navId: string, align: "start" | "center") => {
                setListShow((prev) => expandedWithAncestorsVisible(epubNCX, prev, navId));
                pendingScrollRef.current = { navId, align };
            },
            [epubNCX],
        );

        useImperativeHandle(
            contentListRef,
            () => ({
                locateCurrent: (align = "center") => {
                    const navId = findNavIdByHref(epubTOC, currentChapterHref);
                    if (!navId) return;
                    revealAndScroll(navId, align);
                },
            }),
            [contentListRef, currentChapterHref, epubTOC, revealAndScroll],
        );

        useEffect(() => {
            if (!focusChapterInList) return;
            const navId = findNavIdByHref(epubTOC, currentChapterHref);
            if (!navId) return;
            revealAndScroll(navId, "start");
        }, [currentChapterHref, epubTOC, focusChapterInList, revealAndScroll]);

        useLayoutEffect(() => {
            const pending = pendingScrollRef.current;
            if (!pending) return;
            const rowIndex = visibleRowIndexForNavId(visibleRows, pending.navId);
            if (rowIndex < 0) return;
            pendingScrollRef.current = null;
            virtualizer.scrollToIndex(rowIndex, { align: pending.align, behavior: "instant" });
        }, [visibleRows, virtualizer]);

        const toggleExpand = useCallback((ncxIndex: number) => {
            setListShow((prev) => {
                const next = [...prev];
                next[ncxIndex] = !next[ncxIndex];
                return next;
            });
        }, []);

        if (epubTOC.size === 0) return <p>{t("sideList.noToc")}</p>;
        if (visibleRows.length === 0) return null;

        const vItems = virtualizer.getVirtualItems();

        return (
            <ol
                className="is-virtual"
                style={{
                    display: "block",
                    position: "relative",
                    width: "100%",
                    height: `${virtualizer.getTotalSize()}px`,
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                }}
            >
                {vItems.map((virtualRow) => {
                    const row = visibleRows[virtualRow.index];
                    if (!row) return null;
                    const tocEntry = epubTOC.get(row.navId);
                    const isCurrent = tocEntry?.href === currentChapterHref;
                    const isExpanded = listShow[row.ncx_index2];
                    return (
                        <li
                            key={String(virtualRow.key)}
                            data-index={virtualRow.index}
                            className={`${row.hasChildren ? "collapsible" : ""} ${
                                row.hasChildren && !isExpanded ? "collapsed" : ""
                            } ${isCurrent ? "current" : ""}`}
                            style={{
                                position: "absolute",
                                /*
                                 * `top` (not translateY): fractional DPI + transform leaves hairline
                                 * gaps / uneven row spacing while scrolling.
                                 */
                                top: virtualRow.start,
                                left: 0,
                                width: "100%",
                                height: virtualRow.size,
                            }}
                            onClick={(ev) => {
                                ev.stopPropagation();
                                if (row.hasChildren) toggleExpand(row.ncx_index2);
                            }}
                        >
                            <a
                                onClick={(ev) => {
                                    ev.stopPropagation();
                                    onEpubLinkClick(ev);
                                    sideListRef.current?.blur();
                                }}
                                title={tocEntry?.title}
                                data-href={tocEntry?.href}
                                data-depth={row.level}
                            >
                                <span className="text">
                                    {"\u00A0".repeat(row.level * 5)}
                                    {tocEntry?.title}
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        );
    },
);

ContentListInner.displayName = "ContentList";

const ContentList = memo(ContentListInner);
export default ContentList;
