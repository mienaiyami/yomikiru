import React, { useState, useLayoutEffect } from "react";

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
    onChangeCheck: React.ChangeEventHandler<HTMLInputElement>;
    onChangeNum: React.ChangeEventHandler<HTMLInputElement>;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChangeNum` and active element is event target
     */
    timeout?: [number, (value: number) => void];
    className?: string;
    disabled?: boolean;
}) => {
    const [valueProxy, setValueProxy] = useState(value);
    useLayoutEffect(() => {
        let timeoutid: NodeJS.Timeout;
        if (timeout) {
            timeoutid = setTimeout(() => {
                timeout[1](valueProxy);
            }, timeout[0]);
        }
        return () => {
            clearTimeout(timeoutid);
        };
    }, [valueProxy]);
    useLayoutEffect(() => {
        setValueProxy(value);
    }, [value]);
    return (
        <label className={(disabled ? "disabled " : "") + (checked ? "optionSelected " : "") + className}>
            <span className={`toggle-area ${checked ? "on" : "off"} `}>
                <span className={`toggle-state`}></span>
            </span>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={onChangeCheck} />
            {labelBefore}
            {paraBefore && <p>{paraBefore}</p>}
            <input
                type="number"
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
                    const aaa = onChangeNum(e);
                    if (timeout) {
                        if (aaa === undefined)
                            return console.error("InputCheckboxNumber:onChangeNum function must return.");
                        setValueProxy(aaa);
                    }
                }}
            />
            {paraAfter && <p>{paraAfter}</p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckboxNumber;
