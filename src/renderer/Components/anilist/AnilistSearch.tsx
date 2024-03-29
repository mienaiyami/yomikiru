import React, { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAniSearchOpen } from "../../store/isAniSearchOpen";
import { addAnilistTracker } from "../../store/anilistTracking";

import FocusLock from "react-focus-lock";

const AnilistSearch = () => {
    // const anilistTracking = useAppSelector((store) => store.anilistTracking);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);

    const [search, setSearch] = useState("");
    const [result, setResult] = useState<Awaited<ReturnType<typeof window.al.searchManga>>>([]);
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

    // const contRef = useRef<HTMLDivElement>(null);
    // const inputRef = useRef<HTMLInputElement>(null);
    const dispatch = useAppDispatch();
    useEffect(() => {
        // if (inputRef.current) {
        //     // inputRef.current.focus();
        //     inputRef.current.value = mangaInReader?.mangaName || "";
        // }
        setSearch(mangaInReader?.mangaName || "");
    }, []);
    useEffect(() => {
        window.al.searchManga(search).then((e) => {
            setResult(e);
        });
    }, [search]);

    // useEffect(() => {
    //     setTimeout(() => {
    //         if (contRef.current) contRef.current.setAttribute("data-state", "open");
    //     }, 100);
    // }, []);

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
                            dispatch(setAniSearchOpen(false));
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
                <div className="clickClose" onClick={() => dispatch(setAniSearchOpen(false))}></div>
                <div
                    className="overlayCont"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") dispatch(setAniSearchOpen(false));
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
                            defaultValue={mangaInReader?.mangaName || ""}
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
