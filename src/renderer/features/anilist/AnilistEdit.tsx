import { removeAnilistTracker, setAnilistCurrentManga } from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getReaderManga } from "@store/reader";
import { setAnilistEditOpen } from "@store/ui";
import InputCheckbox from "@ui/InputCheckbox";
import InputNumber from "@ui/InputNumber";
import InputSelect from "@ui/InputSelect";
import Link from "@ui/Link";
import AniList from "@utils/anilist";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import FocusLock from "react-focus-lock";

const betterStatus = {
    CURRENT: "Reading",
    PLANNING: "Plan to Read",
    COMPLETED: "Completed",
    DROPPED: "Dropped",
    PAUSED: "Paused",
    REPEATING: "Repeating",
};

const AnilistEdit = () => {
    const dispatch = useAppDispatch();
    const contRef = useRef<HTMLDivElement>(null);
    const anilistCurrentManga = useAppSelector((store) => store.anilist.currentManga);
    const mangaInReader = useAppSelector(getReaderManga);

    const [tempData, setTempData] = useState(anilistCurrentManga);

    useEffect(() => {
        setTimeout(() => {
            if (contRef.current) contRef.current.focus();
        }, 500);
    }, []);

    useLayoutEffect(() => {
        setTempData(anilistCurrentManga);
    }, [anilistCurrentManga]);

    return (
        <FocusLock>
            <div
                id="anilistEdit"
                data-state="closed"
                ref={(node) => {
                    if (node) {
                        setTimeout(() => {
                            if (node) node.setAttribute("data-state", "open");
                        }, 100);
                    }
                }}
            >
                <div className="clickClose" onClick={() => dispatch(setAnilistEditOpen(false))}></div>
                <div
                    className="overlayCont"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") dispatch(setAnilistEditOpen(false));
                    }}
                    tabIndex={-1}
                    ref={contRef}
                >
                    {tempData && (
                        <>
                            <span
                                className="banner"
                                style={{
                                    backgroundImage: `linear-gradient(0,var(--body-bg-color), transparent) , url('${tempData?.media.bannerImage}')`,
                                }}
                            ></span>
                            <div className="info">
                                <div className="cover">
                                    <img src={tempData.media.coverImage.medium} alt="Cover" draggable={false} />
                                </div>
                                <div className="col">
                                    <span>
                                        {tempData.media.title.english ||
                                            tempData.media.title.romaji ||
                                            tempData.media.title.native}
                                    </span>
                                    <span>{tempData.media.title.romaji || "~"}</span>
                                    <span>{tempData.media.title.native || "~"}</span>
                                    <span>
                                        <Link href={tempData.media.siteUrl}>{tempData.media.siteUrl}</Link>
                                    </span>
                                </div>
                                {/* <div className="col">
                            </div> */}
                            </div>
                            <div className="data">
                                <div>
                                    <InputSelect
                                        options={[
                                            "CURRENT",
                                            "PLANNING",
                                            "COMPLETED",
                                            "DROPPED",
                                            "PAUSED",
                                            "REPEATING",
                                        ].map((e) => ({
                                            label: betterStatus[e as Anilist.MangaData["status"]],
                                            value: e,
                                            style: { textAlign: "center" },
                                        }))}
                                        value={tempData.status}
                                        onChange={(value) => {
                                            setTempData((init) => {
                                                if (init)
                                                    return {
                                                        ...init,
                                                        status: value as Anilist.MangaData["status"],
                                                    };
                                                return null;
                                            });
                                        }}
                                        labeled
                                        labelBefore="Status"
                                        className="noBG"
                                    />
                                </div>
                                <div>
                                    <InputNumber
                                        value={tempData.progress}
                                        labelBefore="Chapters"
                                        className="noBG"
                                        min={0}
                                        max={20000}
                                        onChange={(e) => {
                                            const value = e.valueAsNumber;
                                            setTempData((init) => {
                                                if (init) return { ...init, progress: value };
                                                return null;
                                            });
                                        }}
                                    />
                                </div>
                                <div>
                                    <InputNumber
                                        value={tempData.progressVolumes}
                                        labelBefore="Volumes"
                                        className="noBG"
                                        min={0}
                                        max={20000}
                                        onChange={(e) => {
                                            const value = e.valueAsNumber;
                                            setTempData((init) => {
                                                if (init) return { ...init, progressVolumes: value };
                                                return null;
                                            });
                                        }}
                                    />
                                </div>
                                <div>
                                    <InputNumber
                                        value={tempData.score}
                                        labelBefore="Score"
                                        className="noBG"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        onChange={(e) => {
                                            const value = e.valueAsNumber;
                                            setTempData((init) => {
                                                if (init) return { ...init, score: value };
                                                return null;
                                            });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="noBG">
                                        Start Date
                                        <input
                                            type="date"
                                            value={
                                                !tempData.startedAt.year
                                                    ? ""
                                                    : `${tempData.startedAt.year}-${tempData.startedAt.month
                                                          ?.toString()
                                                          .padStart(2, "0")}-${tempData.startedAt.day
                                                          ?.toString()
                                                          .padStart(2, "0")}`
                                            }
                                            min="1997-01-01"
                                            onChange={(e) => {
                                                const value = e.currentTarget.valueAsDate;
                                                setTempData((init) => {
                                                    if (init)
                                                        return {
                                                            ...init,
                                                            startedAt: {
                                                                year: value ? value.getUTCFullYear() : null,
                                                                month: value ? value.getUTCMonth() + 1 : null,
                                                                day: value ? value.getUTCDate() : null,
                                                            },
                                                        };
                                                    return null;
                                                });
                                            }}
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label className="noBG">
                                        Finish Date
                                        <input
                                            type="date"
                                            value={
                                                !tempData.completedAt.year
                                                    ? ""
                                                    : `${tempData.completedAt.year}-${tempData.completedAt.month
                                                          ?.toString()
                                                          .padStart(2, "0")}-${tempData.completedAt.day
                                                          ?.toString()
                                                          .padStart(2, "0")}`
                                            }
                                            min="1997-01-01"
                                            onChange={(e) => {
                                                const value = e.currentTarget.valueAsDate;
                                                setTempData((init) => {
                                                    if (init)
                                                        return {
                                                            ...init,
                                                            completedAt: {
                                                                year: value ? value.getUTCFullYear() : null,
                                                                month: value ? value.getUTCMonth() + 1 : null,
                                                                day: value ? value.getUTCDate() : null,
                                                            },
                                                        };
                                                    return null;
                                                });
                                            }}
                                        />
                                    </label>
                                </div>

                                <div>
                                    <InputNumber
                                        value={tempData.repeat}
                                        labelBefore="Repeat"
                                        className="noBG"
                                        min={0}
                                        max={1000}
                                        onChange={(e) => {
                                            const value = e.valueAsNumber;
                                            setTempData((init) => {
                                                if (init) return { ...init, repeat: value };
                                                return null;
                                            });
                                        }}
                                    />
                                </div>
                                <div>
                                    <InputCheckbox
                                        checked={tempData.private}
                                        labelAfter="Private"
                                        onChange={(e) => {
                                            const value = e.currentTarget.checked;
                                            setTempData((init) => {
                                                if (init)
                                                    return {
                                                        ...init,
                                                        private: value,
                                                    };
                                                return null;
                                            });
                                        }}
                                    />
                                </div>
                                <div></div>
                                <div className="last">
                                    <button
                                        onClick={(e) => {
                                            const target = e.currentTarget;
                                            const oldText = target.innerText;
                                            target.innerText = "Saving...";
                                            AniList.setCurrentMangaData(tempData).then((e) => {
                                                if (e) {
                                                    dispatch(setAnilistCurrentManga(e));
                                                    target.innerText = "Saved!";
                                                } else {
                                                    target.innerText = "Failed!";
                                                }
                                                setTimeout(() => {
                                                    target.innerText = oldText;
                                                }, 1500);
                                            });
                                        }}
                                    >
                                        Save
                                    </button>
                                </div>
                                <div className="last">
                                    <button
                                        onClick={() =>
                                            mangaInReader &&
                                            dispatch(removeAnilistTracker(window.path.dirname(mangaInReader.link)))
                                        }
                                        title="This only remove tracking locally. Anilist entry is not deleted."
                                    >
                                        Untrack
                                    </button>
                                </div>
                                <div></div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </FocusLock>
    );
};

export default AnilistEdit;
