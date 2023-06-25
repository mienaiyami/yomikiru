import React, { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAniSearchOpen } from "../../store/isAniSearchOpen";
import { addAnilistTracker } from "../../store/anilistTracking";

const AnilistSearch = () => {
    // const anilistTracking = useAppSelector((store) => store.anilistTracking);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);

    const [search, setSearch] = useState("");
    const [result, setResult] = useState<Awaited<ReturnType<typeof window.al.searchManga>>>([]);
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

    // const contRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.value = mangaInReader?.mangaName || "";
        }
        setSearch(mangaInReader?.mangaName || "");
    }, []);
    useEffect(() => {
        window.al.searchManga(search).then((e) => {
            setResult(e);
        });
    }, [search]);

    const ResultListItem = ({
        english,
        romaji,
        cover,
        startDate,
        id,
        status,
    }: {
        english: string;
        romaji: string;
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
                        <span>{english || romaji}</span>
                        <span>{romaji || english}</span>
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
        <div id="anilistSearch">
            <div className="clickClose" onClick={() => dispatch(setAniSearchOpen(false))}></div>
            <div
                className="cont"
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
                        ref={inputRef}
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
    );
};

export default AnilistSearch;
