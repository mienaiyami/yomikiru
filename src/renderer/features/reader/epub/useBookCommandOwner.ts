import type { InvokeContext } from "@features/keybindings";
import { useCommandOwner } from "@features/keybindings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectLiveBookReaderSettings } from "@store/reader";
import {
    cyclePresetNext,
    cyclePresetPrev,
    patchLiveBookReaderSettings,
    selectPresetSlot,
} from "@store/readerPresets";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

/** Owner id for the active book reader; child owners nest under this. */
export const BOOK_READER_OWNER_ID = "book-reader";
/** Book reader-settings panel dismissal owner. */
export const BOOK_READER_PANEL_OWNER_ID = "book-reader-panel";
/*
 * Child command owners below implement their own commands. Book reader pointer
 * and context-menu paths call them with `executeCommand(commandId, ownerId)`.
 */
/** Size, font-size, save-preset, and panel-toggle commands owned by book reader settings. */
export const BOOK_READER_SETTINGS_OWNER_ID = "book-reader-settings";
/** Bookmark command owned by the book side-list bookmark button. */
export const BOOK_BOOKMARK_OWNER_ID = "book-bookmark";

type UseBookCommandOwnerArgs = {
    visible: boolean;
    readerRef: RefObject<HTMLDivElement | null>;
    mainRef: RefObject<HTMLElement | null>;
    openNextChapter: () => void;
    openPrevChapter: () => void;
    /** True near the chapter start/end so page commands can switch chapter. */
    atChapterEdge: () => boolean;
    isContinuousScroll: boolean;
    toggleZenMode: () => void;
    holdReadingPlace: () => void;
    setZenMode: Dispatch<SetStateAction<boolean>>;
    setShortcutText: Dispatch<SetStateAction<string>>;
    startHeldScroll: (intensity: number) => void;
    stopHeldScroll: () => void;
};

/**
 * Book reader command owner for commands whose state lives in {@link EPubReader}
 * or the reader settings store. Page keys are one-shot at chapter edges and do
 * not switch chapter while continuous scroll is on. Bookmark, size, font, and
 * panel commands are registered by the components that own them.
 */
export const useBookCommandOwner = ({
    visible,
    readerRef,
    mainRef,
    openNextChapter,
    openPrevChapter,
    atChapterEdge,
    isContinuousScroll,
    toggleZenMode,
    holdReadingPlace,
    setZenMode,
    setShortcutText,
    startHeldScroll,
    stopHeldScroll,
}: UseBookCommandOwnerArgs): void => {
    const { t } = useTranslation("reader");
    const dispatch = useAppDispatch();
    const bookReaderSettings = useAppSelector(selectLiveBookReaderSettings);

    const handlePageCommand = (ctx: InvokeContext, direction: "next" | "prev") => {
        if (ctx.repeat) return;
        if (isContinuousScroll) return;
        if (!atChapterEdge()) return;
        if (direction === "next") openNextChapter();
        else openPrevChapter();
    };

    useCommandOwner({
        ownerId: BOOK_READER_OWNER_ID,
        contextKinds: ["bookReader"],
        visible,
        focusRoot: () => readerRef.current,
        handlers: {
            nextPage: (ctx) => {
                handlePageCommand(ctx, "next");
            },
            prevPage: (ctx) => {
                handlePageCommand(ctx, "prev");
            },
            nextChapter: () => {
                openNextChapter();
            },
            prevChapter: () => {
                openPrevChapter();
            },
            toggleZenMode: () => {
                toggleZenMode();
            },
            showHidePageNumberInZen: () => {
                setShortcutText(
                    bookReaderSettings.showProgressInZenMode
                        ? t("hud.hideProgressInZen")
                        : t("hud.showProgressInZen"),
                );
                dispatch(
                    patchLiveBookReaderSettings({
                        showProgressInZenMode: !bookReaderSettings.showProgressInZenMode,
                    }),
                );
            },
            cyclePresetNext: () => {
                const name = dispatch(cyclePresetNext("book"));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            cyclePresetPrev: () => {
                const name = dispatch(cyclePresetPrev("book"));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset1: () => {
                const name = dispatch(selectPresetSlot("book", 0));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset2: () => {
                const name = dispatch(selectPresetSlot("book", 1));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset3: () => {
                const name = dispatch(selectPresetSlot("book", 2));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset4: () => {
                const name = dispatch(selectPresetSlot("book", 3));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            selectPreset5: () => {
                const name = dispatch(selectPresetSlot("book", 4));
                if (name) setShortcutText(t("hud.presetNamed", { name }));
            },
            contextMenu: () => {
                if (!mainRef.current) return;
                mainRef.current.dispatchEvent(
                    window.contextMenu.fakeEvent(
                        { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                        readerRef.current,
                    ),
                );
            },
        },
        heldHandlers: {
            largeScroll: {
                start: () => startHeldScroll(bookReaderSettings.scrollSpeedB),
                stop: stopHeldScroll,
            },
            largeScrollReverse: {
                start: () => startHeldScroll(-bookReaderSettings.scrollSpeedB),
                stop: stopHeldScroll,
            },
            scrollDown: {
                start: () => startHeldScroll(bookReaderSettings.scrollSpeedA),
                stop: stopHeldScroll,
            },
            scrollUp: {
                start: () => startHeldScroll(-bookReaderSettings.scrollSpeedA),
                stop: stopHeldScroll,
            },
        },
        onEscape: () => {
            holdReadingPlace();
            setZenMode(false);
            return true;
        },
    });
};
