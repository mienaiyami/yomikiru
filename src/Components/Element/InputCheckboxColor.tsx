import React, { useState, useLayoutEffect } from "react";

const InputCheckboxColor = ({
    onChangeColor,
    onChangeCheck,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    checked,
    className = "",
    disabled = false,
    timeout,
}: {
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    value: string;
    checked: boolean;
    onChangeCheck: React.ChangeEventHandler<HTMLInputElement>;
    onChangeColor?: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
    disabled?: boolean;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChange` and active element is event target
     */
    timeout?: [number, (value: string) => void];
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
            <input type="checkbox" checked={checked} disabled={disabled} onChange={onChangeCheck} />
            {labelBefore}
            {paraBefore && <p>{paraBefore}</p>}
            <input
                type="color"
                disabled={disabled || !checked}
                value={valueProxy}
                onChange={(e) => {
                    const aaa = onChangeColor && onChangeColor(e);
                    if (timeout) {
                        if (onChangeColor) {
                            if (aaa === undefined)
                                return console.error("InputCheckboxColor:onChangeColor function must return.");
                            setValueProxy(aaa);
                        } else setValueProxy(e.currentTarget.value);
                    }
                }}
            />
            {paraAfter && <p>{paraAfter}</p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckboxColor;
