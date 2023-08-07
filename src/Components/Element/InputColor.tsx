import React, { useState, useLayoutEffect } from "react";

const InputColor = ({
    onChange,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    className = "",
    labeled = false,
    disabled = false,
    timeout,
    title,
}: {
    labeled?: boolean;
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    value: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
    disabled?: boolean;
    title?: string;
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
    if (labeled) {
        return (
            <label className={(disabled ? "disabled " : "") + className} title={title}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}
                <input
                    type="color"
                    disabled={disabled}
                    value={valueProxy}
                    onChange={(e) => {
                        const aaa = onChange && onChange(e);
                        if (timeout) {
                            if (onChange) {
                                if (aaa === undefined)
                                    return console.error("InputColor:onChange function must return.");
                                setValueProxy(aaa);
                            } else setValueProxy(e.currentTarget.value);
                        }
                    }}
                />
                {paraAfter && <p>{paraAfter}</p>}
                {labelAfter}
            </label>
        );
    } else
        return (
            <input
                type="color"
                disabled={disabled}
                value={valueProxy}
                onChange={(e) => {
                    const aaa = onChange && onChange(e);
                    if (timeout) {
                        if (onChange) {
                            if (aaa === undefined)
                                return console.error("InputColor:onChange function must return.");
                            setValueProxy(aaa);
                        } else setValueProxy(e.currentTarget.value);
                    }
                }}
            />
        );
};

export default InputColor;
