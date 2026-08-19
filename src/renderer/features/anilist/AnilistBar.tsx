import { faMinus, faPlus, faSlidersH } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    cacheAnilistListEntry,
    selectAnilistTracker,
    setAnilistCurrentListEntry,
    setGalleryTrackContext,
} from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAnilistEditOpen, setAnilistSearchOpen } from "@store/ui";
import InputNumber from "@ui/InputNumber";
import { getAnilistListEntry, setAnilistListProgress } from "@utils/anilist";
import { dialogUtils } from "@utils/dialog";
import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type AnilistBarProps = {
    /** When set (e.g. gallery detail panel), tracking uses this path instead of the open reader item. */
    localLibraryLink?: string;
    libraryTitle?: string;
    /**
     * Layout of the tracking control. Gallery details uses `"compact"` so this bar
     * does not include progress steppers; search/edit still use the existing overlays.
     */
    variant?: "bar" | "compact";
};

const AnilistBar = memo((props: AnilistBarProps) => {
    const { t } = useTranslation("anilist");
    const { localLibraryLink, libraryTitle, variant = "bar" } = props;
    const readerLink = useAppSelector((store) => store.reader.content?.link);
    const trackLink = localLibraryLink ?? readerLink ?? undefined;
    const anilistTracker = useAppSelector((store) => selectAnilistTracker(store, trackLink));
    const anilistCurrentListEntry = useAppSelector((store) => store.anilist.currentListEntry);
    const isAniEditOpen = useAppSelector((store) => store.ui.isOpen.anilist.edit);

    const [isTracking, setTracking] = useState(false);
    const [progress, setProgress] = useState(anilistCurrentListEntry?.progress || 0);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (anilistTracker) setTracking(true);
        else {
            setTracking(false);
            dispatch(setAnilistEditOpen(false));
        }
    }, [anilistTracker, dispatch]);
    useEffect(() => {
        setProgress(anilistCurrentListEntry?.progress || 0);
    }, [anilistCurrentListEntry]);
    /* debounce: restart the timer only when the local progress value changes */
    // biome-ignore lint/correctness/useExhaustiveDependencies: debounce keyed on progress only
    useEffect(() => {
        const timeout = setTimeout(() => {
            anilistCurrentListEntry &&
                anilistCurrentListEntry.progress !== progress &&
                setAnilistListProgress(progress).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentListEntry(e));
                        if (trackLink) void dispatch(cacheAnilistListEntry({ itemLink: trackLink, data: e }));
                    } else {
                        dialogUtils.customError({ message: t("bar.syncFailed"), log: false });
                        setProgress(anilistCurrentListEntry.progress);
                    }
                });
        }, 1000);
        return () => {
            clearTimeout(timeout);
        };
    }, [progress]);

    /* refetch after the edit overlay closes; isAniEditOpen is a trigger, not a body read */
    // biome-ignore lint/correctness/useExhaustiveDependencies: refetch when the edit overlay closes
    useEffect(() => {
        if (!trackLink) return;
        if (isTracking) {
            if (anilistTracker) {
                getAnilistListEntry(Number(anilistTracker.remoteId)).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentListEntry(e));
                        void dispatch(cacheAnilistListEntry({ itemLink: trackLink, data: e }));
                    }
                });
            }
        } else {
            dispatch(setAnilistCurrentListEntry(null));
        }
    }, [isTracking, trackLink, isAniEditOpen, anilistTracker, dispatch]);

    const openAnilistFlow = useCallback(
        (mode: "search" | "edit") => {
            dispatch(setGalleryTrackContext(null));
            if (localLibraryLink) {
                dispatch(
                    setGalleryTrackContext({
                        link: localLibraryLink,
                        title: libraryTitle ?? "",
                    }),
                );
            }
            if (mode === "search") {
                dispatch(setAnilistSearchOpen(true));
            } else {
                dispatch(setAnilistEditOpen(true));
            }
        },
        [dispatch, libraryTitle, localLibraryLink],
    );

    if (variant === "compact") {
        return (
            <div className="anilistBar anilistBar--compact">
                {isTracking ? (
                    anilistCurrentListEntry ? (
                        <button type="button" onClick={() => openAnilistFlow("edit")}>
                            {t("bar.compactTracked", {
                                brand: t("bar.brand"),
                                progress,
                            })}
                        </button>
                    ) : (
                        <span>{t("bar.networkError")}</span>
                    )
                ) : (
                    <button type="button" onClick={() => openAnilistFlow("search")}>
                        {t("bar.track")}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="anilistBar">
            <span className="bold">{t("bar.brand")}</span>
            <span className="bold">{t("bar.separator")}</span>
            {isTracking ? (
                anilistCurrentListEntry ? (
                    <div className="btns">
                        <button type="button" onClick={() => setProgress((init) => init - 1)}>
                            <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <InputNumber
                            value={progress}
                            noSpin
                            min={0}
                            timeout={[2000, (value) => setProgress(value)]}
                        />
                        <button type="button" onClick={() => setProgress((init) => init + 1)}>
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <button
                            type="button"
                            data-tooltip={t("bar.moreOptions")}
                            onClick={() => openAnilistFlow("edit")}
                        >
                            <FontAwesomeIcon icon={faSlidersH} />
                        </button>
                    </div>
                ) : (
                    <span>{t("bar.networkError")}</span>
                )
            ) : (
                <button type="button" onClick={() => openAnilistFlow("search")}>
                    {t("bar.track")}
                </button>
            )}
        </div>
    );
});

AnilistBar.displayName = "AnilistBar";

export default AnilistBar;
