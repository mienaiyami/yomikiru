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
    timeout,
}: {
    labeled?: boolean;
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    min?: number | string;
    max?: number | string;
    step?: number;
    value: number;
    noSpin?: boolean;
    onChange: (currentTarget: HTMLInputElement) => void | number;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChange` and active element is event target
     */
    timeout?: [number, (value: number) => void];
    className?: string;
    title?: string;
    disabled?: boolean;
}) => {
    const [valueProxy, setValueProxy] = useState(value);
    const repeater = useRef<NodeJS.Timer | null>(null);
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

    const changeHandler = (currentTarget: HTMLInputElement) => {
        if (!currentTarget.value) currentTarget.value = "0";
        const aaa = onChange(currentTarget);
        if (aaa !== undefined) currentTarget.value = aaa.toString();
        if (timeout) {
            if (aaa === undefined) return console.error("InputNumber:onChange function must return.");
            setValueProxy(aaa);
        }
    };
    const stopRepeater = () => {
        if (repeater.current) {
            clearInterval(repeater.current);
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 200);
        }
        repeater.current = null;
    };
    const ButtonUp = () => (
        <button
            className="spin"
            onMouseUp={stopRepeater}
            onMouseLeave={stopRepeater}
            onMouseOut={stopRepeater}
            onMouseDown={() => {
                if (repeater.current) clearInterval(repeater.current);
                repeater.current = setInterval(() => {
                    if (inputRef.current) {
                        const value = inputRef.current.valueAsNumber || parseFloat(min.toString());
                        if (max && value + step > parseFloat(max.toString()))
                            inputRef.current.value = max.toString();
                        inputRef.current.value = parseFloat((value + step).toFixed(3)).toString();
                        changeHandler(inputRef.current);
                        // setTimeout(() => {
                        //     if (inputRef.current) inputRef.current.focus();
                        // }, 200);
                    }
                }, 100);
            }}
        >
            <FontAwesomeIcon icon={faCaretUp} />
        </button>
    );

    const ButtonDown = () => (
        <button
            className="spin"
            onMouseUp={stopRepeater}
            onMouseLeave={stopRepeater}
            onMouseOut={stopRepeater}
            onMouseDown={() => {
                if (repeater.current) clearInterval(repeater.current);
                repeater.current = setInterval(() => {
                    if (inputRef.current) {
                        const value = inputRef.current.valueAsNumber || parseFloat(min.toString());
                        if (min && value - step < parseFloat(min.toString()))
                            inputRef.current.value = min.toString();
                        inputRef.current.value = parseFloat((value - step).toFixed(3)).toString();
                        changeHandler(inputRef.current);
                        // setTimeout(() => {
                        //     if (inputRef.current) inputRef.current.focus();
                        // }, 200);
                    }
                }, 100);
            }}
        >
            <FontAwesomeIcon icon={faCaretDown} />
        </button>
    );

    if (labelAfter || labelBefore || paraAfter || paraBefore) {
        return (
            <label className={(disabled ? "disabled " : "") + className} title={title}>
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
    } else
        return (
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
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                    onChange={(e) => {
                        changeHandler(e.currentTarget);
                    }}
                    title={title}
                />
                {!noSpin && <ButtonUp />}
                {!noSpin && <ButtonDown />}
            </span>
        );
};

export default InputNumber;
