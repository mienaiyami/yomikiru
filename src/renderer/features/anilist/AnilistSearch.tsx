import { addAnilistTracker, setGalleryTrackContext } from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderContent } from "@store/reader";
import { setAnilistSearchOpen } from "@store/ui";
import AniList, { ANILIST_FORMAT_LABEL, ANILIST_STATUS_LABEL } from "@utils/anilist";
import { useCallback, useEffect, useState } from "react";
import FocusLock from "react-focus-lock";

const AnilistSearch = () => {
    const galleryCtx = useAppSelector((s) => s.anilist.galleryTrackContext);
    const contentInReader = useAppSelector(getReaderContent);
    const effectiveTitle = galleryCtx?.title || contentInReader?.title || "";
    const effectiveLink = galleryCtx?.link || contentInReader?.link;

    const [search, setSearch] = useState("");
    const [result, setResult] = useState<Anilist.SearchMediaItem[]>([]);
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

    const dispatch = useAppDispatch();

    const closeSearch = useCallback(() => {
        dispatch(setGalleryTrackContext(null));
        dispatch(setAnilistSearchOpen(false));
    }, [dispatch]);

    useEffect(() => {
        setSearch(effectiveTitle);
    }, [effectiveTitle]);

    useEffect(() => {
        void AniList.searchMedia(search).then((e) => {
            setResult(e);
        });
    }, [search]);

    const handleItemClick = (anilistMediaId: number) => {
        if (!effectiveLink) return;
        dispatch(
            addAnilistTracker({
                anilistMediaId,
                localURL: effectiveLink,
            }),
        );
        closeSearch();
    };

    return (
        <FocusLock>
            <div
                id="anilistSearch"
                data-state="closed"
                ref={(node) => {
                    if (node) {
                        setTimeout(() => {
                            if (node) node.setAttribute("data-state", "open");
                        }, 100);
                    }
                }}
            >
                <div className="clickClose" onClick={() => closeSearch()}></div>
                <div
                    className="overlayCont"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") closeSearch();
                    }}
                    tabIndex={-1}
                >
                    <h1>Add Tracking</h1>
                    <div className="searchBar">
                        <input
                            key={`${effectiveLink ?? ""}|${effectiveTitle}`}
                            type="text"
                            placeholder="Search on Anilist"
                            onKeyDown={(e) => {
                                e.stopPropagation();
                            }}
                            ref={(node) => {
                                if (node) node.focus();
                            }}
                            defaultValue={effectiveTitle}
                            onChange={(e) => {
                                if (searchTimeout) clearTimeout(searchTimeout);
                                const value = e.currentTarget.value;
                                setSearchTimeout(
                                    setTimeout(() => {
                                        setSearch(value);
                                    }, 1000),
                                );
                            }}
                        />
                    </div>
                    <div className="results">
                        {result.length <= 0 ? (
                            <p>No Result</p>
                        ) : (
                            <ol>
                                {result.map((e) => (
                                    <ResultListItem item={e} key={e.id} onClick={() => handleItemClick(e.id)} />
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </div>
        </FocusLock>
    );
};

type ResultListItemProps = {
    item: Anilist.SearchMediaItem;
    onClick: () => void;
};

const ResultListItem = ({ item, onClick }: ResultListItemProps) => {
    const { title, coverImage, startDate, status, format } = item;
    const displayTitle = title.english || title.romaji || title.native || "~";
    const startDateStr = `${startDate.year ?? "?"}-${startDate.month ?? "?"}-${startDate.day ?? "?"}`;
    const formatStr = ANILIST_FORMAT_LABEL[format] ?? format;
    const statusStr = ANILIST_STATUS_LABEL[status] ?? status;

    return (
        <li>
            <button type="button" className="row" onClick={onClick}>
                <div className="cover" style={{ backgroundImage: `url(${coverImage.medium})` }} />
                <div className="col">
                    <span title={displayTitle}>{displayTitle}</span>
                    <span title={title.romaji ?? "~"}>{title.romaji ?? "~"}</span>
                    <span title={title.native ?? "~"}>{title.native ?? "~"}</span>
                    <div className="row meta">
                        <span className="row">
                            <span className="badge">{formatStr}</span>
                        </span>
                        <span className="row">
                            <span className="badge">Started: {startDateStr}</span>
                        </span>
                        <span className="row">
                            <span className="badge">{statusStr}</span>
                        </span>
                    </div>
                </div>
            </button>
        </li>
    );
};

export default AnilistSearch;
