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
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectLiveMangaPresetId, selectLiveMangaReaderSettings } from "@store/reader";
import { getActiveMangaPresetName, patchLiveMangaReaderSettings, updateMangaPreset } from "@store/readerPresets";
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
        const readerSettings = useAppSelector(selectLiveMangaReaderSettings);
        const mangaPresetId = useAppSelector(selectLiveMangaPresetId);
        const shortcutsMapped = useAppSelector(getShortcutsMapped);
        const currentPresetName = useAppSelector(getActiveMangaPresetName);
        const dispatch = useAppDispatch();
        const [isReaderSettingsOpen, setReaderSettingOpen] = useState(false);
        const [maxWidth, setMaxWidth] = useState<number>(readerSettings.widthClamped ? 100 : 500);

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
                    const id = mangaPresetId;
                    if (id) {
                        dispatch(updateMangaPreset({ id, data: readerSettings }));
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
            mangaPresetId,
            readerSettings,
            currentPresetName,
            dispatch,
            setShortcutText,
            readerRef,
            t,
        ]);
        useEffect(() => {
            setMaxWidth(readerSettings.widthClamped ? 100 : 500);
            if (readerSettings.widthClamped) {
                if (readerSettings.readerWidth > 100) dispatch(patchLiveMangaReaderSettings({ readerWidth: 100 }));
            }
        }, [readerSettings.widthClamped]);
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
                            className={`name ${!readerSettings.settingsCollapsed.size ? "expanded " : ""}`}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            size: !readerSettings.settingsCollapsed.size,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.size")}
                        </div>
                        <div className="options">
                            <InputNumber
                                value={readerSettings.readerWidth}
                                min={1}
                                max={maxWidth}
                                onChange={() => {
                                    makeScrollPos();
                                }}
                                timeout={[
                                    1000,
                                    (value) => dispatch(patchLiveMangaReaderSettings({ readerWidth: value })),
                                ]}
                                disabled={readerSettings.fitOption !== 0}
                                labelAfter={t("settings.percentUnit")}
                            />
                            <button
                                ref={sizeMinusRef}
                                disabled={readerSettings.fitOption !== 0}
                                onClick={(e) => {
                                    makeScrollPos();
                                    // was 20 before
                                    const steps = readerSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        readerSettings.readerWidth - steps > maxWidth
                                            ? maxWidth
                                            : readerSettings.readerWidth - steps < 1
                                              ? 1
                                              : readerSettings.readerWidth - steps;
                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(patchLiveMangaReaderSettings({ readerWidth }));
                                    // e.currentTarget.dispatchEvent(new MouseEvent(type:"")))
                                }}
                            >
                                <FontAwesomeIcon icon={faMinus} />
                            </button>
                            <button
                                ref={sizePlusRef}
                                disabled={readerSettings.fitOption !== 0}
                                onClick={(e) => {
                                    makeScrollPos();
                                    const steps = readerSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        readerSettings.readerWidth + steps > maxWidth
                                            ? maxWidth
                                            : readerSettings.readerWidth + steps < 1
                                              ? 1
                                              : readerSettings.readerWidth + steps;

                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(patchLiveMangaReaderSettings({ readerWidth }));
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                            <div className="col">
                                <InputCheckbox
                                    checked={readerSettings.widthClamped}
                                    onChange={(e) =>
                                        dispatch(patchLiveMangaReaderSettings({ widthClamped: e.target.checked }))
                                    }
                                    paraAfter={t("settings.clampSize")}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={"name " + (!readerSettings.settingsCollapsed.fitOption ? "expanded " : "")}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            fitOption: !readerSettings.settingsCollapsed.fitOption,
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
                                    className={readerSettings.fitOption === 0 ? "optionSelected " : " "}
                                    onClick={() => {
                                        dispatch(patchLiveMangaReaderSettings({ fitOption: 0 }));
                                    }}
                                    title={t("settings.free")}
                                >
                                    <FontAwesomeIcon icon={faExpandArrowsAlt} />
                                </button>
                                <button
                                    className={readerSettings.fitOption === 1 ? "optionSelected " : " "}
                                    onClick={() => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                fitOption: readerSettings.fitOption === 1 ? 0 : 1,
                                            }),
                                        );
                                    }}
                                    title={t("settings.fitVertically")}
                                >
                                    <FontAwesomeIcon icon={faArrowsAltV} />
                                </button>
                                <button
                                    className={readerSettings.fitOption === 2 ? "optionSelected " : " "}
                                    onClick={() => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                fitOption: readerSettings.fitOption === 2 ? 0 : 2,
                                            }),
                                        );
                                    }}
                                    title={t("settings.fitHorizontally")}
                                >
                                    <FontAwesomeIcon icon={faArrowsAltH} />
                                </button>
                                <button
                                    className={`${readerSettings.fitOption === 3 ? "optionSelected " : " "}icon`}
                                    onClick={() => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                fitOption: readerSettings.fitOption === 3 ? 0 : 3,
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
                                    checked={readerSettings.maxHeightWidthSelector === "width"}
                                    onChangeCheck={() => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                maxHeightWidthSelector:
                                                    readerSettings.maxHeightWidthSelector !== "width"
                                                        ? "width"
                                                        : "none",
                                            }),
                                        );
                                    }}
                                    min={0}
                                    max={5000}
                                    value={readerSettings.maxWidth}
                                    disabled={readerSettings.widthClamped || readerSettings.fitOption !== 0}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(patchLiveMangaReaderSettings({ maxWidth: value })),
                                    ]}
                                    paraBefore={t("settings.maxImageWidth")}
                                    paraAfter={t("settings.pxUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={readerSettings.maxHeightWidthSelector === "height"}
                                    onChangeCheck={() => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                maxHeightWidthSelector:
                                                    readerSettings.maxHeightWidthSelector !== "height"
                                                        ? "height"
                                                        : "none",
                                            }),
                                        );
                                    }}
                                    min={0}
                                    max={5000}
                                    value={readerSettings.maxHeight}
                                    disabled={readerSettings.widthClamped || readerSettings.fitOption !== 0}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(patchLiveMangaReaderSettings({ maxHeight: value })),
                                    ]}
                                    paraBefore={t("settings.maxImageHeight")}
                                    paraAfter={t("settings.pxUnit")}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " + (!readerSettings.settingsCollapsed.readingMode ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            readingMode: !readerSettings.settingsCollapsed.readingMode,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.readingMode")}
                        </div>
                        <div className="options">
                            <button
                                className={readerSettings.readerTypeSelected === 0 ? "optionSelected" : ""}
                                onClick={() => dispatch(patchLiveMangaReaderSettings({ readerTypeSelected: 0 }))}
                            >
                                {t("settings.verticalScroll")}
                            </button>
                            <button
                                className={readerSettings.readerTypeSelected === 1 ? "optionSelected" : ""}
                                onClick={() => dispatch(patchLiveMangaReaderSettings({ readerTypeSelected: 1 }))}
                            >
                                {t("settings.leftToRight")}
                            </button>
                            <button
                                className={readerSettings.readerTypeSelected === 2 ? "optionSelected" : ""}
                                onClick={() => dispatch(patchLiveMangaReaderSettings({ readerTypeSelected: 2 }))}
                            >
                                {t("settings.rightToLeft")}
                            </button>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={"name " + (!readerSettings.settingsCollapsed.pagePerRow ? "expanded " : "")}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            pagePerRow: !readerSettings.settingsCollapsed.pagePerRow,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.pagesPerRow")}
                        </div>
                        <div className="options">
                            <button
                                className={readerSettings.pagesPerRowSelected === 0 ? "optionSelected" : ""}
                                onClick={() => {
                                    if (readerSettings.pagesPerRowSelected !== 0) {
                                        const pagesPerRowSelected = 0;

                                        let readerWidth = readerSettings.readerWidth / 2;
                                        if (readerWidth > maxWidth) readerWidth = maxWidth;
                                        if (readerWidth < 1) readerWidth = 1;
                                        dispatch(
                                            patchLiveMangaReaderSettings({ pagesPerRowSelected, readerWidth }),
                                        );
                                    }
                                }}
                            >
                                1
                            </button>
                            <button
                                className={readerSettings.pagesPerRowSelected === 1 ? "optionSelected" : ""}
                                onClick={() => {
                                    const pagesPerRowSelected = 1;
                                    let readerWidth = readerSettings.readerWidth;
                                    if (readerSettings.pagesPerRowSelected === 0) {
                                        readerWidth *= 2;
                                        if (readerWidth > (readerSettings.widthClamped ? 100 : 500))
                                            readerWidth = readerSettings.widthClamped ? 100 : 500;
                                        if (readerWidth < 1) readerWidth = 1;
                                    }
                                    dispatch(patchLiveMangaReaderSettings({ pagesPerRowSelected, readerWidth }));
                                }}
                            >
                                2
                            </button>
                            <button
                                className={readerSettings.pagesPerRowSelected === 2 ? "optionSelected" : ""}
                                onClick={() => {
                                    const pagesPerRowSelected = 2;
                                    let readerWidth = readerSettings.readerWidth;
                                    if (readerSettings.pagesPerRowSelected === 0) {
                                        readerWidth *= 2;
                                        if (readerWidth > (readerSettings.widthClamped ? 100 : 500))
                                            readerWidth = readerSettings.widthClamped ? 100 : 500;
                                        if (readerWidth < 1) readerWidth = 1;
                                    }
                                    dispatch(patchLiveMangaReaderSettings({ pagesPerRowSelected, readerWidth }));
                                }}
                            >
                                {t("settings.pagePerRow2odd")}
                            </button>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " + (!readerSettings.settingsCollapsed.readingSide ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            readingSide: !readerSettings.settingsCollapsed.readingSide,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.readingSide")}
                        </div>
                        <div className="options">
                            <button
                                className={readerSettings.readingSide === 0 ? "optionSelected" : ""}
                                disabled={readerSettings.pagesPerRowSelected === 0}
                                onClick={() => {
                                    dispatch(patchLiveMangaReaderSettings({ readingSide: 0 }));
                                }}
                            >
                                {t("settings.ltr")}
                            </button>
                            <button
                                className={readerSettings.readingSide === 1 ? "optionSelected" : ""}
                                disabled={readerSettings.pagesPerRowSelected === 0}
                                onClick={() => {
                                    dispatch(patchLiveMangaReaderSettings({ readingSide: 1 }));
                                }}
                            >
                                {t("settings.rtl")}
                            </button>
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " + (!readerSettings.settingsCollapsed.scrollSpeed ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            scrollSpeed: !readerSettings.settingsCollapsed.scrollSpeed,
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
                                value={readerSettings.scrollSpeedA}
                                timeout={[
                                    1000,
                                    (value) => dispatch(patchLiveMangaReaderSettings({ scrollSpeedA: value })),
                                ]}
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
                                value={readerSettings.scrollSpeedB}
                                timeout={[
                                    1000,
                                    (value) => dispatch(patchLiveMangaReaderSettings({ scrollSpeedB: value })),
                                ]}
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
                                checked={readerSettings.overrideMouseWheelSpeed}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
                                            overrideMouseWheelSpeed: e.target.checked,
                                        }),
                                    );
                                }}
                                value={readerSettings.mouseWheelScrollSpeed}
                                timeout={[
                                    1000,
                                    (value) =>
                                        dispatch(patchLiveMangaReaderSettings({ mouseWheelScrollSpeed: value })),
                                ]}
                                paraBefore={t("settings.mouseWheelSpeed")}
                                paraAfter={t("settings.screenUnit")}
                            />
                            <InputNumber
                                min={0}
                                max={1000}
                                disabled={!readerSettings.overrideMouseWheelSpeed}
                                value={readerSettings.mouseWheelScrollDuration}
                                timeout={[
                                    1000,
                                    (value) =>
                                        dispatch(
                                            patchLiveMangaReaderSettings({ mouseWheelScrollDuration: value }),
                                        ),
                                ]}
                                paraBefore={t("settings.mouseWheelDuration")}
                                paraAfter={t("settings.msUnit")}
                            />
                            <InputCheckboxNumber
                                min={0.1}
                                max={100}
                                step={0.1}
                                checked={readerSettings.enableTouchScroll}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({ enableTouchScroll: e.target.checked }),
                                    );
                                }}
                                value={readerSettings.touchScrollMultiplier}
                                timeout={[
                                    1000,
                                    (value) =>
                                        dispatch(patchLiveMangaReaderSettings({ touchScrollMultiplier: value })),
                                ]}
                                labelBefore={t("settings.dragMultiplier")}
                            />
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " + (!readerSettings.settingsCollapsed.customColorFilter ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            customColorFilter: !readerSettings.settingsCollapsed.customColorFilter,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.colorFilters")}
                        </div>
                        <div className="options col">
                            <InputCheckboxColor
                                checked={readerSettings.customColorFilter.enabled}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
                                            customColorFilter: {
                                                ...readerSettings.customColorFilter,
                                                enabled: e.currentTarget.checked,
                                            },
                                        }),
                                    );
                                }}
                                paraBefore={t("settings.useCustomColorFilter")}
                                value={colorUtils.new([
                                    readerSettings.customColorFilter.r,
                                    readerSettings.customColorFilter.g,
                                    readerSettings.customColorFilter.b,
                                    readerSettings.customColorFilter.a,
                                ])}
                                timeout={[
                                    500,
                                    (value) => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                customColorFilter: {
                                                    ...readerSettings.customColorFilter,
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
                                disabled={!readerSettings.customColorFilter.enabled}
                                value={readerSettings.customColorFilter.blendMode}
                                labeled={true}
                                paraBefore={t("settings.blendMode")}
                                onChange={(value) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
                                            customColorFilter: {
                                                ...readerSettings.customColorFilter,
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
                                value={readerSettings.customColorFilter.hue}
                                disabled={!readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                customColorFilter: {
                                                    ...readerSettings.customColorFilter,
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
                                value={readerSettings.customColorFilter.contrast}
                                disabled={!readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                customColorFilter: {
                                                    ...readerSettings.customColorFilter,
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
                                value={readerSettings.customColorFilter.saturation}
                                disabled={!readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                customColorFilter: {
                                                    ...readerSettings.customColorFilter,
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
                                value={readerSettings.customColorFilter.brightness}
                                disabled={!readerSettings.customColorFilter.enabled}
                                timeout={[
                                    350,
                                    (value) => {
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                customColorFilter: {
                                                    ...readerSettings.customColorFilter,
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
                                        patchLiveMangaReaderSettings({
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
                                checked={readerSettings.invertImage}
                                onChange={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
                                            invertImage: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.invertImage")}
                            />
                            <InputCheckbox
                                checked={readerSettings.grayscale}
                                onChange={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
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
                            className={`name ${!readerSettings.settingsCollapsed.others ? "expanded " : ""}`}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveMangaReaderSettings({
                                        settingsCollapsed: {
                                            ...readerSettings.settingsCollapsed,
                                            others: !readerSettings.settingsCollapsed.others,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.otherSettings")}
                        </div>

                        <div className="options col">
                            <InputCheckbox
                                disabled={readerSettings.pagesPerRowSelected !== 0}
                                checked={readerSettings.variableImageSize}
                                onChange={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
                                            variableImageSize: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.doubleSizeSpread")}
                            />
                            <InputCheckboxNumber
                                disabled={readerSettings.readerTypeSelected !== 0}
                                checked={readerSettings.gapBetweenRows}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({ gapBetweenRows: e.currentTarget.checked }),
                                    );
                                }}
                                value={readerSettings.gapSize}
                                min={0}
                                max={2000}
                                timeout={[
                                    1000,
                                    (value) => dispatch(patchLiveMangaReaderSettings({ gapSize: value })),
                                ]}
                                paraBefore={t("settings.gapBetweenRows")}
                                paraAfter={t("settings.pxUnit")}
                            />
                            <InputCheckbox
                                checked={readerSettings.showPageNumberInZenMode}
                                onChange={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
                                            showPageNumberInZenMode: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.showPageNumberInZen")}
                            />
                            <InputCheckbox
                                checked={readerSettings.forceLowBrightness.enabled}
                                onChange={(e) => {
                                    dispatch(
                                        patchLiveMangaReaderSettings({
                                            forceLowBrightness: {
                                                ...readerSettings.forceLowBrightness,
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
                                value={readerSettings.forceLowBrightness.value}
                                disabled={!readerSettings.forceLowBrightness.enabled}
                                labeled={true}
                                labelText=""
                                timeout={[
                                    350,
                                    (value) =>
                                        dispatch(
                                            patchLiveMangaReaderSettings({
                                                forceLowBrightness: {
                                                    ...readerSettings.forceLowBrightness,
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
