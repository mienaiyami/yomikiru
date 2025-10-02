import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";

const InputCheckboxNumber = ({
    onChangeNum,
    onChangeCheck,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    checked,
    max = "",
    min = "",
    step = 1,
    className = "",
    noSpin = false,
    disabled = false,
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
    checked: boolean;
    noSpin?: boolean;
    onChangeCheck: React.ChangeEventHandler<HTMLInputElement>;
    onChangeNum?: (currentTarget: HTMLInputElement) => void | number;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChangeNum` and active element is event target
     */
    timeout?: [number, (value: number) => void];
    className?: string;
    disabled?: boolean;
}) => {
    if (!onChangeNum && !timeout) throw new Error("InputCheckboxNumber: onChangeNum or timeout must be defined");
    const [valueProxy, setValueProxy] = useState(value);
    const repeater = useRef<NodeJS.Timer | null>(null);
    const mouseDownRef = useRef(false);
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
            console.error("InputCheckboxNumber: inputRef.current is null");
            return;
        }
        if (!currentTarget.value) currentTarget.value = "0";
        const aaa = onChangeNum?.(currentTarget);
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

    const valueUp = () => {
        if (inputRef.current) {
            const value = inputRef.current.valueAsNumber ?? parseFloat(min.toString());
            inputRef.current.value = parseFloat((value + step).toFixed(3)).toString();
            if (max !== undefined && value + step > parseFloat(max.toString()))
                inputRef.current.value = max.toString();
            changeHandler();
        }
    };

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
        <label
            className={(disabled ? "disabled " : "") + (checked ? "optionSelected " : "") + className}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
            }}
        >
            <span className={`toggle-area ${checked ? "on" : "off"} `}>
                <span className={`toggle-state`}></span>
            </span>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={onChangeCheck} />
            {labelBefore}
            {paraBefore && <p>{paraBefore}</p>}
            <span className={`input ${disabled || !checked ? "disabled " : ""}`}>
                <input
                    type="number"
                    ref={inputRef}
                    disabled={disabled || !checked}
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
                />
                {!noSpin && (
                    <button
                        className="spin"
                        onMouseLeave={stopRepeater}
                        onMouseUp={stopRepeater}
                        onMouseDown={() => {
                            mouseDownRef.current = true;
                            if (repeater.current) clearInterval(repeater.current);
                            valueUp();
                            setTimeout(() => {
                                if (repeater.current) clearInterval(repeater.current);
                                if (mouseDownRef.current) repeater.current = setInterval(valueUp, 100);
                            }, 500);
                        }}
                    >
                        <FontAwesomeIcon icon={faCaretUp} />
                    </button>
                )}
                {!noSpin && (
                    <button
                        className="spin"
                        onMouseLeave={stopRepeater}
                        onMouseUp={stopRepeater}
                        onMouseDown={() => {
                            mouseDownRef.current = true;
                            if (repeater.current) clearInterval(repeater.current);
                            valueDown();
                            setTimeout(() => {
                                if (repeater.current) clearInterval(repeater.current);
                                if (mouseDownRef.current) repeater.current = setInterval(valueDown, 100);
                            }, 500);
                        }}
                    >
                        <FontAwesomeIcon icon={faCaretDown} />
                    </button>
                )}
            </span>
            {paraAfter && <p>{paraAfter}</p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckboxNumber;
