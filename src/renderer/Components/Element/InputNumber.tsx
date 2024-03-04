import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState, useLayoutEffect, useRef } from "react";

const InputNumber = ({
    onChange,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    max = "",
    min = "",
    step = 1,
    className = "",
    disabled = false,
    noSpin = false,
    title,
    tooltip,
    timeout,
}: {
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    min?: number | string;
    max?: number | string;
    step?: number;
    value: number;
    noSpin?: boolean;
    onChange?: (currentTarget: HTMLInputElement) => void | number;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChange` and active element is event target
     */
    timeout?: [number, (value: number) => void];
    className?: string;
    title?: string;
    tooltip?: string;
    disabled?: boolean;
}) => {
    if (!onChange && !timeout) throw new Error("InputNumber: onChange or timeout must be defined");
    const [valueProxy, setValueProxy] = useState(value);
    const repeater = useRef<NodeJS.Timer | null>(null);
    const mouseDownRef = useRef(false);
    // const [lastEvent, setLastEvent] = useState<React.ChangeEvent<HTMLInputElement> | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    useLayoutEffect(() => {
        let timeoutid: NodeJS.Timeout;
        if (timeout) {
            timeoutid = setTimeout(() => {
                if (value !== valueProxy) timeout[1](valueProxy);
            }, timeout[0]);
        }
        return () => {
            clearTimeout(timeoutid);
        };
    }, [valueProxy]);
    useLayoutEffect(() => {
        // stopRepeater();
        setValueProxy(value);
    }, [value]);

    useLayoutEffect(() => {
        return () => {
            stopRepeater();
        };
    }, []);

    const changeHandler = () => {
        const currentTarget = inputRef.current;
        if (!currentTarget) {
            console.error("InputNumber: inputRef.current is null");
            return;
        }
        if (!currentTarget.value) currentTarget.value = "0";
        const aaa = onChange && onChange(currentTarget);
        if (aaa !== undefined) currentTarget.value = aaa.toString();
        if (timeout) {
            if (aaa === undefined) {
                setValueProxy(currentTarget.valueAsNumber ?? parseFloat(min.toString()));
            } else setValueProxy(aaa);
        }
    };
    const stopRepeater = () => {
        if (mouseDownRef.current) mouseDownRef.current = false;
        if (repeater.current) {
            clearInterval(repeater.current);
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 200);
        }
        repeater.current = null;
    };
    const ButtonUp = () => {
        const valueUp = () => {
            if (inputRef.current) {
                const value = inputRef.current.valueAsNumber ?? parseFloat(min.toString());
                inputRef.current.value = parseFloat((value + step).toFixed(3)).toString();
                if (max !== undefined && value + step > parseFloat(max.toString()))
                    inputRef.current.value = max.toString();
                changeHandler();
            }
        };
        return (
            <button
                className="spin"
                onMouseLeave={stopRepeater}
                // onMouseOut={stopRepeater}
                onMouseUp={stopRepeater}
                onMouseDown={() => {
                    mouseDownRef.current = true;
                    if (repeater.current) clearInterval(repeater.current);
                    valueUp();
                    setTimeout(() => {
                        if (mouseDownRef.current) repeater.current = setInterval(valueUp, 100);
                    }, 500);
                }}
            >
                <FontAwesomeIcon icon={faCaretUp} />
            </button>
        );
    };

    const ButtonDown = () => {
        const valueDown = () => {
            if (inputRef.current) {
                const value = inputRef.current.valueAsNumber ?? parseFloat(min.toString());
                inputRef.current.value = parseFloat((value - step).toFixed(3)).toString();
                if (min !== undefined && value - step < parseFloat(min.toString()))
                    inputRef.current.value = min.toString();
                changeHandler();
            }
        };
        return (
            <button
                className="spin"
                onMouseLeave={stopRepeater}
                // onMouseOut={stopRepeater}
                onMouseUp={stopRepeater}
                onMouseDown={() => {
                    mouseDownRef.current = true;
                    if (repeater.current) clearInterval(repeater.current);
                    valueDown();
                    setTimeout(() => {
                        if (mouseDownRef.current) repeater.current = setInterval(valueDown, 100);
                    }, 500);
                }}
            >
                <FontAwesomeIcon icon={faCaretDown} />
            </button>
        );
    };

    if (labelAfter || labelBefore || paraAfter || paraBefore) {
        return (
            <label className={(disabled ? "disabled " : "") + className} title={title} data-tooltip={tooltip}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}{" "}
                <span className={"input " + (disabled ? "disabled " : "")}>
                    <input
                        type="number"
                        ref={inputRef}
                        disabled={disabled}
                        value={valueProxy}
                        min={min}
                        max={max}
                        step={step}
                        onKeyDown={(e) => {
                            if (!["Escape", "Tab"].includes(e.key)) {
                                e.stopPropagation();
                            }
                        }}
                        onChange={(e) => {
                            const value = e.currentTarget.valueAsNumber;
                            if (min !== undefined && value < parseFloat(min.toString()))
                                e.currentTarget.value = min.toString();
                            if (max !== undefined && value > parseFloat(max.toString()))
                                e.currentTarget.value = max.toString();
                            changeHandler();
                        }}
                    />
                    {!noSpin && <ButtonUp />}
                    {!noSpin && <ButtonDown />}
                </span>
                {paraAfter && <p>{paraAfter}</p>}
                {labelAfter}
            </label>
        );
    } else
        return (
            <span className={"input " + (disabled ? "disabled " : "")} data-tooltip={tooltip}>
                <input
                    type="number"
                    ref={inputRef}
                    disabled={disabled}
                    value={valueProxy}
                    min={min}
                    max={max}
                    step={step}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                    onChange={(e) => {
                        const value = e.currentTarget.valueAsNumber;
                        if (min !== undefined && value < parseFloat(min.toString()))
                            e.currentTarget.value = min.toString();
                        if (max !== undefined && value > parseFloat(max.toString()))
                            e.currentTarget.value = max.toString();
                        changeHandler();
                    }}
                    title={title}
                />
                {!noSpin && <ButtonUp />}
                {!noSpin && <ButtonDown />}
            </span>
        );
};

export default InputNumber;
