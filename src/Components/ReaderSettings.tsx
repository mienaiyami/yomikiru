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
import { useEffect, useState } from "react";
import { setReaderSettings } from "../store/appSettings";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import InputRange from "./Element/InputRange";
import { InputSelect } from "./Element/InputSelect";
import { settingValidatorData } from "../MainImports";

const ReaderSettings = ({
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
            if (appSettings.readerSettings.readerWidth > 100) dispatch(setReaderSettings({ readerWidth: 100 }));
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
                <div className="settingItem">
                    <div className="name">Size</div>
                    <div className="options">
                        <label className={appSettings.readerSettings.fitOption !== 0 ? "disabled" : ""}>
                            <input
                                type="number"
                                value={appSettings.readerSettings.readerWidth}
                                min={1}
                                max={maxWidth}
                                disabled={appSettings.readerSettings.fitOption !== 0}
                                onKeyDown={(e) => {
                                    if (e.key !== "Escape") {
                                        e.stopPropagation();
                                    }
                                }}
                                onChange={(e) => {
                                    makeScrollPos();

                                    let value = e.target.valueAsNumber;
                                    if (!value) value = 0;
                                    value = value >= maxWidth ? maxWidth : value;

                                    dispatch(setReaderSettings({ readerWidth: value }));
                                }}
                            />
                            %
                        </label>
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
                        <label className={appSettings.readerSettings.widthClamped ? "optionSelected " : " "}>
                            <input
                                type="checkbox"
                                checked={appSettings.readerSettings.widthClamped}
                                onChange={(e) => dispatch(setReaderSettings({ widthClamped: e.target.checked }))}
                            />
                            Clamp
                        </label>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Fit options</div>
                    <div className="options">
                        <div className="row">
                            <button
                                className={appSettings.readerSettings.fitOption === 0 ? "optionSelected " : " "}
                                onClick={() => {
                                    dispatch(setReaderSettings({ fitOption: 0 }));
                                }}
                                title="Free"
                            >
                                <FontAwesomeIcon icon={faExpandArrowsAlt} />
                            </button>
                            <button
                                className={appSettings.readerSettings.fitOption === 1 ? "optionSelected " : " "}
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
                                className={appSettings.readerSettings.fitOption === 2 ? "optionSelected " : " "}
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
                                    (appSettings.readerSettings.fitOption === 3 ? "optionSelected " : " ") + "icon"
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
                            <label
                                className={
                                    (appSettings.readerSettings.maxHeightWidthSelector === "width"
                                        ? "optionSelected "
                                        : "") +
                                    (appSettings.readerSettings.widthClamped ||
                                    appSettings.readerSettings.fitOption !== 0
                                        ? "disabled "
                                        : "")
                                }
                            >
                                <input
                                    type="checkbox"
                                    checked={appSettings.readerSettings.maxHeightWidthSelector === "width"}
                                    onChange={() => {
                                        dispatch(
                                            setReaderSettings({
                                                maxHeightWidthSelector:
                                                    appSettings.readerSettings.maxHeightWidthSelector !== "width"
                                                        ? "width"
                                                        : "none",
                                            })
                                        );
                                    }}
                                />
                                <p>Max Image Width&nbsp;&nbsp;:</p>
                                <input
                                    type="number"
                                    min={0}
                                    max={5000}
                                    value={appSettings.readerSettings.maxWidth}
                                    disabled={appSettings.readerSettings.maxHeightWidthSelector !== "width"}
                                    onChange={(e) => {
                                        let value = e.currentTarget.valueAsNumber;
                                        if (value > 5000) value = 5000;
                                        if (value < 0) value = 0;
                                        dispatch(setReaderSettings({ maxWidth: value }));
                                    }}
                                />
                                px
                            </label>
                            <label
                                className={
                                    (appSettings.readerSettings.maxHeightWidthSelector === "height"
                                        ? "optionSelected "
                                        : "") +
                                    (appSettings.readerSettings.widthClamped ||
                                    appSettings.readerSettings.fitOption !== 0
                                        ? "disabled "
                                        : "")
                                }
                            >
                                <input
                                    type="checkbox"
                                    checked={appSettings.readerSettings.maxHeightWidthSelector === "height"}
                                    onChange={() => {
                                        dispatch(
                                            setReaderSettings({
                                                maxHeightWidthSelector:
                                                    appSettings.readerSettings.maxHeightWidthSelector !== "height"
                                                        ? "height"
                                                        : "none",
                                            })
                                        );
                                    }}
                                />
                                <p>Max Image Height&nbsp;:</p>
                                <input
                                    type="number"
                                    min={0}
                                    max={5000}
                                    value={appSettings.readerSettings.maxHeight}
                                    disabled={appSettings.readerSettings.maxHeightWidthSelector !== "height"}
                                    onChange={(e) => {
                                        let value = e.currentTarget.valueAsNumber;
                                        if (value > 5000) value = 5000;
                                        if (value < 0) value = 0;
                                        dispatch(setReaderSettings({ maxHeight: value }));
                                    }}
                                />
                                px
                            </label>
                        </div>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Reading mode</div>
                    <div className="options">
                        <button
                            className={appSettings.readerSettings.readerTypeSelected === 0 ? "optionSelected" : ""}
                            onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 0 }))}
                        >
                            Vertical Scroll
                        </button>
                        <button
                            className={appSettings.readerSettings.readerTypeSelected === 1 ? "optionSelected" : ""}
                            onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 1 }))}
                        >
                            Left to Right
                        </button>
                        <button
                            className={appSettings.readerSettings.readerTypeSelected === 2 ? "optionSelected" : ""}
                            onClick={() => dispatch(setReaderSettings({ readerTypeSelected: 2 }))}
                        >
                            Right to Left
                        </button>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Pages per Row</div>
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
                <div className="settingItem">
                    <div className="name">Reading side</div>
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
                <div className="settingItem">
                    <div className="name">Scroll Speed(with keys)</div>
                    <div className="options">
                        <label>
                            Scroll&nbsp;A&nbsp;:
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={appSettings.readerSettings.scrollSpeed}
                                onChange={(e) => {
                                    let value = e.currentTarget.valueAsNumber;
                                    if (value > 500) value = 500;
                                    if (value < 1) value = 1;
                                    dispatch(setReaderSettings({ scrollSpeed: value }));
                                }}
                            />
                            px
                        </label>
                        <label>
                            Scroll&nbsp;B&nbsp;:
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={appSettings.readerSettings.largeScrollMultiplier}
                                onChange={(e) => {
                                    let value = e.currentTarget.valueAsNumber;
                                    if (value > 500) value = 500;
                                    if (value < 1) value = 1;
                                    dispatch(setReaderSettings({ largeScrollMultiplier: value }));
                                }}
                            />
                            px
                        </label>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Custom Color Filter</div>
                    <div className="options col">
                        <label
                            className={
                                appSettings.readerSettings.customColorFilter.enabled ? "optionSelected " : ""
                            }
                        >
                            <input
                                type="checkbox"
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
                            />
                            <p>Use Custom Color Filter</p>
                        </label>

                        <InputRange
                            className={"colorRange"}
                            min={0}
                            max={255}
                            value={appSettings.readerSettings.customColorFilter.r}
                            disabled={!appSettings.readerSettings.customColorFilter.enabled}
                            labeled={true}
                            labelText="R:"
                            onChange={(e) => {
                                dispatch(
                                    setReaderSettings({
                                        customColorFilter: {
                                            ...appSettings.readerSettings.customColorFilter,
                                            r: e.currentTarget.valueAsNumber,
                                        },
                                    })
                                );
                            }}
                        />
                        <InputRange
                            className={"colorRange"}
                            min={0}
                            max={255}
                            value={appSettings.readerSettings.customColorFilter.g}
                            disabled={!appSettings.readerSettings.customColorFilter.enabled}
                            labeled={true}
                            labelText="G:"
                            onChange={(e) => {
                                dispatch(
                                    setReaderSettings({
                                        customColorFilter: {
                                            ...appSettings.readerSettings.customColorFilter,
                                            g: e.currentTarget.valueAsNumber,
                                        },
                                    })
                                );
                            }}
                        />
                        <InputRange
                            className={"colorRange"}
                            min={0}
                            max={255}
                            value={appSettings.readerSettings.customColorFilter.b}
                            disabled={!appSettings.readerSettings.customColorFilter.enabled}
                            labeled={true}
                            labelText="B:"
                            onChange={(e) => {
                                dispatch(
                                    setReaderSettings({
                                        customColorFilter: {
                                            ...appSettings.readerSettings.customColorFilter,
                                            b: e.currentTarget.valueAsNumber,
                                        },
                                    })
                                );
                            }}
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
                            onChange={(e) => {
                                dispatch(
                                    setReaderSettings({
                                        customColorFilter: {
                                            ...appSettings.readerSettings.customColorFilter,
                                            a: e.currentTarget.valueAsNumber,
                                        },
                                    })
                                );
                            }}
                        />
                        <InputSelect
                            disabled={!appSettings.readerSettings.customColorFilter.enabled}
                            value={appSettings.readerSettings.customColorFilter.blendMode}
                            labeled={true}
                            labelText="Blend&nbsp;Mode:"
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

                        <label
                            className={
                                appSettings.readerSettings.forceLowBrightness.enabled ? "optionSelected " : ""
                            }
                        >
                            <input
                                type="checkbox"
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
                            />
                            <p>Force Low brightness</p>
                        </label>

                        <InputRange
                            className={"colorRange"}
                            min={0}
                            max={0.9}
                            step={0.05}
                            value={appSettings.readerSettings.forceLowBrightness.value}
                            disabled={!appSettings.readerSettings.forceLowBrightness.enabled}
                            labeled={true}
                            labelText=" "
                            onChange={(e) => {
                                dispatch(
                                    setReaderSettings({
                                        forceLowBrightness: {
                                            ...appSettings.readerSettings.forceLowBrightness,
                                            value: e.currentTarget.valueAsNumber,
                                        },
                                    })
                                );
                            }}
                        />
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Other settings</div>
                    <div className="options col">
                        <label
                            className={
                                (appSettings.readerSettings.variableImageSize ? "optionSelected " : "") +
                                (appSettings.readerSettings.pagesPerRowSelected !== 0 ? "disabled" : "")
                            }
                        >
                            <input
                                type="checkbox"
                                disabled={appSettings.readerSettings.pagesPerRowSelected !== 0}
                                checked={appSettings.readerSettings.variableImageSize}
                                onChange={(e) => {
                                    dispatch(setReaderSettings({ variableImageSize: e.currentTarget.checked }));
                                }}
                            />
                            <p>Double size for double spread pages.</p>
                        </label>
                        <label
                            className={
                                (appSettings.readerSettings.gapBetweenRows ? "optionSelected " : "") +
                                (appSettings.readerSettings.readerTypeSelected !== 0 ? "disabled " : "")
                            }
                        >
                            <input
                                type="checkbox"
                                disabled={appSettings.readerSettings.readerTypeSelected !== 0}
                                checked={appSettings.readerSettings.gapBetweenRows}
                                onChange={(e) => {
                                    dispatch(setReaderSettings({ gapBetweenRows: e.currentTarget.checked }));
                                }}
                            />
                            <p>Gap between rows&nbsp;: </p>
                            <input
                                type="number"
                                value={appSettings.readerSettings.gapSize}
                                disabled={!appSettings.readerSettings.gapBetweenRows}
                                min={0}
                                onChange={(e) => {
                                    let value = e.target.valueAsNumber;
                                    if (!value) value = 0;
                                    dispatch(setReaderSettings({ gapSize: value }));
                                }}
                            />
                            px
                        </label>
                        <label
                            className={appSettings.readerSettings.showPageNumberInZenMode ? "optionSelected" : ""}
                        >
                            <input
                                type="checkbox"
                                checked={appSettings.readerSettings.showPageNumberInZenMode}
                                onChange={(e) => {
                                    dispatch(
                                        setReaderSettings({ showPageNumberInZenMode: e.currentTarget.checked })
                                    );
                                }}
                            />
                            <p>Show Page Number in Zen Mode.</p>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReaderSettings;
