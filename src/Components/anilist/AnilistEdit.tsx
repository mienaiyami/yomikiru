import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAniEditOpen } from "../../store/isAniEditOpen";
import { InputSelect } from "../Element/InputSelect";
import InputNumber from "../Element/InputNumber";
import { removeAnilistTracker } from "../../store/anilistTracking";
import { setAnilistCurrentManga } from "../../store/anilistCurrentManga";
import { target } from "../../../webpack/renderer.webpack";
const AnilistEdit = () => {
    const dispatch = useAppDispatch();
    const contRef = useRef<HTMLDivElement>(null);
    const anilistCurrentManga = useAppSelector((store) => store.anilistCurrentManga);
    const mangaInReader = useAppSelector((store) => store.mangaInReader);

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
            <div className="clickClose" onClick={() => dispatch(setAniEditOpen(false))}></div>
            <div
                className="cont"
                onKeyDown={(e) => {
                    if (e.key === "Escape") dispatch(setAniEditOpen(false));
                }}
                tabIndex={-1}
                ref={contRef}
            >
                {tempData && (
                    <>
                        <div
                            className="info"
                            style={{
                                backgroundImage: `linear-gradient(0,var(--body-bg-color), transparent) , url('${tempData?.media.bannerImage}')`,
                            }}
                        >
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
                                    <a
                                        onClick={() => {
                                            window.electron.shell.openExternal(tempData.media.siteUrl);
                                        }}
                                    >
                                        {tempData.media.siteUrl}
                                    </a>
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
                                    ]}
                                    value={tempData.status}
                                    onChange={(e) => {
                                        const value = e.currentTarget.value as AniListMangaData["status"];
                                        setTempData((init) => {
                                            if (init) return { ...init, status: value };
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
                                    labelBefore="Progress"
                                    className="noBG"
                                    min={0}
                                    max={20000}
                                    onChange={(e) => {
                                        let value = e.valueAsNumber;
                                        if (!value) value = 0;
                                        if (value < 0) value = 0;
                                        if (value > 20000) value = 20000;
                                        setTempData((init) => {
                                            if (init) return { ...init, progress: value };
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
                                        let value = e.valueAsNumber;
                                        if (!value) value = 0;
                                        if (value < 0) value = 0;
                                        if (value > 10) value = 10;
                                        setTempData((init) => {
                                            if (init) return { ...init, score: value };
                                            return null;
                                        });
                                    }}
                                />
                            </div>
                            <div>
                                <button
                                    onClick={(e) => {
                                        const target = e.currentTarget;
                                        const oldText = target.innerText;
                                        target.innerText = "Saving...";
                                        window.al.setCurrentMangaData(tempData).then((e) => {
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
                                        let value = e.valueAsNumber;
                                        if (!value) value = 0;
                                        if (value < 0) value = 0;
                                        if (value > 1000) value = 1000;
                                        setTempData((init) => {
                                            if (init) return { ...init, repeat: value };
                                            return null;
                                        });
                                    }}
                                />
                            </div>
                            <div>
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
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AnilistEdit;
