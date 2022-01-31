import { faBars, faMinus, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";

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
    const { setAppSettings } = useContext(AppContext);
    const [isReaderSettingsOpen, setReaderSettingOpen] = useState(false);
    const [readerTypeSelected, setReaderTypeSelected] = useState(0);
    const [pagesPerRowSelected, setPagesPerRowSelected] = useState(0);
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
            tabIndex={-1}
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
                        <button
                            ref={sizePlusRef}
                            onClick={() => {
                                makeScrollPos();
                                setAppSettings((init) => {
                                    const steps = Math.max(1, Math.min(5, 1 + Math.log10(init.readerWidth)));
                                    init.readerWidth =
                                        init.readerWidth + steps > 100
                                            ? 100
                                            : init.readerWidth + steps < 0
                                            ? 0
                                            : init.readerWidth + steps;
                                    return { ...init };
                                });
                            }}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <button
                            ref={sizeMinusRef}
                            onClick={() => {
                                makeScrollPos();
                                setAppSettings((init) => {
                                    const steps = Math.max(1, Math.min(5, 1 + Math.log10(init.readerWidth)));
                                    init.readerWidth =
                                        init.readerWidth - steps > 100
                                            ? 100
                                            : init.readerWidth - steps < 0
                                            ? 0
                                            : init.readerWidth - steps;
                                    return { ...init };
                                });
                            }}
                        >
                            <FontAwesomeIcon icon={faMinus} />
                        </button>
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
                            Click for next Page
                        </button>
                    </div>
                </div>
                <div className="settingItem">
                    <div className="name">Pages per Row</div>
                    <div className="options">
                        <button
                            className={pagesPerRowSelected === 0 ? "optionSelected" : ""}
                            onClick={() => setPagesPerRowSelected(0)}
                        >
                            1
                        </button>
                        <button
                            className={pagesPerRowSelected === 1 ? "optionSelected" : ""}
                            onClick={() => setPagesPerRowSelected(1)}
                        >
                            2
                        </button>
                        <button
                            className={pagesPerRowSelected === 2 ? "optionSelected" : ""}
                            onClick={() => setPagesPerRowSelected(2)}
                        >
                            2 alt
                        </button>
                    </div>
                </div>
            </div>
            {/* <Button
                className={`ctrl-menu-item ctrl-menu-extender ${isReaderSettingsOpen ? "open" : ""}`}
                clickAction={() => {
                    setReaderSettingOpen((init) => !init);
                }}
                tooltip="Tools"
            >
                <FontAwesomeIcon icon={isReaderSettingsOpen ? faTimes : faBars} />
            </Button> */}

            {/* <div className="ctrl-menu">
                <Button
                    className="ctrl-menu-item"
                    tooltip="Size +"
                    btnRef={sizePlusRef}
                    clickAction={() => {
                        makeScrollPos();
                        setAppSettings((init) => {
                            const steps = Math.max(1, Math.min(5, 1 + Math.log10(init.readerWidth)));
                            init.readerWidth =
                                init.readerWidth + steps > 100
                                    ? 100
                                    : init.readerWidth + steps < 0
                                    ? 0
                                    : init.readerWidth + steps;
                            return { ...init };
                        });
                    }}
                >
                    <FontAwesomeIcon icon={faPlus} />
                </Button>
                <Button
                    className="ctrl-menu-item"
                    tooltip="Size -"
                    btnRef={sizeMinusRef}
                    clickAction={() => {
                        makeScrollPos();
                        setAppSettings((init) => {
                            const steps = Math.max(1, Math.min(5, 1 + Math.log10(init.readerWidth)));
                            init.readerWidth =
                                init.readerWidth - steps > 100
                                    ? 100
                                    : init.readerWidth - steps < 0
                                    ? 0
                                    : init.readerWidth - steps;
                            return { ...init };
                        });
                    }}
                >
                    <FontAwesomeIcon icon={faMinus} />
                </Button>
            </div> */}
        </div>
    );
};

const Button = (props: any) => {
    return (
        <button
            className={props.className}
            data-tooltip={props.tooltip}
            ref={props.btnRef}
            onClick={props.clickAction}
            // tabIndex={-1}
            disabled={props.disabled}
            // onFocus={(e) => e.currentTarget.blur()}
        >
            {props.children}
        </button>
    );
};

export default ReaderSettings;
