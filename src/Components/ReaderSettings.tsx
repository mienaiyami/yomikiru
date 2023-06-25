import {
    faBars,
    faMinus,
    faPlus,
    faTimes,
    faArrowsAltV,
    faArrowsAltH,
    faExpandArrowsAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, useEffect, useState } from "react";
import { setReaderSettings } from "../store/appSettings";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import InputRange from "./Element/InputRange";
import { InputSelect } from "./Element/InputSelect";
import { settingValidatorData } from "../MainImports";
import InputNumber from "./Element/InputNumber";
import InputCheckbox from "./Element/InputCheckbox";
import InputCheckboxNumber from "./Element/InputCheckboxNumber";

const ReaderSettings = memo(
    ({
        makeScrollPos,
        readerRef,
        readerSettingExtender,
        setshortcutText,
        sizePlusRef,
        sizeMinusRef,
    }: {
        makeScrollPos: () => void;
        readerRef: React.RefObject<HTMLDivElement>;
        readerSettingExtender: React.RefObject<HTMLButtonElement>;
        setshortcutText: React.Dispatch<React.SetStateAction<string>>;
        sizePlusRef: React.RefObject<HTMLButtonElement>;
        sizeMinusRef: React.RefObject<HTMLButtonElement>;
    }) => {
        const appSettings = useAppSelector((store) => store.appSettings);
        const dispatch = useAppDispatch();
        const [isReaderSettingsOpen, setReaderSettingOpen] = useState(false);
        const [maxWidth, setMaxWidth] = useState<number>(appSettings.readerSettings.widthClamped ? 100 : 500);

        useEffect(() => {
            if (isReaderSettingsOpen) {
                const f = (e: KeyboardEvent) => {
                    if (e.key === "Escape") {
                        setReaderSettingOpen(false);
                        if (readerRef.current) readerRef.current.focus();
                    }
                };
                window.addEventListener("keydown", f);
                return () => {
                    window.removeEventListener("keydown", f);
                };
            }
        }, [isReaderSettingsOpen]);
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
                className={"readerSettings " + (isReaderSettingsOpen ? "" : "closed")}
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
                    {...(!isReaderSettingsOpen ? { "data-tooltip": "Reader Settings" } : {})}
                >
                    <FontAwesomeIcon icon={isReaderSettingsOpen ? faTimes : faBars} />
                </button>
                <div className="main">
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " + (!appSettings.readerSettings.settingsCollapsed.size ? "expanded " : "")
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
                                            size: !appSettings.readerSettings.settingsCollapsed.size,
                                        },
                                    })
                                );
                            }}
                        >
                            Size
                        </div>
                        <div className="options">
                            <InputNumber
                                value={appSettings.readerSettings.readerWidth}
                                min={1}
                                max={maxWidth}
                                onChange={(e) => {
                                    makeScrollPos();

                                    let value = e.target.valueAsNumber;
                                    if (!value) value = 0;
                                    value = value >= maxWidth ? maxWidth : value;

                                    return value;
                                }}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ readerWidth: value }))]}
                                labeled={true}
                                disabled={appSettings.readerSettings.fitOption !== 0}
                                labelAfter="%"
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
                                        setshortcutText("-" + readerWidth + "%");
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
                                        setshortcutText("+" + readerWidth + "%");
                                    dispatch(setReaderSettings({ readerWidth }));
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                            <InputCheckbox
                                checked={appSettings.readerSettings.widthClamped}
                                onChange={(e) => dispatch(setReaderSettings({ widthClamped: e.target.checked }))}
                                labelAfter="Clamp"
                                title="Clamp width of images to screen"
                            />
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
                                    })
                                );
                            }}
                        >
                            Fit options
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
                                    title="Free"
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
                                            })
                                        );
                                    }}
                                    title="Fit Vertically"
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
                                            })
                                        );
                                    }}
                                    title="Fit Horizontally"
                                >
                                    <FontAwesomeIcon icon={faArrowsAltH} />
                                </button>
                                <button
                                    className={
                                        (appSettings.readerSettings.fitOption === 3 ? "optionSelected " : " ") +
                                        "icon"
                                    }
                                    onClick={() => {
                                        dispatch(
                                            setReaderSettings({
                                                fitOption: appSettings.readerSettings.fitOption === 3 ? 0 : 3,
                                            })
                                        );
                                    }}
                                    title="Original"
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
                                            })
                                        );
                                    }}
                                    min={0}
                                    max={5000}
                                    value={appSettings.readerSettings.maxWidth}
                                    disabled={
                                        appSettings.readerSettings.widthClamped ||
                                        appSettings.readerSettings.fitOption !== 0
                                    }
                                    onChangeNum={(e) => {
                                        let value = e.currentTarget.valueAsNumber;
                                        if (value > 5000) value = 5000;
                                        if (value < 0) value = 0;
                                        return value;
                                    }}
                                    timeout={[1000, (value) => dispatch(setReaderSettings({ maxWidth: value }))]}
                                    paraBefore="Max Image Width&nbsp;&nbsp;:"
                                    labelAfter="px"
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
                                            })
                                        );
                                    }}
                                    min={0}
                                    max={5000}
                                    value={appSettings.readerSettings.maxHeight}
                                    disabled={
                                        appSettings.readerSettings.widthClamped ||
                                        appSettings.readerSettings.fitOption !== 0
                                    }
                                    onChangeNum={(e) => {
                                        let value = e.currentTarget.valueAsNumber;
                                        if (value > 5000) value = 5000;
                                        if (value < 0) value = 0;
                                        return value;
                                    }}
                                    timeout={[1000, (value) => dispatch(setReaderSettings({ maxHeight: value }))]}
                                    paraBefore="Max Image Height&nbsp;:"
                                    labelAfter="px"
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
                                    })
                                );
                            }}
                        >
                            Reading mode
                        </div>
                        <div className="options">
                            <button
                                className={
                                    appSettings.readerSettings.readerTypeSelected === 0 ? "optionSelected" : ""
                                }
                                onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 0 }))}
                            >
                                Vertical Scroll
                            </button>
                            <button
                                className={
                                    appSettings.readerSettings.readerTypeSelected === 1 ? "optionSelected" : ""
                                }
                                onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 1 }))}
                            >
                                Left to Right
                            </button>
                            <button
                                className={
                                    appSettings.readerSettings.readerTypeSelected === 2 ? "optionSelected" : ""
                                }
                                onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 2 }))}
                            >
                                Right to Left
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
                                    })
                                );
                            }}
                        >
                            Pages per Row
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
                                2 odd
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
                                    })
                                );
                            }}
                        >
                            Reading side
                        </div>
                        <div className="options">
                            <button
                                className={appSettings.readerSettings.readingSide === 0 ? "optionSelected" : ""}
                                disabled={appSettings.readerSettings.pagesPerRowSelected === 0}
                                onClick={() => {
                                    dispatch(setReaderSettings({ readingSide: 0 }));
                                }}
                            >
                                LTR
                            </button>
                            <button
                                className={appSettings.readerSettings.readingSide === 1 ? "optionSelected" : ""}
                                disabled={appSettings.readerSettings.pagesPerRowSelected === 0}
                                onClick={() => {
                                    dispatch(setReaderSettings({ readingSide: 1 }));
                                }}
                            >
                                RTL
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
                                    })
                                );
                            }}
                        >
                            Scroll Speed (with keys)
                        </div>
                        <div className="options">
                            <InputNumber
                                min={1}
                                max={500}
                                value={appSettings.readerSettings.scrollSpeedA}
                                onChange={(e) => {
                                    let value = e.currentTarget.valueAsNumber;
                                    if (value > 500) value = 500;
                                    if (value < 1) value = 1;
                                    return value;
                                }}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ scrollSpeedA: value }))]}
                                labeled
                                labelBefore="Scroll&nbsp;A&nbsp;:"
                                labelAfter="px"
                            />
                            <InputNumber
                                min={1}
                                max={500}
                                value={appSettings.readerSettings.scrollSpeedB}
                                onChange={(e) => {
                                    let value = e.currentTarget.valueAsNumber;
                                    if (value > 500) value = 500;
                                    if (value < 1) value = 1;
                                    return value;
                                }}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ scrollSpeedB: value }))]}
                                labeled
                                labelBefore="Scroll&nbsp;B&nbsp;:"
                                labelAfter="px"
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
                                    })
                                );
                            }}
                        >
                            Custom Color Filter
                        </div>
                        <div className="options col">
                            <InputCheckbox
                                checked={appSettings.readerSettings.customColorFilter.enabled}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            customColorFilter: {
                                                ...appSettings.readerSettings.customColorFilter,
                                                enabled: e.currentTarget.checked,
                                            },
                                        })
                                    );
                                }}
                                paraAfter="Use Custom Color Filter"
                            />
                            <InputRange
                                className={"colorRange"}
                                min={0}
                                max={255}
                                value={appSettings.readerSettings.customColorFilter.r}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                labeled={true}
                                labelText="R:"
                                timeout={[
                                    350,
                                    (value) =>
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    r: value,
                                                },
                                            })
                                        ),
                                ]}
                            />
                            <InputRange
                                className={"colorRange"}
                                min={0}
                                max={255}
                                value={appSettings.readerSettings.customColorFilter.g}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                labeled={true}
                                labelText="G:"
                                timeout={[
                                    350,
                                    (value) =>
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    g: value,
                                                },
                                            })
                                        ),
                                ]}
                            />
                            <InputRange
                                className={"colorRange"}
                                min={0}
                                max={255}
                                value={appSettings.readerSettings.customColorFilter.b}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                labeled={true}
                                labelText="B:"
                                timeout={[
                                    350,
                                    (value) =>
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    b: value,
                                                },
                                            })
                                        ),
                                ]}
                            />
                            <InputRange
                                className={"colorRange"}
                                min={0}
                                max={1}
                                step={0.1}
                                value={appSettings.readerSettings.customColorFilter.a}
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                labeled={true}
                                labelText="A:"
                                timeout={[
                                    350,
                                    (value) =>
                                        dispatch(
                                            setReaderSettings({
                                                customColorFilter: {
                                                    ...appSettings.readerSettings.customColorFilter,
                                                    a: value,
                                                },
                                            })
                                        ),
                                ]}
                            />
                            <InputSelect
                                disabled={!appSettings.readerSettings.customColorFilter.enabled}
                                value={appSettings.readerSettings.customColorFilter.blendMode}
                                labeled={true}
                                paraBefore="Blend&nbsp;Mode:"
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            customColorFilter: {
                                                ...appSettings.readerSettings.customColorFilter,
                                                blendMode: e.currentTarget
                                                    .value as AppSettings["readerSettings"]["customColorFilter"]["blendMode"],
                                            },
                                        })
                                    );
                                }}
                                options={[...settingValidatorData.readerSettings.customColorFilter.blendMode]}
                            />

                            <InputCheckbox
                                checked={appSettings.readerSettings.invertImage}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({
                                            invertImage: e.currentTarget.checked,
                                        })
                                    );
                                }}
                                paraAfter="Invert Image"
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
                                        })
                                    );
                                }}
                                paraAfter="Force Low brightness"
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
                                            })
                                        ),
                                ]}
                            />
                        </div>
                    </div>
                    <div className={"settingItem "}>
                        <div
                            className={
                                "name " + (!appSettings.readerSettings.settingsCollapsed.others ? "expanded " : "")
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
                                            others: !appSettings.readerSettings.settingsCollapsed.others,
                                        },
                                    })
                                );
                            }}
                        >
                            Other settings
                        </div>

                        <div className="options col">
                            <InputCheckbox
                                disabled={appSettings.readerSettings.pagesPerRowSelected !== 0}
                                checked={appSettings.readerSettings.variableImageSize}
                                onChange={(e) => {
                                    dispatch(setReaderSettings({ variableImageSize: e.currentTarget.checked }));
                                }}
                                paraAfter="Double size for double spread pages."
                            />
                            <InputCheckboxNumber
                                disabled={appSettings.readerSettings.readerTypeSelected !== 0}
                                checked={appSettings.readerSettings.gapBetweenRows}
                                onChangeCheck={(e) => {
                                    dispatch(setReaderSettings({ gapBetweenRows: e.currentTarget.checked }));
                                }}
                                value={appSettings.readerSettings.gapSize}
                                min={0}
                                onChangeNum={(e) => {
                                    let value = e.target.valueAsNumber;
                                    if (!value) value = 0;
                                    return value;
                                }}
                                timeout={[1000, (value) => dispatch(setReaderSettings({ gapSize: value }))]}
                                paraBefore="Gap between rows&nbsp;:"
                                labelAfter="px"
                            />
                            <InputCheckbox
                                checked={appSettings.readerSettings.showPageNumberInZenMode}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({ showPageNumberInZenMode: e.currentTarget.checked })
                                    );
                                }}
                                paraAfter="Show Page Number in Zen Mode."
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

export default ReaderSettings;
