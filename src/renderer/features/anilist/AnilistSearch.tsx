import { addAnilistTracker } from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderManga } from "@store/reader";
import { setAnilistSearchOpen } from "@store/ui";
import AniList from "@utils/anilist";
import React, { useEffect, useState } from "react";

import FocusLock from "react-focus-lock";

const AnilistSearch = () => {
    const mangaInReader = useAppSelector(getReaderManga);

    const [search, setSearch] = useState("");
    const [result, setResult] = useState<Awaited<ReturnType<typeof AniList.searchManga>>>([]);
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

    const dispatch = useAppDispatch();
    useEffect(() => {
        setSearch(mangaInReader?.title || "");
    }, []);
    useEffect(() => {
        AniList.searchManga(search).then((e) => {
            setResult(e);
        });
    }, [search]);

    const ResultListItem = ({
        english,
        romaji,
        native,
        cover,
        startDate,
        id,
        status,
    }: {
        english: string;
        romaji: string;
        native: string;
        cover: string;
        startDate: string;
        id: number;
        status: "FINISHED" | "RELEASING" | "CANCELLED" | "HIATUS";
    }) => {
        return (
            <li>
                <button
                    className="row"
                    onClick={() => {
                        if (mangaInReader) {
                            dispatch(
                                addAnilistTracker({
                                    anilistMediaId: id,
                                    localURL: window.path.dirname(mangaInReader.link),
                                })
                            );
                            dispatch(setAnilistSearchOpen(false));
                        }
                    }}
                >
                    <div className="cover" style={{ backgroundImage: `url(${cover})` }}>
                        {/* <img src={cover} alt="cover" draggable={false} /> */}
                    </div>
                    <div className="col">
                        <span title={english || romaji || native}>{english || romaji || native}</span>
                        <span title={romaji || "~"}>{romaji || "~"}</span>
                        <span title={native || "~"}>{native || "~"}</span>
                        <div className="row">
                            <span className="row">
                                <span>Started</span>
                                <span>{startDate}</span>
                            </span>
                            <span className="row">
                                <span>Status</span>
                                <span>{status}</span>
                            </span>
                        </div>
                    </div>
                </button>
            </li>
        );
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
                <div className="clickClose" onClick={() => dispatch(setAnilistSearchOpen(false))}></div>
                <div
                    className="overlayCont"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") dispatch(setAnilistSearchOpen(false));
                    }}
                    tabIndex={-1}
                    // ref={contRef}
                >
                    <h1>Add Tracking</h1>
                    <div className="searchBar">
                        <input
                            type="text"
                            placeholder="Search on Anilist"
                            onKeyDown={(e) => {
                                e.stopPropagation();
                            }}
                            ref={(node) => {
                                if (node) node.focus();
                            }}
                            defaultValue={mangaInReader?.title || ""}
                            onChange={(e) => {
                                if (searchTimeout) clearTimeout(searchTimeout);
                                const value = e.currentTarget.value;
                                setSearchTimeout(
                                    setTimeout(() => {
                                        setSearch(value);
                                    }, 1000)
                                );
                            }}
                        />
                    </div>
                    <div className="results">
                        {result.length <= 0 ? (
                            <p>No Result</p>
                        ) : (
                            <ol>
                                {result.map((e, i) => (
                                    <ResultListItem
                                        english={e.title.english}
                                        romaji={e.title.romaji}
                                        native={e.title.native}
                                        id={e.id}
                                        cover={e.coverImage.medium}
                                        status={e.status}
                                        startDate={`${e.startDate.year}-${e.startDate.month}-${e.startDate.day}`}
                                        key={e.title.romaji + i}
                                    />
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </div>
        </FocusLock>
    );
};

export default AnilistSearch;
