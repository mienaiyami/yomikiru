import ListNavigator from "@renderer/components/ListNavigator";
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { addAnilistTracker, setGalleryTrackContext } from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderContent } from "@store/reader";
import { setAnilistSearchOpen } from "@store/ui";
import {
    anilistFormatLabel,
    anilistOverlayCoverSrc,
    anilistStatusLabel,
    searchAnilistMedia,
} from "@utils/anilist";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import FocusLock from "react-focus-lock";
import { useTranslation } from "react-i18next";

/** Delay after the last keystroke before calling {@link searchAnilistMedia}. */
const SEARCH_DEBOUNCE_MS = 1000;
/** Matches the overlay `data-state="open"` delay so search focus lands when the panel is visible. */
const OVERLAY_OPEN_MS = 100;

const AnilistSearch = () => {
    const { t } = useTranslation("anilist");
    const galleryCtx = useAppSelector((s) => s.anilist.galleryTrackContext);
    const contentInReader = useAppSelector(getReaderContent);
    const effectiveTitle = galleryCtx?.title || contentInReader?.title || "";
    const effectiveLink = galleryCtx?.link || contentInReader?.link;

    const [search, setSearch] = useState(effectiveTitle);
    const [result, setResult] = useState<Anilist.SearchMediaItem[]>([]);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resultsScrollRef = useRef<HTMLDivElement>(null);

    const dispatch = useAppDispatch();

    const closeSearch = useCallback(() => {
        dispatch(setGalleryTrackContext(null));
        dispatch(setAnilistSearchOpen(false));
    }, [dispatch]);

    useEffect(() => {
        setSearch(effectiveTitle);
    }, [effectiveTitle]);

    useEffect(() => {
        void searchAnilistMedia(search).then((e) => {
            setResult(e);
        });
    }, [search]);

    useEffect(
        () => () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        },
        [],
    );

    const handleItemClick = useCallback(
        (anilistMediaId: number) => {
            if (!effectiveLink) return;
            // bar fetch writes the snapshot cache; search only binds remoteId
            dispatch(
                addAnilistTracker({
                    anilistMediaId,
                    itemLink: effectiveLink,
                }),
            );
            closeSearch();
        },
        [closeSearch, dispatch, effectiveLink],
    );

    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        const value = e.currentTarget.value;
        searchTimeoutRef.current = setTimeout(() => {
            setSearch(value);
            searchTimeoutRef.current = null;
        }, SEARCH_DEBOUNCE_MS);
    };

    const renderItem = useCallback(
        (item: Anilist.SearchMediaItem, _index: number, isSelected: boolean) => (
            <ResultListItem item={item} isSelected={isSelected} onClick={() => handleItemClick(item.id)} />
        ),
        [handleItemClick],
    );

    return (
        <FocusLock>
            <div
                id="anilistSearch"
                data-state="closed"
                ref={(node) => {
                    if (node) {
                        setTimeout(() => {
                            if (node) node.setAttribute("data-state", "open");
                        }, OVERLAY_OPEN_MS);
                    }
                }}
            >
                <div className="clickClose" onClick={() => closeSearch()}></div>
                <div
                    className="overlayCont"
                    onKeyDownCapture={(e) => {
                        /* capture: ListNavigator.SearchInput stopPropagation so bubble never reaches here */
                        if (e.key !== "Escape") return;
                        e.stopPropagation();
                        closeSearch();
                    }}
                    tabIndex={-1}
                >
                    <h1>{t("search.title")}</h1>
                    <ListNavigator.Provider
                        key={`${effectiveLink ?? ""}|${effectiveTitle}`}
                        items={result}
                        persistFilterOnItemsChange
                        renderItem={renderItem}
                        onSelect={(elem) => elem.click()}
                        emptyMessage={t("search.noResult")}
                    >
                        <div className="searchBar">
                            <ListNavigator.SearchInput
                                autoFocusDelayMs={OVERLAY_OPEN_MS}
                                placeholder={t("search.placeholder")}
                                defaultValue={effectiveTitle}
                                onChange={handleSearchChange}
                                pageSearch={{
                                    id: "anilist-search",
                                    priority: PAGE_SEARCH_PRIORITY.overlay,
                                }}
                            />
                        </div>
                        <div className="results" ref={resultsScrollRef}>
                            <ListNavigator.List scrollContainerRef={resultsScrollRef} />
                        </div>
                    </ListNavigator.Provider>
                </div>
            </div>
        </FocusLock>
    );
};

type ResultListItemProps = {
    item: Anilist.SearchMediaItem;
    isSelected: boolean;
    onClick: () => void;
};

const ResultListItem = ({ item, isSelected, onClick }: ResultListItemProps) => {
    const { t } = useTranslation("anilist");
    const { title, coverImage, startDate, status, format } = item;
    const displayTitle = title.english || title.romaji || title.native || "~";
    const startDateStr = `${startDate.year ?? "?"}-${startDate.month ?? "?"}-${startDate.day ?? "?"}`;
    const formatStr = anilistFormatLabel(format);
    const statusStr = anilistStatusLabel(status);
    const overlayCover = anilistOverlayCoverSrc(coverImage);

    /* Same shape as ListItem: highlight on the <li>, click on an inner <a>
     * with no href so it is not a Tab stop. ListNavigator keeps caret in SearchInput;
     * listSelect clicks that <a>. A <button> would enter FocusLock's Tab cycle. */
    return (
        <li data-focused={isSelected}>
            <a className="row" onClick={onClick}>
                <div
                    className="cover"
                    style={
                        overlayCover
                            ? { backgroundImage: `url("${overlayCover.replaceAll('"', "%22")}")` }
                            : undefined
                    }
                />
                <div className="col">
                    <span title={displayTitle}>{displayTitle}</span>
                    <span title={title.romaji ?? "~"}>{title.romaji ?? "~"}</span>
                    <span title={title.native ?? "~"}>{title.native ?? "~"}</span>
                    <div className="row meta">
                        <span className="row">
                            <span className="badge">{formatStr}</span>
                        </span>
                        <span className="row">
                            <span className="badge">{t("search.started", { date: startDateStr })}</span>
                        </span>
                        <span className="row">
                            <span className="badge">{statusStr}</span>
                        </span>
                    </div>
                </div>
            </a>
        </li>
    );
};

export default AnilistSearch;
