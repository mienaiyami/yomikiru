import React, { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAniEditOpen } from "../../store/isAniEditOpen";
import { InputSelect } from "../Element/InputSelect";
import InputNumber from "../Element/InputNumber";
const AnilistEdit = () => {
    const dispatch = useAppDispatch();
    const contRef = useRef<HTMLDivElement>(null);
    const anilistCurrentManga = useAppSelector((store) => store.anilistCurrentManga);

    useEffect(() => {
        setTimeout(() => {
            if (contRef.current) contRef.current.focus();
        }, 500);
    }, []);

    return (
        <div id="anilistEdit">
            <div className="clickClose" onClick={() => dispatch(setAniEditOpen(false))}></div>
            <div
                className="cont"
                onKeyDown={(e) => {
                    if (e.key === "Escape") dispatch(setAniEditOpen(false));
                }}
                tabIndex={-1}
                ref={contRef}
            >
                {anilistCurrentManga && (
                    <>
                        <div
                            className="info"
                            style={{
                                backgroundImage: `linear-gradient(0,var(--body-bg-color), transparent) , url('${anilistCurrentManga?.media.bannerImage}')`,
                            }}
                        >
                            <div className="cover">
                                <img
                                    src={anilistCurrentManga.media.coverImage.medium}
                                    alt="Cover"
                                    draggable={false}
                                />
                            </div>
                            <div className="col">
                                <span>
                                    {anilistCurrentManga.media.title.english ||
                                        anilistCurrentManga.media.title.romaji ||
                                        anilistCurrentManga.media.title.native}
                                </span>
                                <span>{anilistCurrentManga.media.title.romaji || "~"}</span>
                                <span>{anilistCurrentManga.media.title.native || "~"}</span>
                                <span>
                                    <a
                                        onClick={() => {
                                            window.electron.shell.openExternal(anilistCurrentManga.media.siteUrl);
                                        }}
                                    >
                                        {anilistCurrentManga.media.siteUrl}
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
                                    value={anilistCurrentManga.status}
                                    labeled
                                    labelBefore="Status"
                                    className="noBG"
                                />
                            </div>
                            <div>
                                <InputNumber
                                    value={anilistCurrentManga.progress}
                                    labeled
                                    labelBefore="Progress"
                                    className="noBG"
                                />
                            </div>
                            <div>
                                <InputNumber
                                    value={anilistCurrentManga.score}
                                    labeled
                                    labelBefore="Score"
                                    className="noBG"
                                />
                            </div>
                            <div>
                                <button>Save</button>
                            </div>

                            <div>
                                <label className="noBG">
                                    Start Date
                                    <input
                                        type="date"
                                        value={`${anilistCurrentManga.startedAt.year}-${anilistCurrentManga.startedAt.month}-${anilistCurrentManga.startedAt.day}`}
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="noBG">
                                    Finish Date
                                    <input
                                        type="date"
                                        value={`${anilistCurrentManga.completedAt.year}-${anilistCurrentManga.completedAt.month}-${anilistCurrentManga.completedAt.day}`}
                                    />
                                </label>
                            </div>
                            <div>
                                <InputNumber
                                    value={anilistCurrentManga.repeat}
                                    labeled
                                    labelBefore="Repeat"
                                    className="noBG"
                                />
                            </div>
                            <div>
                                <button>Untrack</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AnilistEdit;
