import React, { useState, useLayoutEffect, useContext } from "react";
import { AppContext } from "../../App";

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
    value: Color;
    onChange?: (color: Color) => void;
    className?: string;
    disabled?: boolean;
    title?: string;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChange` and active element is event target
     */
    timeout?: [number, (color: Color) => void];
}) => {
    const { setColorSelectData } = useContext(AppContext);
    const [valueProxy, setValueProxy] = useState(value);
    useLayoutEffect(() => {
        let timeoutid: NodeJS.Timeout;
        if (timeout) {
            timeoutid = setTimeout(() => {
                if (value.string() !== valueProxy.string()) timeout[1](valueProxy);
            }, timeout[0]);
        }
        return () => {
            clearTimeout(timeoutid);
        };
    }, [valueProxy]);
    useLayoutEffect(() => {
        setValueProxy(value);
    }, [value]);

    const onClickHandler = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setColorSelectData({
            value: valueProxy,
            elemBox: e.currentTarget,
            onChange(color) {
                // setValueProxy(color.hex());
                const aaa = onChange && onChange(color);
                if (timeout) {
                    if (onChange) {
                        if (aaa === undefined) return console.error("InputColor:onChange function must return.");
                        setValueProxy(aaa);
                    } else setValueProxy(color);
                }
            },
            focusBackElem: e.currentTarget,
        });
    };
    if (labeled) {
        return (
            <label className={(disabled ? "disabled " : "") + className} title={title}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}
                {/* <input
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
                /> */}
                <button
                    disabled={disabled}
                    className="colorPickerBtn"
                    style={{ "--color": value.hsl().string() }}
                    onClick={onClickHandler}
                >
                    <span className="colorShow"></span>
                </button>
                {paraAfter && <p>{paraAfter}</p>}
                {labelAfter}
            </label>
        );
    } else
        return (
            <button
                disabled={disabled}
                className="colorPickerBtn"
                style={{ "--color": value.hsl().string() }}
                onClick={onClickHandler}
            >
                <span className="colorShow"></span>
            </button>
            // <input
            //     type="color"
            //     disabled={disabled}
            //     value={valueProxy}
            //     onChange={(e) => {
            //         const aaa = onChange && onChange(e);
            //         if (timeout) {
            //             if (onChange) {
            //                 if (aaa === undefined)
            //                     return console.error("InputColor:onChange function must return.");
            //                 setValueProxy(aaa);
            //             } else setValueProxy(e.currentTarget.value);
            //         }
            //     }}
            // />
        );
};

export default InputColor;
