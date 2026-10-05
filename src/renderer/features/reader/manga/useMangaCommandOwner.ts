import type { InvokeContext } from "@features/keybindings";
import { useCommandOwner } from "@features/keybindings";
import { clampReaderWidth, cycleFitOption } from "@features/reader/readerCommandOps";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectLiveMangaReaderSettings } from "@store/reader";
import {
    cyclePresetNext,
    cyclePresetPrev,
    patchLiveMangaReaderSettings,
    selectPresetSlot,
} from "@store/readerPresets";
import type { MangaFitOption, MangaPagesPerRow } from "@utils/readerSettingsSchema";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

/** Owner id for the active manga reader; child owners nest under this. */
export const MANGA_READER_OWNER_ID = "manga-reader";
/** Reader-settings panel dismissal owner. */
export const MANGA_READER_PANEL_OWNER_ID = "manga-reader-panel";
/*
 * Child command owners below implement their own commands. Reader pointer and
 * page-edge paths call them with `executeCommand(commandId, ownerId)` instead
 * of holding the child's functions.
 */
/** Size, save-preset, and panel-toggle commands owned by manga reader settings. */
export const MANGA_READER_SETTINGS_OWNER_ID = "manga-reader-settings";
/** Next / previous / random chapter commands owned by the manga side list. */
export const MANGA_SIDE_LIST_OWNER_ID = "manga-side-list";
/** Bookmark command owned by the manga side-list bookmark button. */
export const MANGA_BOOKMARK_OWNER_ID = "manga-bookmark";

const READER_SIZE_PERCENTS = [50, 100, 150, 200, 250] as const;

/** HUD key for each {@link MangaFitOption}. */
const FIT_HUD_KEY = {
    0: "hud.free",
    1: "hud.fitVertically",
    2: "hud.fitHorizontally",
    3: "hud.originalRatio",
} as const satisfies Record<MangaFitOption, string>;

type UseMangaCommandOwnerArgs = {
    visible: boolean;
    readerRef: RefObject<HTMLDivElement | null>;
    imgContRef: RefObject<HTMLDivElement | null>;
    pageNumberInputRef: RefObject<HTMLInputElement | null>;
    openNextPage: (ctx: InvokeContext) => void;
    openPrevPage: (ctx: InvokeContext) => void;
    /** Runs the side list's next/prev chapter command (vertical near-edge page keys). */
    openSiblingChapter: (direction: "next" | "prev") => void;
    /** 1/2 = vertical near-edge chapter change; 3 = LTR/RTL page step. */
    prevNextDeciderLogic: () => 1 | 2 | 3 | undefined;
    setZenMode: Dispatch<SetStateAction<boolean>>;
    setShortcutText: Dispatch<SetStateAction<string>>;
    makeScrollPos: () => void;
    startHeldScroll: (intensity: number) => void;
    stopHeldScroll: () => void;
};

/**
 * Manga reader command owner for commands whose state lives in {@link Reader}
 * or the reader settings store. Chapter, bookmark, size, and panel commands
 * are registered by the side list and settings components that own them.
 */
