import React, { useState, useLayoutEffect } from "react";

const InputRange = ({
    labeled = false,
    labelText = "",
    min,
    max,
    step = 1,
    value,
    onChange,
    className = "",
    disabled = false,
    title,
    timeout,
}: {
    labeled?: boolean;
    labelText?: string;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    value: number;
    className?: string;
    title?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void | number;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChange` and active element is event target
     */
    timeout?: [number, (value: number) => void];
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
    if (labeled)
        return (
            <label className={(disabled ? "disabled " : "") + (labelText && "labeled ") + className} title={title}>
                {labelText && <p>{labelText}</p>}
                <input
                    type="range"
                    disabled={disabled}
                    onChange={(e) => {
                        const aaa = onChange && onChange(e);
                        if (timeout) {
                            if (onChange) {
                                if (aaa === undefined)
                                    return console.error("InputRange:onChange function must return.");
                                setValueProxy(aaa);
                            } else setValueProxy(e.currentTarget.valueAsNumber);
                        }
                    }}
                    min={min}
                    max={max}
                    step={step}
                    style={{
                        "--value": ((valueProxy / max) * 100).toFixed() + "%",
                    }}
                    value={valueProxy}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                />
                {/* <span className="shaded"></span> */}
                <p>{valueProxy}</p>
            </label>
        );
    return (
        <input
            type="range"
            disabled={disabled}
            onChange={(e) => {
                const aaa = onChange && onChange(e);
                if (timeout) {
                    if (onChange) {
                        if (aaa === undefined) return console.error("InputRange:onChange function must return.");
                        setValueProxy(aaa);
                    } else setValueProxy(e.currentTarget.valueAsNumber);
                }
            }}
            className={className}
            min={min}
            max={max}
            step={step}
            value={valueProxy}
            title={title}
            onKeyDown={(e) => {
                if (e.key !== "Escape") {
                    e.stopPropagation();
                }
            }}
        />
    );
};

export default InputRange;
