import { faMinus, faPlus, faWrench } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useLayoutEffect, useState } from "react";
import InputNumber from "../Element/InputNumber";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAniSearchOpen } from "../../store/isAniSearchOpen";
import { setAnilistCurrentManga } from "../../store/anilistCurrentManga";
import { setAniEditOpen } from "../../store/isAniEditOpen";

const AnilistBar = () => {
    const anilistTracking = useAppSelector((store) => store.anilistTracking);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);
    const anilistCurrentManga = useAppSelector((store) => store.anilistCurrentManga);

    const [isTracking, setTracking] = useState(false);
    const dispatch = useAppDispatch();

    useLayoutEffect(() => {
        if (mangaInReader && anilistTracking.find((e) => e.localURL === window.path.dirname(mangaInReader.link)))
            setTracking(true);
    }, [anilistTracking, mangaInReader]);
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
    }, [isTracking]);

    const Tracking = () => {
        return (
            <div className="btns">
                <button>
                    <FontAwesomeIcon icon={faPlus} />
                </button>
                <InputNumber
                    value={anilistCurrentManga?.progress || 0}
                    className="noSpin"
                    onChange={(e) => {
                        let value = parseInt(e.currentTarget.value);
                        if (!value || value < 0) value = 0;
                        return value;
                    }}
                    // timeout={[1000,(value)=>]}
                />
                <button>
                    <FontAwesomeIcon icon={faMinus} />
                </button>
                <button data-tooltip="More Options" onClick={() => dispatch(setAniEditOpen(true))}>
                    <FontAwesomeIcon icon={faWrench} />
                </button>
            </div>
        );
    };
    return (
        <div className="anilistBar">
            <span className="bold">AniList</span>
            <span className="bold"> : </span>
            {isTracking ? <Tracking /> : <button onClick={() => dispatch(setAniSearchOpen(true))}>Track</button>}
        </div>
    );
};

export default AnilistBar;
