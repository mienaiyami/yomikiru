import { cacheAnilistListEntry, removeAnilistTracker, setAnilistCurrentListEntry } from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAnilistEditOpen } from "@store/ui";
import InputCheckbox from "@ui/InputCheckbox";
import InputNumber from "@ui/InputNumber";
import InputSelect from "@ui/InputSelect";
import Link from "@ui/Link";
import { anilistCoverImageSrc, setAnilistListEntry } from "@utils/anilist";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import FocusLock from "react-focus-lock";
import { useTranslation } from "react-i18next";

const AnilistEdit = () => {
    const { t } = useTranslation("anilist");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const contRef = useRef<HTMLDivElement>(null);
    const anilistCurrentListEntry = useAppSelector((store) => store.anilist.currentListEntry);
    /** Local path for AniList tracking: gallery context when opened from home, otherwise the open reader item. */
    const trackLocalLink = useAppSelector(
        (store) => store.anilist.galleryTrackContext?.link ?? store.reader.content?.link,
    );

    const [tempData, setTempData] = useState(anilistCurrentListEntry);
    const editCoverSrc = tempData ? anilistCoverImageSrc(tempData.media.coverImage) : null;

    const statusLabel = (status: Anilist.ListEntry["status"]): string => {
        switch (status) {
            case "CURRENT":
                return t("edit.statusReading");
            case "PLANNING":
                return t("edit.statusPlanToRead");
            case "COMPLETED":
                return t("edit.statusCompleted");
            case "DROPPED":
                return t("edit.statusDropped");
            case "PAUSED":
                return t("edit.statusPaused");
            case "REPEATING":
                return t("edit.statusRepeating");
            default:
                return status;
        }
    };

    useEffect(() => {
        setTimeout(() => {
            if (contRef.current) contRef.current.focus();
        }, 500);
    }, []);

    useLayoutEffect(() => {
        setTempData(anilistCurrentListEntry);
    }, [anilistCurrentListEntry]);

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
                                    {editCoverSrc ? (
                                        <img src={editCoverSrc} alt={t("edit.coverAlt")} draggable={false} />
                                    ) : null}
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
                                            label: statusLabel(e as Anilist.ListEntry["status"]),
                                            value: e,
                                            style: { textAlign: "center" },
                                        }))}
                                        value={tempData.status}
                                        onChange={(value) => {
                                            setTempData((init) => {
                                                if (init)
                                                    return {
                                                        ...init,
                                                        status: value as Anilist.ListEntry["status"],
                                                    };
                                                return null;
                                            });
                                        }}
                                        labeled
                                        labelBefore={t("edit.status")}
                                        className="noBG"
                                    />
                                </div>
                                <div>
                                    <InputNumber
                                        value={tempData.progress}
                                        labelBefore={t("edit.chapters")}
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
                                        labelBefore={t("edit.volumes")}
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
                                        labelBefore={t("edit.score")}
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
                                        {t("edit.startDate")}
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
                                        {t("edit.finishDate")}
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
                                        labelBefore={t("edit.repeat")}
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
                                        labelAfter={t("edit.private")}
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
                                            if (!tempData) return;
                                            const target = e.currentTarget;
                                            const oldText = target.innerText;
                                            target.innerText = t("edit.saving");
                                            setAnilistListEntry(tempData).then((result) => {
                                                if (result) {
                                                    dispatch(setAnilistCurrentListEntry(result));
                                                    if (trackLocalLink)
                                                        void dispatch(
                                                            cacheAnilistListEntry({
                                                                itemLink: trackLocalLink,
                                                                data: result,
                                                            }),
                                                        );
                                                    target.innerText = t("edit.saved");
                                                } else {
                                                    target.innerText = t("edit.failed");
                                                }
                                                setTimeout(() => {
                                                    target.innerText = oldText;
                                                }, 1500);
                                            });
                                        }}
                                    >
                                        {tCommon("actions.save")}
                                    </button>
                                </div>
                                <div className="last">
                                    <button
                                        onClick={() =>
                                            trackLocalLink && dispatch(removeAnilistTracker(trackLocalLink))
                                        }
                                        title={t("edit.untrackTitle")}
                                    >
                                        {t("edit.untrack")}
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