export const useMangaCommandOwner = ({
    visible,
    readerRef,
    imgContRef,
    pageNumberInputRef,
    openNextPage,
    openPrevPage,
    openSiblingChapter,
    prevNextDeciderLogic,
    setZenMode,
    setShortcutText,
    makeScrollPos,
    startHeldScroll,
    stopHeldScroll,
}: UseMangaCommandOwnerArgs): void => {
    const { t } = useTranslation("reader");
    const dispatch = useAppDispatch();
    const readerSettings = useAppSelector(selectLiveMangaReaderSettings);

    const applyFit = (reverse: boolean) => {
        const fitOption = cycleFitOption(readerSettings.fitOption, reverse);
        setShortcutText(t(FIT_HUD_KEY[fitOption]));
        dispatch(patchLiveMangaReaderSettings({ fitOption }));
    };

    const applyReaderSizePercent = (readerWidth: number) => {
        makeScrollPos();
        dispatch(
            patchLiveMangaReaderSettings({
                ...(readerWidth > 100 ? { widthClamped: false } : {}),
                fitOption: 0,
                readerWidth,
            }),
        );
        setShortcutText(`${readerWidth}%`);
    };

    const applyPagesPerRow = (
        pagesPerRowSelected: MangaPagesPerRow,
        hudKey: "hud.pagePerRow1" | "hud.pagePerRow2" | "hud.pagePerRow2odd",
    ) => {
        let readerWidth = readerSettings.readerWidth;
        if (pagesPerRowSelected === 0) {
            readerWidth = clampReaderWidth(readerWidth / 2, readerSettings.widthClamped);
        } else if (readerSettings.pagesPerRowSelected === 0) {
            readerWidth = clampReaderWidth(readerWidth * 2, readerSettings.widthClamped);
        }
        setShortcutText(t(hudKey));
        dispatch(patchLiveMangaReaderSettings({ pagesPerRowSelected, readerWidth }));
    };

    useCommandOwner({
        ownerId: MANGA_READER_OWNER_ID,
        contextKinds: ["mangaReader"],
        visible,
        focusRoot: () => readerRef.current,
        handlers: {
            nextPage: (ctx) => {
                const edge = prevNextDeciderLogic();
                if (edge === 1 || edge === 2) {
                    openSiblingChapter("next");
                    return;
                }
                if (edge === 3) {
                    if (readerSettings.readerTypeSelected === 1) openNextPage(ctx);
                    if (readerSettings.readerTypeSelected === 2) openPrevPage(ctx);
                }
            },
            prevPage: (ctx) => {
                const edge = prevNextDeciderLogic();
                if (edge === 1 || edge === 2) {
                    openSiblingChapter("prev");
                    return;
                }
                if (edge === 3) {
                    if (readerSettings.readerTypeSelected === 2) openNextPage(ctx);
                    if (readerSettings.readerTypeSelected === 1) openPrevPage(ctx);
                }
            },
            navToPage: () => {
                pageNumberInputRef.current?.focus();
            },
            toggleZenMode: () => {
                setZenMode((prev) => !prev);
            },
            showHidePageNumberInZen: () => {
                setShortcutText(
                    readerSettings.showPageNumberInZenMode
                        ? t("hud.hidePageNumberInZen")
                        : t("hud.showPageNumberInZen"),
                );
                dispatch(
                    patchLiveMangaReaderSettings({
                        showPageNumberInZenMode: !readerSettings.showPageNumberInZenMode,
                    }),
                );
            },
            cycleFitOptions: () => {
                applyFit(false);
            },
            cycleFitOptionsReverse: () => {
                applyFit(true);
            },
            selectReaderMode0: () => {
                setShortcutText(t("hud.readingModeVertical"));
                dispatch(patchLiveMangaReaderSettings({ readerTypeSelected: 0 }));
            },
            selectReaderMode1: () => {
                setShortcutText(t("hud.readingModeLtr"));
                dispatch(patchLiveMangaReaderSettings({ readerTypeSelected: 1 }));
            },
            selectReaderMode2: () => {
                setShortcutText(t("hud.readingModeRtl"));
                dispatch(patchLiveMangaReaderSettings({ readerTypeSelected: 2 }));
            },
            selectPagePerRow1: () => {
                if (readerSettings.pagesPerRowSelected === 0) return;
                applyPagesPerRow(0, "hud.pagePerRow1");
            },
            selectPagePerRow2: () => {
                applyPagesPerRow(1, "hud.pagePerRow2");
            },
            selectPagePerRow2odd: () => {
                applyPagesPerRow(2, "hud.pagePerRow2odd");
            },
            cyclePresetNext: () => {
                const name = dispatch(cyclePresetNext("manga"));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            cyclePresetPrev: () => {
                const name = dispatch(cyclePresetPrev("manga"));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset1: () => {
                const name = dispatch(selectPresetSlot("manga", 0));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset2: () => {
                const name = dispatch(selectPresetSlot("manga", 1));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset3: () => {
                const name = dispatch(selectPresetSlot("manga", 2));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset4: () => {
                const name = dispatch(selectPresetSlot("manga", 3));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset5: () => {
                const name = dispatch(selectPresetSlot("manga", 4));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            readerSize_50: () => {
                applyReaderSizePercent(READER_SIZE_PERCENTS[0]);
            },
            readerSize_100: () => {
                applyReaderSizePercent(READER_SIZE_PERCENTS[1]);
            },
            readerSize_150: () => {
                applyReaderSizePercent(READER_SIZE_PERCENTS[2]);
            },
            readerSize_200: () => {
                applyReaderSizePercent(READER_SIZE_PERCENTS[3]);
            },
            readerSize_250: () => {
                applyReaderSizePercent(READER_SIZE_PERCENTS[4]);
            },
            contextMenu: () => {
                if (!imgContRef.current) return;
                imgContRef.current.dispatchEvent(
                    window.contextMenu.fakeEvent(
                        { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                        readerRef.current,
                    ),
                );
            },
        },
        heldHandlers: {
            largeScroll: {
                start: () => startHeldScroll(readerSettings.scrollSpeedB),
                stop: stopHeldScroll,
            },
            largeScrollReverse: {
                start: () => startHeldScroll(-readerSettings.scrollSpeedB),
                stop: stopHeldScroll,
            },
            scrollDown: {
                start: () => startHeldScroll(readerSettings.scrollSpeedA),
                stop: stopHeldScroll,
            },
            scrollUp: {
                start: () => startHeldScroll(-readerSettings.scrollSpeedA),
                stop: stopHeldScroll,
            },
        },
        onEscape: () => {
            setZenMode(false);
            return true;
        },
    });
};
