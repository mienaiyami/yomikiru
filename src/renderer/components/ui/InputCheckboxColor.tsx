import type React from "react";
import { useContext, useLayoutEffect, useState } from "react";
import { useAppContext } from "../../App";

const InputCheckboxColor: React.FC<{
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    value: Color;
    checked: boolean;
    onChangeCheck: React.ChangeEventHandler<HTMLInputElement>;
    onChangeColor?: (color: Color) => void;
    className?: string;
    disabled?: boolean;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChange` and active element is event target
     */
    timeout?: [number, (color: Color) => void];
    showAlpha?: boolean;
}> = ({
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
    showAlpha = true,
}) => {
    const { setColorSelectData } = useAppContext();
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
            {/* <input
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
            /> */}
            <button
                disabled={disabled || !checked}
                className="colorPickerBtn"
                style={{ "--color": value.hsl().string() }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                }}
                onClick={(e) => {
                    setColorSelectData({
                        value: valueProxy,
                        elemBox: e.currentTarget,
                        onChange(color) {
                            // setValueProxy(color.hex());
                            const aaa = onChangeColor && onChangeColor(color);
                            if (timeout) {
                                if (onChangeColor) {
                                    if (aaa === undefined)
                                        return console.error(
                                            "InputCheckboxColor:onChangeColor function must return.",
                                        );
                                    setValueProxy(aaa);
                                } else setValueProxy(color);
                            }
                        },
                        focusBackElem: e.currentTarget,
                        showAlpha,
                    });
                }}
            >
                <span className="colorShow"></span>
            </button>
            {paraAfter && <p>{paraAfter}</p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckboxColor;
