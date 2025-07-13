import { faMinus, faPlus, faSlidersH } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { dialogUtils } from "@utils/dialog";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import InputNumber from "@ui/InputNumber";
import React, { useLayoutEffect, useState, memo, useEffect } from "react";
import AniList from "@utils/anilist";
import { setAnilistCurrentManga } from "@store/anilist";
import { setAnilistEditOpen, setAnilistSearchOpen } from "@store/ui";

const AnilistBar = memo(() => {
    const anilistTracking = useAppSelector((store) => store.anilist.tracking);
    const mangaInReader = useAppSelector((store) => store.reader.content?.link);
    const anilistCurrentManga = useAppSelector((store) => store.anilist.currentManga);
    const isAniEditOpen = useAppSelector((store) => store.ui.isOpen.anilist.edit);

    const [isTracking, setTracking] = useState(false);
    const [progress, setProgress] = useState(anilistCurrentManga?.progress || 0);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (mangaInReader && anilistTracking.find((e) => e.localURL === mangaInReader)) setTracking(true);
        else {
            setTracking(false);
            dispatch(setAnilistEditOpen(false));
        }
    }, [anilistTracking, mangaInReader]);
    useEffect(() => {
        setProgress(anilistCurrentManga?.progress || 0);
    }, [anilistCurrentManga]);
    useEffect(() => {
        const timeout = setTimeout(() => {
            anilistCurrentManga &&
                anilistCurrentManga.progress !== progress &&
                AniList.setCurrentMangaProgress(progress).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentManga(e));
                    } else {
                        dialogUtils.customError({ message: "Failed to sync AniList progress.", log: false });
                        setProgress(anilistCurrentManga.progress);
                    }
                });
        }, 1000);
        return () => {
            clearTimeout(timeout);
        };
    }, [progress]);

    useEffect(() => {
        if (!mangaInReader) return;
        if (isTracking) {
            const found = anilistTracking.find((e) => e.localURL === mangaInReader);
            if (found) {
                AniList.getMangaData(found.anilistMediaId).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentManga(e));
                    }
                });
            }
        } else {
            dispatch(setAnilistCurrentManga(null));
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
                        <button data-tooltip="More Options" onClick={() => dispatch(setAnilistEditOpen(true))}>
                            <FontAwesomeIcon icon={faSlidersH} />
                        </button>
                    </div>
                ) : (
                    <span>Network Error</span>
                )
            ) : (
                <button onClick={() => dispatch(setAnilistSearchOpen(true))}>Track</button>
            )}
        </div>
    );
});

AnilistBar.displayName = "AnilistBar";

export default AnilistBar;
