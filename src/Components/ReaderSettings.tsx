import { faBars, faMinus, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../App";

const ReaderSettings = ({
    makeScrollPos,
    readerRef,
    readerSettingExtender,
    sizePlusRef,
    sizeMinusRef,
}: {
    makeScrollPos: () => void;
    readerRef: React.RefObject<HTMLDivElement>;
    readerSettingExtender: React.RefObject<HTMLButtonElement>;
    sizePlusRef: React.RefObject<HTMLButtonElement>;
    sizeMinusRef: React.RefObject<HTMLButtonElement>;
}) => {
    const { appSettings, setAppSettings } = useContext(AppContext);
    const [isReaderSettingsOpen, setReaderSettingOpen] = useState(false);
    const [readerTypeSelected, setReaderTypeSelected] = useState<0 | 1>(
        appSettings.readerSettings.readerTypeSelected
    );
    const [pagesPerRowSelected, setPagesPerRowSelected] = useState<0 | 1 | 2>(
        appSettings.readerSettings.pagesPerRowSelected
    );
    const [maxWidth, setMaxWidth] = useState<number>(appSettings.readerSettings.widthClamped ? 100 : 500);

    useEffect(() => {
        setMaxWidth(appSettings.readerSettings.widthClamped ? 100 : 500);
        if (appSettings.readerSettings.widthClamped) {
            if (appSettings.readerSettings.readerWidth > 100)
                setAppSettings((init) => {
                    init.readerSettings.readerWidth = 100;
                    return { ...init };
                });
        }
    }, [appSettings.readerSettings.widthClamped]);
    useEffect(() => {
        setAppSettings((init) => {
            init.readerSettings.readerTypeSelected = readerTypeSelected;
            return { ...init };
        });
    }, [readerTypeSelected]);
    useEffect(() => {
        setAppSettings((init) => {
            init.readerSettings.pagesPerRowSelected = pagesPerRowSelected;
            return { ...init };
        });
    }, [pagesPerRowSelected]);
    return (
        <div
            id="readerSettings"
            className={isReaderSettingsOpen ? "" : "closed"}
            onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "q") {
                    e.stopPropagation();
                    setReaderSettingOpen(false);
                    if (readerRef.current) readerRef.current.focus();
                }
            }}
        >
            <h2></h2>
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
                        <label>
                            <input
                                type="number"
                                value={appSettings.readerSettings.readerWidth}
                                min={1}
                                max={maxWidth}
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    makeScrollPos();
                                    setAppSettings((init) => {
                                        let value = e.target.valueAsNumber;
                                        if (!value) value = 0;
                                        init.readerSettings.readerWidth = value >= maxWidth ? maxWidth : value;
                                        return { ...init };
                                    });
                                }}
                            />
                            %
                        </label>
                        <button
                            ref={sizeMinusRef}
                            onClick={() => {
                                makeScrollPos();
                                setAppSettings((init) => {
                                    const steps = appSettings.readerSettings.readerWidth <= 20 ? 5 : 10;
                                    init.readerSettings.readerWidth =
                                        init.readerSettings.readerWidth - steps > maxWidth
                                            ? maxWidth
                                            : init.readerSettings.readerWidth - steps < 1
                                            ? 1
                                            : init.readerSettings.readerWidth - steps;
                                    return { ...init };
                                });
                                // e.currentTarget.dispatchEvent(new MouseEvent(type:"")))
                            }}
                        >
                            <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button
                            ref={sizePlusRef}
                            onClick={() => {
                                makeScrollPos();
                                setAppSettings((init) => {
                                    const steps = appSettings.readerSettings.readerWidth <= 20 ? 5 : 10;
                                    init.readerSettings.readerWidth =
                                        init.readerSettings.readerWidth + steps > maxWidth
                                            ? maxWidth
                                            : init.readerSettings.readerWidth + steps < 1
                                            ? 1
                                            : init.readerSettings.readerWidth + steps;
                                    return { ...init };
                                });
                            }}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <label>
                            <input
                                type="checkbox"
                                checked={appSettings.readerSettings.widthClamped}
                                onChange={(e) =>
                                    setAppSettings((init) => {
                                        init.readerSettings.widthClamped = e.target.checked;
                                        return { ...init };
                                    })
                                }
                            />
                            Clamp
                        </label>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Reader Type</div>
                    <div className="options">
                        <button
                            className={readerTypeSelected === 0 ? "optionSelected" : ""}
                            onClick={() => setReaderTypeSelected(0)}
                        >
                            Infinite Scroll
                        </button>
                        <button
                            className={readerTypeSelected === 1 ? "optionSelected" : ""}
                            onClick={() => setReaderTypeSelected(1)}
                        >
                            Click to Move
                        </button>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Pages per Row</div>
                    <div className="options">
                        <button
                            className={pagesPerRowSelected === 0 ? "optionSelected" : ""}
                            onClick={() => {
                                setPagesPerRowSelected(0);
                                if (pagesPerRowSelected === 0) return;
                                setAppSettings((init) => {
                                    init.readerSettings.readerWidth /= 2;
                                    if (init.readerSettings.readerWidth > maxWidth)
                                        init.readerSettings.readerWidth = maxWidth;
                                    if (init.readerSettings.readerWidth < 1) init.readerSettings.readerWidth = 1;
                                    return { ...init };
                                });
                            }}
                        >
                            1
                        </button>
                        <button
                            className={pagesPerRowSelected === 1 ? "optionSelected" : ""}
                            onClick={() => {
                                setPagesPerRowSelected(1);
                                if (pagesPerRowSelected === 1 || pagesPerRowSelected === 2) return;
                                setAppSettings((init) => {
                                    init.readerSettings.readerWidth *= 2;
                                    if (init.readerSettings.readerWidth > maxWidth)
                                        init.readerSettings.readerWidth = maxWidth;
                                    if (init.readerSettings.readerWidth < 1) init.readerSettings.readerWidth = 1;
                                    return { ...init };
                                });
                            }}
                        >
                            2
                        </button>
                        <button
                            className={pagesPerRowSelected === 2 ? "optionSelected" : ""}
                            onClick={() => {
                                setPagesPerRowSelected(2);
                                if (pagesPerRowSelected === 1 || pagesPerRowSelected === 2) return;
                                setAppSettings((init) => {
                                    init.readerSettings.readerWidth *= 2;
                                    if (init.readerSettings.readerWidth > maxWidth)
                                        init.readerSettings.readerWidth = maxWidth;
                                    if (init.readerSettings.readerWidth < 1) init.readerSettings.readerWidth = 1;
                                    return { ...init };
                                });
                            }}
                        >
                            2 odd
                        </button>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Other settings</div>
                    <div className="options col">
                        <label className={appSettings.readerSettings.variableImageSize ? "optionSelected" : ""}>
                            <input
                                type="checkbox"
                                disabled={appSettings.readerSettings.pagesPerRowSelected !== 0}
                                checked={appSettings.readerSettings.variableImageSize}
                                onChange={(e) => {
                                    setAppSettings((init) => {
                                        init.readerSettings.variableImageSize = e.currentTarget.checked;
                                        return { ...init };
                                    });
                                }}
                            />
                            <p>width*2 for 2-page-span-images/wide images(e.g. image is 2 pages of manga).</p>
                        </label>
                        <label className={appSettings.readerSettings.gapBetweenRows ? "optionSelected" : ""}>
                            <input
                                type="checkbox"
                                disabled={appSettings.readerSettings.readerTypeSelected !== 0}
                                checked={appSettings.readerSettings.gapBetweenRows}
                                onChange={(e) => {
                                    setAppSettings((init) => {
                                        init.readerSettings.gapBetweenRows = e.currentTarget.checked;
                                        return { ...init };
                                    });
                                }}
                            />
                            <p>Gap between rows.</p>
                            <input
                                type="number"
                                value={appSettings.readerSettings.gapSize}
                                disabled={!appSettings.readerSettings.gapBetweenRows}
                                min={0}
                                onChange={(e) => {
                                    setAppSettings((init) => {
                                        let value = e.target.valueAsNumber;
                                        if (!value) value = 0;
                                        init.readerSettings.gapSize = value;
                                        return { ...init };
                                    });
                                }}
                            />
                        </label>
                        <label
                            className={appSettings.readerSettings.showPageNumberInZenMode ? "optionSelected" : ""}
                        >
                            <input
                                type="checkbox"
                                checked={appSettings.readerSettings.showPageNumberInZenMode}
                                onChange={(e) => {
                                    setAppSettings((init) => {
                                        init.readerSettings.showPageNumberInZenMode = e.currentTarget.checked;
                                        return { ...init };
                                    });
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
