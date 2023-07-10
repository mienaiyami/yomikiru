import React, { useState, useLayoutEffect } from "react";

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
    labeled = false,
    className = "",
    disabled = false,
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
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void | number;
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
    // const [lastEvent, setLastEvent] = useState<React.ChangeEvent<HTMLInputElement> | null>(null);
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
                    type="number"
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
                        const aaa = onChange(e);
                        if (timeout) {
                            if (aaa === undefined)
                                return console.error("InputNumber:onChange function must return.");
                            setValueProxy(aaa);
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
                type="number"
                className={className}
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
                    const aaa = onChange(e);
                    if (timeout) {
                        if (aaa === undefined) return console.error("InputNumber:onChange function must return.");
                        setValueProxy(aaa);
                    }
                }}
                title={title}
            />
        );
};

export default InputNumber;
