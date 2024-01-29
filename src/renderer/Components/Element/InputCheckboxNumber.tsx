import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState, useLayoutEffect, useRef } from "react";

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
    onChangeNum: (currentTarget: HTMLInputElement) => void | number;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChangeNum` and active element is event target
     */
    timeout?: [number, (value: number) => void];
    className?: string;
    disabled?: boolean;
}) => {
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

    const changeHandler = (currentTarget: HTMLInputElement) => {
        if (!currentTarget.value) currentTarget.value = "0";
        const aaa = onChangeNum(currentTarget);
        if (aaa !== undefined) currentTarget.value = aaa.toString();
        if (timeout) {
            if (aaa === undefined) return console.error("InputCheckboxNumber:onChangeNum function must return.");
            setValueProxy(aaa);
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
                const value = inputRef.current.valueAsNumber || parseFloat(min.toString());
                if (max && value + step > parseFloat(max.toString())) inputRef.current.value = max.toString();
                inputRef.current.value = parseFloat((value + step).toFixed(3)).toString();
                changeHandler(inputRef.current);
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
                const value = inputRef.current.valueAsNumber || parseFloat(min.toString());
                if (min && value - step < parseFloat(min.toString())) inputRef.current.value = min.toString();
                inputRef.current.value = parseFloat((value - step).toFixed(3)).toString();
                changeHandler(inputRef.current);
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
            <span className={"input " + (disabled || !checked ? "disabled " : "")}>
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
                        changeHandler(e.currentTarget);
                    }}
                />
                {!noSpin && <ButtonUp />}
                {!noSpin && <ButtonDown />}
            </span>
            {paraAfter && <p>{paraAfter}</p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckboxNumber;
