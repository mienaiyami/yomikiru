import { faMinus, faPlus, faSlidersH } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setAnilistCurrentManga } from "@store/anilistCurrentManga";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAniEditOpen } from "@store/isAniEditOpen";
import { setAniSearchOpen } from "@store/isAniSearchOpen";
import InputNumber from "@ui/InputNumber";
import React, { useLayoutEffect, useState, memo } from "react";

const AnilistBar = memo(() => {
    const anilistTracking = useAppSelector((store) => store.anilistTracking);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);
    const anilistCurrentManga = useAppSelector((store) => store.anilistCurrentManga);
    const isAniEditOpen = useAppSelector((store) => store.isAniEditOpen);

    const [isTracking, setTracking] = useState(false);
    const [progress, setProgress] = useState(anilistCurrentManga?.progress || 0);
    const dispatch = useAppDispatch();

    useLayoutEffect(() => {
        if (mangaInReader && anilistTracking.find((e) => e.localURL === window.path.dirname(mangaInReader.link)))
            setTracking(true);
        else {
            setTracking(false);
            dispatch(setAniEditOpen(false));
        }
    }, [anilistTracking, mangaInReader]);
    useLayoutEffect(() => {
        setProgress(anilistCurrentManga?.progress || 0);
    }, [anilistCurrentManga]);
    useLayoutEffect(() => {
        const timeout = setTimeout(() => {
            anilistCurrentManga &&
                anilistCurrentManga.progress !== progress &&
                window.al.setCurrentMangaProgress(progress).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentManga(e));
                    } else {
                        window.dialog.customError({ message: "Failed to sync AniList progress.", log: false });
                        setProgress(anilistCurrentManga.progress);
                    }
                });
        }, 1000);
        return () => {
            clearTimeout(timeout);
        };
    }, [progress]);

    useLayoutEffect(() => {
        if (isTracking && mangaInReader) {
            const found = anilistTracking.find((e) => e.localURL === window.path.dirname(mangaInReader.link));
            if (found) {
                window.al.getMangaData(found.anilistMediaId).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentManga(e));
                    }
                });
            }
        }
    }, [isTracking, mangaInReader, isAniEditOpen]);

    return (
        <div className="anilistBar">
            <span className="bold">AniList</span>
            <span className="bold"> : </span>
            {isTracking ? (
                anilistCurrentManga ? (
                    <div className="btns">
                        <button onClick={() => setProgress((init) => init - 1)}>
                            <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <InputNumber
                            value={progress}
                            noSpin
                            min={0}
                            timeout={[2000, (value) => setProgress(value)]}
                        />
                        <button onClick={() => setProgress((init) => init + 1)}>
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <button data-tooltip="More Options" onClick={() => dispatch(setAniEditOpen(true))}>
                            <FontAwesomeIcon icon={faSlidersH} />
                        </button>
                    </div>
                ) : (
                    <span>Network Error</span>
                )
            ) : (
                <button onClick={() => dispatch(setAniSearchOpen(true))}>Track</button>
            )}
        </div>
    );
});

export default AnilistBar;
