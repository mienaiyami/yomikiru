import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { setReaderSettings } from "../../../store/appSettings";
import { KeybindHandlerConfig, useKeybindings } from "@hooks/useKeybindings";

type ReaderKeybindingOptions = {
    readerRef: RefObject<HTMLElement>;
    makeScrollPos: () => void;
    openNextPage: () => void;
    openPrevPage: () => void;
    openNextChapter: () => void;
    openPrevChapter: () => void;
    toggleZenMode: (value?: boolean) => void;
};

// todo: require time to implement this into reader
export const useReaderKeybinding = (options: ReaderKeybindingOptions) => {
    const {
        readerRef,
        makeScrollPos,
        openNextPage,
        openPrevPage,
        openNextChapter,
        openPrevChapter,
        toggleZenMode,
    } = options;

    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((store) => store.appSettings);
    const isReaderOpen = useAppSelector((store) => store.reader.active);
    const isSettingOpen = useAppSelector((store) => store.ui.isOpen.settings);
    const isLoadingContent = useAppSelector((store) => store.reader.loading !== null);

    const [shortcutText, setShortcutText] = useState("");
    const readerSettingExtender = useRef<HTMLButtonElement>(null);
    const sizePlusRef = useRef<HTMLButtonElement>(null);
    const sizeMinusRef = useRef<HTMLButtonElement>(null);
    const navToPageButtonRef = useRef<HTMLButtonElement>(null);
    const addToBookmarkRef = useRef<HTMLButtonElement>(null);

    // const displayShortcutText = useCallback((text: string, duration = 1000) => {
    //     setShortcutText(text);
    //     const timer = setTimeout(() => {
    //         setShortcutText("");
    //     }, duration);
    //
    //     return () => clearTimeout(timer);
    // }, []);

    useEffect(() => {
        if (shortcutText) {
            const timer = setTimeout(() => {
                setShortcutText("");
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [shortcutText]);

    const createShortcutHandlers = useCallback((): KeybindHandlerConfig[] => {
        return [
            {
                command: "readerSize_50",
                handler: () => {
                    makeScrollPos();
                    dispatch(setReaderSettings({ fitOption: 0 }));
                    setShortcutText("50%");
                    dispatch(setReaderSettings({ readerWidth: 50 }));
                },
            },
            {
                command: "readerSize_100",
                handler: () => {
                    makeScrollPos();
                    dispatch(setReaderSettings({ fitOption: 0 }));
                    setShortcutText("100%");
                    dispatch(setReaderSettings({ readerWidth: 100 }));
                },
            },
            {
                command: "readerSize_150",
                handler: () => {
                    makeScrollPos();
                    dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                    setShortcutText("150%");
                    dispatch(setReaderSettings({ readerWidth: 150 }));
                },
            },
            {
                command: "readerSize_200",
                handler: () => {
                    makeScrollPos();
                    dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                    setShortcutText("200%");
                    dispatch(setReaderSettings({ readerWidth: 200 }));
                },
            },
            {
                command: "readerSize_250",
                handler: () => {
                    makeScrollPos();
                    dispatch(setReaderSettings({ widthClamped: false, fitOption: 0 }));
                    setShortcutText("250%");
                    dispatch(setReaderSettings({ readerWidth: 250 }));
                },
            },

            {
                command: "nextPage",
                handler: () => {
                    openNextPage();
                },
            },
            {
                command: "prevPage",
                handler: () => {
                    openPrevPage();
                },
            },
            {
                command: "nextChapter",
                handler: () => {
                    openNextChapter();
                },
                allowRepeated: false,
            },
            {
                command: "prevChapter",
                handler: () => {
                    openPrevChapter();
                },
                allowRepeated: false,
            },

            {
                command: "toggleZenMode",
                handler: () => {
                    toggleZenMode();
                },
                allowRepeated: false,
            },
            {
                command: "navToPage",
                handler: () => {
                    if (navToPageButtonRef.current) navToPageButtonRef.current.click();
                },
                allowRepeated: false,
            },
            {
                command: "readerSettings",
                handler: () => {
                    if (readerSettingExtender.current) {
                        readerSettingExtender.current.click();
                        readerSettingExtender.current.focus();
                    }
                },
                allowRepeated: false,
            },
            {
                command: "bookmark",
                handler: () => {
                    if (addToBookmarkRef.current) addToBookmarkRef.current.click();
                },
                allowRepeated: false,
            },
            {
                command: "sizePlus",
                handler: () => {
                    if (sizePlusRef.current) sizePlusRef.current.click();
                },
            },
            {
                command: "sizeMinus",
                handler: () => {
                    if (sizeMinusRef.current) sizeMinusRef.current.click();
                },
            },

            {
                command: "scrollDown",
                handler: () => {
                    scrollReader(appSettings.readerSettings.scrollSpeedA);
                },
            },
            {
                command: "scrollUp",
                handler: () => {
                    scrollReader(-appSettings.readerSettings.scrollSpeedA);
                },
            },
            {
                command: "largeScroll",
                handler: () => {
                    scrollReader(appSettings.readerSettings.scrollSpeedB);
                },
            },
            {
                command: "largeScrollReverse",
                handler: () => {
                    scrollReader(-appSettings.readerSettings.scrollSpeedB);
                },
            },
            {
                command: "showHidePageNumberInZen",
                handler: () => {
                    setShortcutText(
                        (!appSettings.readerSettings.showPageNumberInZenMode ? "Show" : "Hide") +
                            " page-number in Zen Mode",
                    );
                    dispatch(
                        setReaderSettings({
                            showPageNumberInZenMode: !appSettings.readerSettings.showPageNumberInZenMode,
                        }),
                    );
                },
                allowRepeated: false,
            },
            {
                command: "cycleFitOptions",
                handler: (e) => {
                    let fitOption = appSettings.readerSettings.fitOption + (e.shiftKey ? -1 : 1);
                    if (fitOption < 0) fitOption = 3;
                    fitOption %= 4;

                    if (fitOption === 0) setShortcutText("Free");
                    if (fitOption === 1) setShortcutText("Fit Vertically");
                    if (fitOption === 2) setShortcutText("Fit Horizontally");
                    if (fitOption === 3) setShortcutText("1:1");

                    dispatch(
                        setReaderSettings({
                            fitOption: fitOption as 0 | 1 | 2 | 3,
                        }),
                    );
                },
                allowRepeated: false,
            },
            {
                command: "selectReaderMode0",
                handler: () => {
                    setShortcutText("Reading Mode - Vertical Scroll");
                    dispatch(setReaderSettings({ readerTypeSelected: 0 }));
                },
                allowRepeated: false,
            },
            {
                command: "selectReaderMode1",
                handler: () => {
                    setShortcutText("Reading Mode - Left to Right");
                    dispatch(setReaderSettings({ readerTypeSelected: 1 }));
                },
                allowRepeated: false,
            },
            {
                command: "selectReaderMode2",
                handler: () => {
                    setShortcutText("Reading Mode - Right to Left");
                    dispatch(setReaderSettings({ readerTypeSelected: 2 }));
                },
                allowRepeated: false,
            },
            {
                command: "contextMenu",
                handler: () => {
                    if (imgContRef.current)
                        imgContRef.current.dispatchEvent(
                            window.contextMenu.fakeEvent(
                                { posX: window.innerWidth / 2, posY: window.innerHeight / 2 },
                                readerRef.current,
                            ),
                        );
                },
                allowRepeated: false,
            },
        ];
    }, [
        makeScrollPos,
        setShortcutText,
        dispatch,
        appSettings.readerSettings,
        openNextPage,
        openPrevPage,
        openNextChapter,
        openPrevChapter,
        toggleZenMode,
    ]);

    const scrollReader = useCallback(
        (intensity: number) => {
            if (readerRef.current) {
                let prevTime: number;
                const anim = (timeStamp: number) => {
                    if (prevTime !== timeStamp && readerRef.current) {
                        readerRef.current.scrollBy(0, intensity);
                    }
                    if (window.app.keydown) {
                        prevTime = timeStamp;
                        window.requestAnimationFrame(anim);
                    }
                };
                window.requestAnimationFrame(anim);
            }
        },
        [readerRef],
    );

    const { shortcutsMapped } = useKeybindings(createShortcutHandlers(), {
        enabled: isReaderOpen && !isSettingOpen && !isLoadingContent,
        focusElement: readerRef,
        // need to handle escape key separately
        limitedKeyFormat: false,
    });

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isReaderOpen && !isSettingOpen && !isLoadingContent) {
                if (toggleZenMode) toggleZenMode(false);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                if (e.deltaY < 0) {
                    sizePlusRef.current?.click();
                    return;
                }
                if (e.deltaY > 0) {
                    sizeMinusRef.current?.click();
                    return;
                }
            }
        };

        window.addEventListener("keydown", handleEscape);
        window.addEventListener("wheel", handleWheel);
        return () => {
            window.removeEventListener("keydown", handleEscape);
            window.removeEventListener("wheel", handleWheel);
        };
    }, [isReaderOpen, isSettingOpen, isLoadingContent, toggleZenMode]);

    return {
        shortcutsMapped,
        refs: {
            readerSettingExtender,
            sizePlusRef,
            sizeMinusRef,
            navToPageButtonRef,
            addToBookmarkRef,
        },
    };
};

export default useReaderKeybinding;
