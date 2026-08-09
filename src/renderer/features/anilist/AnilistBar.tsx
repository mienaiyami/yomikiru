import { faMinus, faPlus, faSlidersH } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setAnilistCurrentManga, setGalleryTrackContext } from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAnilistEditOpen, setAnilistSearchOpen } from "@store/ui";
import InputNumber from "@ui/InputNumber";
import AniList from "@utils/anilist";
import { dialogUtils } from "@utils/dialog";
import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export type AnilistBarProps = {
    /** When set (e.g. gallery detail panel), tracking uses this path instead of the open reader item. */
    localLibraryLink?: string;
    libraryTitle?: string;
};

const AnilistBar = memo((props: AnilistBarProps) => {
    const { t } = useTranslation("anilist");
    const { localLibraryLink, libraryTitle } = props;
    const anilistTracking = useAppSelector((store) => store.anilist.tracking);
    const readerLink = useAppSelector((store) => store.reader.content?.link);
    const trackLink = localLibraryLink ?? readerLink ?? undefined;
    const anilistCurrentManga = useAppSelector((store) => store.anilist.currentManga);
    const isAniEditOpen = useAppSelector((store) => store.ui.isOpen.anilist.edit);

    const [isTracking, setTracking] = useState(false);
    const [progress, setProgress] = useState(anilistCurrentManga?.progress || 0);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (trackLink && anilistTracking.find((e) => e.localURL === trackLink)) setTracking(true);
        else {
            setTracking(false);
            dispatch(setAnilistEditOpen(false));
        }
    }, [anilistTracking, trackLink, dispatch]);
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
                        dialogUtils.customError({ message: t("bar.syncFailed"), log: false });
                        setProgress(anilistCurrentManga.progress);
                    }
                });
        }, 1000);
        return () => {
            clearTimeout(timeout);
        };
    }, [progress]);

    useEffect(() => {
        if (!trackLink) return;
        if (isTracking) {
            const found = anilistTracking.find((e) => e.localURL === trackLink);
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
    }, [isTracking, trackLink, isAniEditOpen, anilistTracking, dispatch]);

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

    return (
        <div className="anilistBar">
            <span className="bold">{t("bar.brand")}</span>
            <span className="bold">{t("bar.separator")}</span>
            {isTracking ? (
                anilistCurrentManga ? (
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
