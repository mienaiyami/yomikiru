import { faBars, faMinus, faPlus, faTimes, faArrowsAltV, faArrowsAltH } from "@fortawesome/free-solid-svg-icons";
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
                setAppSettings((init) => {
                    init.readerSettings.readerWidth = 100;
                    return { ...init };
                });
        }
    }, [appSettings.readerSettings.widthClamped]);
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
                                onKeyDown={(e) => {
                                    if (e.key !== "Escape") {
                                        e.stopPropagation();
                                    }
                                }}
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
                        <label className={appSettings.readerSettings.widthClamped ? "optionSelected " : " "}>
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
                    <div className="name">Fit options</div>
                    <div className="options">
                        <button
                            className={appSettings.readerSettings.fitOption === 1 ? "optionSelected " : " "}
                            onClick={() => {
                                setAppSettings((init) => {
                                    if (init.readerSettings.fitOption === 1) init.readerSettings.fitOption = 0;
                                    else init.readerSettings.fitOption = 1;
                                    return { ...init };
                                });
                            }}
                            title="Fit Vertically"
                        >
                            <FontAwesomeIcon icon={faArrowsAltV} />
                        </button>
                        <button
                            className={appSettings.readerSettings.fitOption === 2 ? "optionSelected " : " "}
                            onClick={() => {
                                setAppSettings((init) => {
                                    if (init.readerSettings.fitOption === 2) init.readerSettings.fitOption = 0;
                                    else init.readerSettings.fitOption = 2;
                                    return { ...init };
                                });
                            }}
                            title="Fit Horizontally"
                        >
                            <FontAwesomeIcon icon={faArrowsAltH} />
                        </button>
                        <button
                            className={appSettings.readerSettings.fitOption === 3 ? "optionSelected " : " "}
                            onClick={() => {
                                setAppSettings((init) => {
                                    if (init.readerSettings.fitOption === 3) init.readerSettings.fitOption = 0;
                                    else init.readerSettings.fitOption = 3;
                                    return { ...init };
                                });
                            }}
                            title="Original"
                            style={{ fontWeight: "bold" }}
                        >
                            1:1
                        </button>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Reading mode</div>
                    <div className="options">
                        <button
                            className={appSettings.readerSettings.readerTypeSelected === 0 ? "optionSelected" : ""}
                            onClick={() =>
                                setAppSettings((init) => {
                                    init.readerSettings.readerTypeSelected = 0;
                                    return { ...init };
                                })
                            }
                        >
                            Vertical Scroll
                        </button>
                        <button
                            className={appSettings.readerSettings.readerTypeSelected === 1 ? "optionSelected" : ""}
                            onClick={() =>
                                setAppSettings((init) => {
                                    init.readerSettings.readerTypeSelected = 1;
                                    return { ...init };
                                })
                            }
                        >
                            Left to Right
                        </button>
                        <button
                            className={appSettings.readerSettings.readerTypeSelected === 2 ? "optionSelected" : ""}
                            onClick={() =>
                                setAppSettings((init) => {
                                    init.readerSettings.readerTypeSelected = 2;
                                    return { ...init };
                                })
                            }
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
                                    setAppSettings((init) => {
                                        init.readerSettings.pagesPerRowSelected = 0;

                                        init.readerSettings.readerWidth /= 2;
                                        if (init.readerSettings.readerWidth > maxWidth)
                                            init.readerSettings.readerWidth = maxWidth;
                                        if (init.readerSettings.readerWidth < 1)
                                            init.readerSettings.readerWidth = 1;

                                        return { ...init };
                                    });
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
                                setAppSettings((init) => {
                                    if (init.readerSettings.pagesPerRowSelected === 0) {
                                        init.readerSettings.readerWidth *= 2;
                                        if (init.readerSettings.readerWidth > maxWidth)
                                            init.readerSettings.readerWidth = maxWidth;
                                        if (init.readerSettings.readerWidth < 1)
                                            init.readerSettings.readerWidth = 1;
                                    }

                                    init.readerSettings.pagesPerRowSelected = 1;

                                    return { ...init };
                                });
                            }}
                        >
                            2
                        </button>
                        <button
                            className={
                                appSettings.readerSettings.pagesPerRowSelected === 2 ? "optionSelected" : ""
                            }
                            onClick={() => {
                                setAppSettings((init) => {
                                    if (init.readerSettings.pagesPerRowSelected === 0) {
                                        init.readerSettings.readerWidth *= 2;
                                        if (init.readerSettings.readerWidth > maxWidth)
                                            init.readerSettings.readerWidth = maxWidth;
                                        if (init.readerSettings.readerWidth < 1)
                                            init.readerSettings.readerWidth = 1;
                                    }

                                    init.readerSettings.pagesPerRowSelected = 2;

                                    return { ...init };
                                });
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
                                setAppSettings((init) => {
                                    init.readerSettings.readingSide = 0;
                                    return { ...init };
                                });
                            }}
                        >
                            LTR
                        </button>
                        <button
                            className={appSettings.readerSettings.readingSide === 1 ? "optionSelected" : ""}
                            disabled={appSettings.readerSettings.pagesPerRowSelected === 0}
                            onClick={() => {
                                setAppSettings((init) => {
                                    init.readerSettings.readingSide = 1;
                                    return { ...init };
                                });
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
                                max={100}
                                value={appSettings.readerSettings.scrollSpeed}
                                onChange={(e) => {
                                    setAppSettings((init) => {
                                        let value = e.currentTarget.valueAsNumber;
                                        if (value > 100) value = 100;
                                        if (value < 1) value = 1;
                                        init.readerSettings.scrollSpeed = value;
                                        return { ...init };
                                    });
                                }}
                            />
                            px
                        </label>
                        <label>
                            Scroll&nbsp;B&nbsp;:
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={appSettings.readerSettings.largeScrollMultiplier}
                                onChange={(e) => {
                                    setAppSettings((init) => {
                                        let value = e.currentTarget.valueAsNumber;
                                        if (value > 100) value = 100;
                                        if (value < 1) value = 1;
                                        init.readerSettings.largeScrollMultiplier = value;
                                        return { ...init };
                                    });
                                }}
                            />
                            px
                        </label>
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
                                    setAppSettings((init) => {
                                        init.readerSettings.gapBetweenRows = e.currentTarget.checked;
                                        return { ...init };
                                    });
                                }}
                            />
                            <p>Gap between rows&nbsp;: </p>
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
                            px
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

                        <label
                            title={'Disable "Size Clamp" to enable'}
                            className={appSettings.readerSettings.widthClamped ? "disabled" : ""}
                        >
                            <p>Max Image Width&nbsp;:</p>
                            <input
                                type="number"
                                min={0}
                                max={5000}
                                value={appSettings.readerSettings.maxWidth}
                                disabled={appSettings.readerSettings.widthClamped}
                                onChange={(e) => {
                                    setAppSettings((init) => {
                                        let value = e.currentTarget.valueAsNumber;
                                        if (value > 5000) value = 5000;
                                        if (value < 0) value = 0;
                                        init.readerSettings.maxWidth = value;
                                        return { ...init };
                                    });
                                }}
                            />
                            px
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReaderSettings;
