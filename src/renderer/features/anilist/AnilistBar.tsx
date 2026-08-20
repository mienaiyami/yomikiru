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

    const hasTracker = Boolean(anilistTracker);
    const remoteId = anilistTracker?.remoteId;
    /* session list entry is shared; only show it when it belongs to this remote id */
    const listEntry =
        anilistCurrentListEntry && remoteId && String(anilistCurrentListEntry.mediaId) === String(remoteId)
            ? anilistCurrentListEntry
            : null;
    const listFetchKey = trackLink && remoteId ? `${trackLink}:${remoteId}` : "";
    const cachedProgress = anilistTracker?.listState?.progress;

    const [progress, setProgress] = useState(listEntry?.progress || 0);
    const [retryTick, setRetryTick] = useState(0);
    /* miss is keyed to this item so a previous error does not flash on the next title */
    const [failedKey, setFailedKey] = useState<string | null>(null);
    const fetchFailed = Boolean(listFetchKey) && failedKey === listFetchKey;
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (!hasTracker) dispatch(setAnilistEditOpen(false));
    }, [hasTracker, dispatch]);
    useEffect(() => {
        setProgress(listEntry?.progress || 0);
    }, [listEntry]);
    /* debounce: restart the timer only when the local progress value changes */
    // biome-ignore lint/correctness/useExhaustiveDependencies: debounce keyed on progress only
    useEffect(() => {
        const timeout = setTimeout(() => {
            listEntry &&
                listEntry.progress !== progress &&
                setAnilistListProgress(progress).then((e) => {
                    if (e) {
                        dispatch(setAnilistCurrentListEntry(e));
                        if (trackLink) void dispatch(cacheAnilistListEntry({ itemLink: trackLink, data: e }));
                    } else {
                        dialogUtils.customError({ message: t("bar.syncFailed"), log: false });
                        setProgress(listEntry.progress);
                    }
                });
        }, 1000);
        return () => {
            clearTimeout(timeout);
        };
    }, [progress]);

    /* refetch when tracking starts, the remote id changes, or the edit overlay toggles; not on cache writes */
    // biome-ignore lint/correctness/useExhaustiveDependencies: refetch when the edit overlay closes
    useEffect(() => {
        if (!trackLink) return;
        if (!hasTracker || !remoteId) {
            dispatch(setAnilistCurrentListEntry(null));
            return;
        }
        let cancelled = false;
        setFailedKey((prev) => (prev === listFetchKey ? null : prev));
        void getAnilistListEntry(Number(remoteId)).then((entry) => {
            if (cancelled) return;
            if (entry) {
                dispatch(setAnilistCurrentListEntry(entry));
                void dispatch(cacheAnilistListEntry({ itemLink: trackLink, data: entry }));
                return;
            }
            setFailedKey(listFetchKey);
        });
        return () => {
            cancelled = true;
        };
    }, [hasTracker, trackLink, isAniEditOpen, remoteId, listFetchKey, retryTick, dispatch]);

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

    const retryControl = (
        <button
            type="button"
            className="anilistBar-retry"
            onClick={() => setRetryTick((n) => n + 1)}
            data-tooltip={t("bar.retry")}
        >
            {t("bar.networkError")}
        </button>
    );

    const compactPending = (
        <button type="button" disabled aria-busy="true">
            {cachedProgress != null
                ? t("bar.compactTracked", { brand: t("bar.brand"), progress: cachedProgress })
                : t("bar.brand")}
        </button>
    );

    if (variant === "compact") {
        return (
            <div className="anilistBar anilistBar--compact">
                {hasTracker ? (
                    listEntry ? (
                        <button type="button" onClick={() => openAnilistFlow("edit")}>
                            {t("bar.compactTracked", {
                                brand: t("bar.brand"),
                                progress,
                            })}
                        </button>
                    ) : fetchFailed ? (
                        retryControl
                    ) : (
                        compactPending
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
            {hasTracker ? (
                listEntry ? (
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
                ) : fetchFailed ? (
                    retryControl
                ) : null
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
