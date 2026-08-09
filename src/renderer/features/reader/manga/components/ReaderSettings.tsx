import { MangaReaderPresetSection } from "@features/reader/components/ReaderPresetSection";
import {
    faArrowsAltH,
    faArrowsAltV,
    faBars,
    faExpandArrowsAlt,
    faMinus,
    faPlus,
    faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getActiveMangaPresetName, updateMangaPreset } from "@store/readerPresets";
import { getShortcutsMapped } from "@store/shortcuts";
import InputCheckbox from "@ui/InputCheckbox";
import InputCheckboxColor from "@ui/InputCheckboxColor";
import InputCheckboxNumber from "@ui/InputCheckboxNumber";
import InputNumber from "@ui/InputNumber";
import InputRange from "@ui/InputRange";
import InputSelect from "@ui/InputSelect";
import { colorUtils } from "@utils/color";
import { keyFormatter } from "@utils/keybindings";
import { defaultMangaReaderSettings } from "@utils/readerSettingsSchema";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const ReaderSettings = memo(
    ({
        makeScrollPos,
        readerRef,
        readerSettingExtender,
        setShortcutText,
        sizePlusRef,
        sizeMinusRef,
    }: {
        makeScrollPos: () => void;
        readerRef: React.RefObject<HTMLDivElement>;
        readerSettingExtender: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
        sizePlusRef: React.RefObject<HTMLButtonElement>;
        sizeMinusRef: React.RefObject<HTMLButtonElement>;
    }) => {
        const { t } = useTranslation("reader");
        const { t: tSettings } = useTranslation("settings");
        const appSettings = useAppSelector((store) => store.appSettings);
        const shortcutsMapped = useAppSelector(getShortcutsMapped);
        const currentPresetName = useAppSelector(getActiveMangaPresetName);
        const dispatch = useAppDispatch();
        const [isReaderSettingsOpen, setReaderSettingOpen] = useState(false);
        const [maxWidth, setMaxWidth] = useState<number>(appSettings.readerSettings.widthClamped ? 100 : 500);

        useEffect(() => {
            const f = (e: KeyboardEvent) => {
                if (isReaderSettingsOpen && e.key === "Escape") {
                    setReaderSettingOpen(false);
                    if (readerRef.current) readerRef.current.focus();
                    return;
                }
                const keyStr = keyFormatter(e);
                if (keyStr && shortcutsMapped.savePreset?.includes(keyStr)) {
                    e.preventDefault();
                    const id = appSettings.mangaReaderPresetId;
                    if (id) {
                        dispatch(updateMangaPreset({ id, data: appSettings.readerSettings }));
                        setShortcutText(
                            t("hud.savedToPreset", {
                                name: currentPresetName ?? t("hud.unknownPreset"),
                            }),
                        );
                    }
                }
            };
            window.addEventListener("keydown", f);
            return () => window.removeEventListener("keydown", f);
        }, [
            isReaderSettingsOpen,
            shortcutsMapped,
            appSettings.mangaReaderPresetId,
            appSettings.readerSettings,
            currentPresetName,
            dispatch,
            setShortcutText,
            readerRef,
            t,
        ]);
        useEffect(() => {
            setMaxWidth(appSettings.readerSettings.widthClamped ? 100 : 500);
            if (appSettings.readerSettings.widthClamped) {
                if (appSettings.readerSettings.readerWidth > 100)
                    dispatch(setReaderSettings({ readerWidth: 100 }));
            }
        }, [appSettings.readerSettings.widthClamped]);
        return (
            <div
                id="readerSettings"
                className={
                    "readerSettings " +
                    (isReaderSettingsOpen ? "" : "closed ") +
                    (appSettings.checkboxReaderSetting ? "checkboxSetting " : "")
                }
                onKeyDown={(e) => {
                    if (e.key === "Escape" || e.key === "q") {
                        e.stopPropagation();
                        setReaderSettingOpen(false);
                        if (readerRef.current) readerRef.current.focus();
                    }
                }}
            >
                <button
                    className="menuExtender"
                    ref={readerSettingExtender}
                    onClick={() => setReaderSettingOpen((init) => !init)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape" || e.key === "q") e.currentTarget.blur();
                    }}
                    {...(!isReaderSettingsOpen ? { "data-tooltip": t("settings.readerSettingsTooltip") } : {})}
                >
                    <FontAwesomeIcon icon={isReaderSettingsOpen ? faTimes : faBars} />
                </button>
                <div className="main">
                    <MangaReaderPresetSection />
                    <div className={"settingItem "}>
                        <div
                            className={`name ${!appSettings.readerSettings.settingsCollapsed.size ? "expanded " : ""}`}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            size: !appSettings.readerSettings.settingsCollapsed.size,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.size")}
                        </div>
                        <div className="options">
                            <InputNumber
                                value={appSettings.readerSettings.readerWidth}
                                min={1}
                                max={maxWidth}
                                onChange={() => {
                                    makeScrollPos();
                                }}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ readerWidth: value }))]}
                                disabled={appSettings.readerSettings.fitOption !== 0}
                                labelAfter={t("settings.percentUnit")}
                            />
                            <button
                                ref={sizeMinusRef}
                                disabled={appSettings.readerSettings.fitOption !== 0}
                                onClick={(e) => {
                                    makeScrollPos();
                                    // was 20 before
                                    const steps = appSettings.readerSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        appSettings.readerSettings.readerWidth - steps > maxWidth
                                            ? maxWidth
                                            : appSettings.readerSettings.readerWidth - steps < 1
                                              ? 1
                                              : appSettings.readerSettings.readerWidth - steps;
                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(setReaderSettings({ readerWidth }));
                                    // e.currentTarget.dispatchEvent(new MouseEvent(type:"")))
                                }}
                            >
                                <FontAwesomeIcon icon={faMinus} />
                            </button>
                            <button
                                ref={sizePlusRef}
                                disabled={appSettings.readerSettings.fitOption !== 0}
                                onClick={(e) => {
                                    makeScrollPos();
                                    const steps = appSettings.readerSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        appSettings.readerSettings.readerWidth + steps > maxWidth
                                            ? maxWidth
                                            : appSettings.readerSettings.readerWidth + steps < 1
                                              ? 1
                                              : appSettings.readerSettings.readerWidth + steps;

                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(setReaderSettings({ readerWidth }));
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                            <div className="col">
                                <InputCheckbox
                                    checked={appSettings.readerSettings.widthClamped}
                                    onChange={(e) =>
                                        dispatch(setReaderSettings({ widthClamped: e.target.checked }))
                                    }
                                    paraAfter={t("settings.clampSize")}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " +
                                (!appSettings.readerSettings.settingsCollapsed.fitOption ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            fitOption: !appSettings.readerSettings.settingsCollapsed.fitOption,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.fitOptions")}
                        </div>
                        <div className="options">
                            <div className="row">
                                <button
                                    className={
                                        appSettings.readerSettings.fitOption === 0 ? "optionSelected " : " "
                                    }
                                    onClick={() => {
                                        dispatch(setReaderSettings({ fitOption: 0 }));
                                    }}
                                    title={t("settings.free")}
                                >
                                    <FontAwesomeIcon icon={faExpandArrowsAlt} />
                                </button>
                                <button
                                    className={
                                        appSettings.readerSettings.fitOption === 1 ? "optionSelected " : " "
                                    }
                                    onClick={() => {
                                        dispatch(
                                            setReaderSettings({
                                                fitOption: appSettings.readerSettings.fitOption === 1 ? 0 : 1,
                                            }),
                                        );
                                    }}
                                    title={t("settings.fitVertically")}
                                >
                                    <FontAwesomeIcon icon={faArrowsAltV} />
                                </button>
                                <button
                                    className={
                                        appSettings.readerSettings.fitOption === 2 ? "optionSelected " : " "
                                    }
                                    onClick={() => {
                                        dispatch(
                                            setReaderSettings({
                                                fitOption: appSettings.readerSettings.fitOption === 2 ? 0 : 2,
                                            }),
                                        );
                                    }}
                                    title={t("settings.fitHorizontally")}
                                >
                                    <FontAwesomeIcon icon={faArrowsAltH} />
                                </button>
                                <button
                                    className={`${
                                        appSettings.readerSettings.fitOption === 3 ? "optionSelected " : " "
                                    }icon`}
                                    onClick={() => {
                                        dispatch(
                                            setReaderSettings({
                                                fitOption: appSettings.readerSettings.fitOption === 3 ? 0 : 3,
                                            }),
                                        );
                                    }}
                                    title={t("settings.original")}
                                    style={{ fontWeight: "bold" }}
                                >
                                    1:1
                                </button>
                            </div>
                            <div className="col">
                                <InputCheckboxNumber
                                    checked={appSettings.readerSettings.maxHeightWidthSelector === "width"}
                                    onChangeCheck={() => {
                                        dispatch(
                                            setReaderSettings({
                                                maxHeightWidthSelector:
                                                    appSettings.readerSettings.maxHeightWidthSelector !== "width"
                                                        ? "width"
                                                        : "none",
                                            }),
                                        );
                                    }}
                                    min={0}
                                    max={5000}
                                    value={appSettings.readerSettings.maxWidth}
                                    disabled={
                                        appSettings.readerSettings.widthClamped ||
                                        appSettings.readerSettings.fitOption !== 0
                                    }
                                    timeout={[1000, (value) => dispatch(setReaderSettings({ maxWidth: value }))]}
                                    paraBefore={t("settings.maxImageWidth")}
                                    paraAfter={t("settings.pxUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={appSettings.readerSettings.maxHeightWidthSelector === "height"}
                                    onChangeCheck={() => {
                                        dispatch(
                                            setReaderSettings({
                                                maxHeightWidthSelector:
                                                    appSettings.readerSettings.maxHeightWidthSelector !== "height"
                                                        ? "height"
                                                        : "none",
                                            }),
                                        );
                                    }}
                                    min={0}
                                    max={5000}
                                    value={appSettings.readerSettings.maxHeight}
                                    disabled={
                                        appSettings.readerSettings.widthClamped ||
                                        appSettings.readerSettings.fitOption !== 0
                                    }
                                    timeout={[1000, (value) => dispatch(setReaderSettings({ maxHeight: value }))]}
                                    paraBefore={t("settings.maxImageHeight")}
                                    paraAfter={t("settings.pxUnit")}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " +
                                (!appSettings.readerSettings.settingsCollapsed.readingMode ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            readingMode: !appSettings.readerSettings.settingsCollapsed.readingMode,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.readingMode")}
                        </div>
                        <div className="options">
                            <button
                                className={
                                    appSettings.readerSettings.readerTypeSelected === 0 ? "optionSelected" : ""
                                }
                                onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 0 }))}
                            >
                                {t("settings.verticalScroll")}
                            </button>
                            <button
                                className={
                                    appSettings.readerSettings.readerTypeSelected === 1 ? "optionSelected" : ""
                                }
                                onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 1 }))}
                            >
                                {t("settings.leftToRight")}
                            </button>
                            <button
                                className={
                                    appSettings.readerSettings.readerTypeSelected === 2 ? "optionSelected" : ""
                                }
                                onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 2 }))}
                            >
                                {t("settings.rightToLeft")}
                            </button>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " +
                                (!appSettings.readerSettings.settingsCollapsed.pagePerRow ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            pagePerRow: !appSettings.readerSettings.settingsCollapsed.pagePerRow,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.pagesPerRow")}
                        </div>
                        <div className="options">
                            <button
                                className={
                                    appSettings.readerSettings.pagesPerRowSelected === 0 ? "optionSelected" : ""
                                }
                                onClick={() => {
                                    if (appSettings.readerSettings.pagesPerRowSelected !== 0) {
                                        const pagesPerRowSelected = 0;

                                        let readerWidth = appSettings.readerSettings.readerWidth / 2;
                                        if (readerWidth > maxWidth) readerWidth = maxWidth;
                                        if (readerWidth < 1) readerWidth = 1;
                                        dispatch(setReaderSettings({ pagesPerRowSelected, readerWidth }));
                                    }
                                }}
                            >
                                1
                            </button>
                            <button
                                className={
                                    appSettings.readerSettings.pagesPerRowSelected === 1 ? "optionSelected" : ""
                                }
                                onClick={() => {
                                    const pagesPerRowSelected = 1;
                                    let readerWidth = appSettings.readerSettings.readerWidth;
                                    if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                                        readerWidth *= 2;
                                        if (readerWidth > (appSettings.readerSettings.widthClamped ? 100 : 500))
                                            readerWidth = appSettings.readerSettings.widthClamped ? 100 : 500;
                                        if (readerWidth < 1) readerWidth = 1;
                                    }
                                    dispatch(setReaderSettings({ pagesPerRowSelected, readerWidth }));
                                }}
                            >
                                2
                            </button>
                            <button
                                className={
                                    appSettings.readerSettings.pagesPerRowSelected === 2 ? "optionSelected" : ""
                                }
                                onClick={() => {
                                    const pagesPerRowSelected = 2;
                                    let readerWidth = appSettings.readerSettings.readerWidth;
                                    if (appSettings.readerSettings.pagesPerRowSelected === 0) {
                                        readerWidth *= 2;
                                        if (readerWidth > (appSettings.readerSettings.widthClamped ? 100 : 500))
                                            readerWidth = appSettings.readerSettings.widthClamped ? 100 : 500;
                                        if (readerWidth < 1) readerWidth = 1;
                                    }
                                    dispatch(setReaderSettings({ pagesPerRowSelected, readerWidth }));
                                }}
                            >
                                {t("settings.pagePerRow2odd")}
                            </button>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " +
                                (!appSettings.readerSettings.settingsCollapsed.readingSide ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            readingSide: !appSettings.readerSettings.settingsCollapsed.readingSide,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.readingSide")}
                        </div>
                        <div className="options">
                            <button
                                className={appSettings.readerSettings.readingSide === 0 ? "optionSelected" : ""}
                                disabled={appSettings.readerSettings.pagesPerRowSelected === 0}
                                onClick={() => {
                                    dispatch(setReaderSettings({ readingSide: 0 }));
                                }}
                            >
                                {t("settings.ltr")}
                            </button>
                            <button
                                className={appSettings.readerSettings.readingSide === 1 ? "optionSelected" : ""}
                                disabled={appSettings.readerSettings.pagesPerRowSelected === 0}
                                onClick={() => {
                                    dispatch(setReaderSettings({ readingSide: 1 }));
                                }}
                            >
                                {t("settings.rtl")}
                            </button>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " +
                                (!appSettings.readerSettings.settingsCollapsed.scrollSpeed ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            scrollSpeed: !appSettings.readerSettings.settingsCollapsed.scrollSpeed,
                                        },
                                    }),
                                );
                            }}
                            title={t("settings.scrollSpeedTitle")}
                        >
                            {t("settings.scrollSpeed")}
                        </div>
                        <div className="options">
                            <InputNumber
                                min={1}
                                max={500}
                                value={appSettings.readerSettings.scrollSpeedA}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ scrollSpeedA: value }))]}
                                labelBefore={t("settings.scrollAKey")}
                                labelAfter={t("settings.pxUnit")}
                                // tooltip={(() => {
                                //     const index1 = shortcuts.findIndex((e) => e.command === "scrollDown");
                                //     const index2 = shortcuts.findIndex((e) => e.command === "scrollUp");
                                //     return `Keys: "${shortcuts[index1].key1}" "${shortcuts[index1].key2}" / "${shortcuts[index2].key1}" "${shortcuts[index2].key2}"`;
                                // })()}
                                // className="tooltip-top-start"
                            />
                            <InputNumber
                                min={1}
                                max={500}
                                value={appSettings.readerSettings.scrollSpeedB}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ scrollSpeedB: value }))]}
                                labelBefore={t("settings.scrollBKey")}
                                labelAfter={t("settings.pxUnit")}
                                // tooltip={(() => {
                                //     const index = shortcuts.findIndex((e) => e.command === "largeScroll");
                                //     return `Keys: "${shortcuts[index].key1}" "${shortcuts[index].key2}"`;
                                // })()}
                                // className="tooltip-top-start"
                            />
                            <InputCheckboxNumber
                                min={0.1}
                                max={10}
                                step={0.1}
                                checked={appSettings.readerSettings.overrideMouseWheelSpeed}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            overrideMouseWheelSpeed: e.target.checked,
                                        }),
                                    );
                                }}
                                value={appSettings.readerSettings.mouseWheelScrollSpeed}
                                timeout={[
                                    1000,
                                    (value) => dispatch(setReaderSettings({ mouseWheelScrollSpeed: value })),
                                ]}
                                paraBefore={t("settings.mouseWheelSpeed")}
                                paraAfter={t("settings.screenUnit")}
                            />
                            <InputNumber
                                min={0}
                                max={1000}
                                disabled={!appSettings.readerSettings.overrideMouseWheelSpeed}
                                value={appSettings.readerSettings.mouseWheelScrollDuration}
                                timeout={[
                                    1000,
                                    (value) => dispatch(setReaderSettings({ mouseWheelScrollDuration: value })),
                                ]}
                                paraBefore={t("settings.mouseWheelDuration")}
                                paraAfter={t("settings.msUnit")}
                            />
                            <InputCheckboxNumber
                                min={0.1}
                                max={100}
                                step={0.1}
                                checked={appSettings.readerSettings.enableTouchScroll}
                                onChangeCheck={(e) => {
                                    dispatch(setReaderSettings({ enableTouchScroll: e.target.checked }));
                                }}
                                value={appSettings.readerSettings.touchScrollMultiplier}
                                timeout={[
                                    1000,
                                    (value) => dispatch(setReaderSettings({ touchScrollMultiplier: value })),
                                ]}
                                labelBefore={t("settings.dragMultiplier")}
                            />
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " +
                                (!appSettings.readerSettings.settingsCollapsed.customColorFilter
                                    ? "expanded "
                                    : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            customColorFilter:
                                                !appSettings.readerSettings.settingsCollapsed.customColorFilter,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.colorFilters")}
                        </div>
                        <div className="options col">
                            <InputCheckboxColor
                                checked={appSettings.readerSettings.customColorFilter.enabled}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            customColorFilter: {
                                                ...appSettings.readerSettings.customColorFilter,
                                                enabled: e.currentTarget.checked,
                                            },
                                        }),
                                    );
                                }}
                                paraBefore={t("settings.useCustomColorFilter")}
                                value={colorUtils.new([
                                    appSettings.readerSettings.customColorFilter.r,
                                    appSettings.readerSettings.customColorFilter.g,
                                    appSettings.readerSettings.customColorFilter.b,
                                    appSettings.readerSettings.customColorFilter.a,
                                ])}
                                timeout={[
                                    500,
                                    (value) => {
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    r: value.red(),
                                                    g: value.green(),
                                                    b: value.blue(),
                                                    a: value.alpha(),
                                                },
                                            }),
                                        );
                                    },
                                ]}
                            />
                            {/* //todo separate  */}
                            <InputSelect
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                value={appSettings.readerSettings.customColorFilter.blendMode}
                                labeled={true}
                                paraBefore={t("settings.blendMode")}
                                onChange={(value) => {
                                    dispatch(
                                        setReaderSettings({
                                            customColorFilter: {
                                                ...appSettings.readerSettings.customColorFilter,
                                                blendMode:
                                                    value as AppSettings["readerSettings"]["customColorFilter"]["blendMode"],
                                            },
                                        }),
                                    );
                                }}
                                // todo get from schema
                                options={[
                                    "color",
                                    "color-burn",
                                    "color-dodge",
                                    "darken",
                                    "difference",
                                    "exclusion",
                                    "hard-light",
                                    "hue",
                                    "lighten",
                                    "luminosity",
                                    "multiply",
                                    "normal",
                                    "overlay",
                                    "saturation",
                                    "screen",
                                    "soft-light",
                                ].map((e) => ({ label: e, value: e }))}
                            />
                            <InputRange
                                labelText={t("settings.hue")}
                                min={0}
                                max={360}
                                value={appSettings.readerSettings.customColorFilter.hue}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    hue: value,
                                                },
                                            }),
                                        );
                                    },
                                ]}
                            />
                            <InputRange
                                labelText={t("settings.contrast")}
                                min={-1}
                                max={1}
                                step={0.1}
                                value={appSettings.readerSettings.customColorFilter.contrast}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    contrast: value,
                                                },
                                            }),
                                        );
                                    },
                                ]}
                            />
                            <InputRange
                                labelText={t("settings.saturation")}
                                min={-1}
                                max={1}
                                step={0.1}
                                value={appSettings.readerSettings.customColorFilter.saturation}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    saturation: value,
                                                },
                                            }),
                                        );
                                    },
                                ]}
                            />
                            <InputRange
                                labelText={t("settings.brightness")}
                                min={-1}
                                max={1}
                                step={0.1}
                                value={appSettings.readerSettings.customColorFilter.brightness}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    brightness: value,
                                                },
                                            }),
                                        );
                                    },
                                ]}
                            />
                            <button
                                onClick={() => {
                                    dispatch(
                                        setReaderSettings({
                                            customColorFilter: {
                                                ...defaultMangaReaderSettings.customColorFilter,
                                            },
                                            invertImage: defaultMangaReaderSettings.invertImage,
                                            grayscale: defaultMangaReaderSettings.grayscale,
                                        }),
                                    );
                                }}
                            >
                                {tSettings("shared.reset")}
                            </button>
                            <InputCheckbox
                                checked={appSettings.readerSettings.invertImage}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            invertImage: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.invertImage")}
                            />
                            <InputCheckbox
                                checked={appSettings.readerSettings.grayscale}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            grayscale: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.grayscale")}
                            />
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={`name ${!appSettings.readerSettings.settingsCollapsed.others ? "expanded " : ""}`}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.readerSettings.settingsCollapsed,
                                            others: !appSettings.readerSettings.settingsCollapsed.others,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.otherSettings")}
                        </div>

                        <div className="options col">
                            <InputCheckbox
                                disabled={appSettings.readerSettings.pagesPerRowSelected !== 0}
                                checked={appSettings.readerSettings.variableImageSize}
                                onChange={(e) => {
                                    dispatch(setReaderSettings({ variableImageSize: e.currentTarget.checked }));
                                }}
                                paraAfter={t("settings.doubleSizeSpread")}
                            />
                            <InputCheckboxNumber
                                disabled={appSettings.readerSettings.readerTypeSelected !== 0}
                                checked={appSettings.readerSettings.gapBetweenRows}
                                onChangeCheck={(e) => {
                                    dispatch(setReaderSettings({ gapBetweenRows: e.currentTarget.checked }));
                                }}
                                value={appSettings.readerSettings.gapSize}
                                min={0}
                                max={2000}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ gapSize: value }))]}
                                paraBefore={t("settings.gapBetweenRows")}
                                paraAfter={t("settings.pxUnit")}
                            />
                            <InputCheckbox
                                checked={appSettings.readerSettings.showPageNumberInZenMode}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            showPageNumberInZenMode: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.showPageNumberInZen")}
                            />
                            <InputCheckbox
                                checked={appSettings.readerSettings.forceLowBrightness.enabled}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            forceLowBrightness: {
                                                ...appSettings.readerSettings.forceLowBrightness,
                                                enabled: e.currentTarget.checked,
                                            },
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.forceLowBrightness")}
                            />
                            <InputRange
                                className={"colorRange"}
                                min={0}
                                max={0.9}
                                step={0.05}
                                value={appSettings.readerSettings.forceLowBrightness.value}
                                disabled={!appSettings.readerSettings.forceLowBrightness.enabled}
                                labeled={true}
                                labelText=""
                                timeout={[
                                    350,
                                    (value) =>
                                        dispatch(
                                            setReaderSettings({
                                                forceLowBrightness: {
                                                    ...appSettings.readerSettings.forceLowBrightness,
                                                    value,
                                                },
                                            }),
                                        ),
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);

ReaderSettings.displayName = "MangaReaderSettings";

export default ReaderSettings;
