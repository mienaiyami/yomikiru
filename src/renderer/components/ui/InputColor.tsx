import type React from "react";
import { useLayoutEffect, useState } from "react";
import { useAppContext } from "../../App";

const InputColor: React.FC<{
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
    showAlpha?: boolean;
}> = ({
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

    const onClickHandler = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setColorSelectData({
            value: valueProxy,
            elemBox: e.currentTarget,
            onChange(color) {
                // setValueProxy(color.hex());
                const aaa = onChange?.(color);
                if (timeout) {
                    if (onChange) {
                        if (aaa === undefined) return console.error("InputColor:onChange function must return.");
                        setValueProxy(aaa);
                    } else setValueProxy(color);
                }
            },
            focusBackElem: e.currentTarget,
            showAlpha,
        });
    };
    if (labeled) {
        return (
            <label className={(disabled ? "disabled " : "") + className} title={title}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}
                <button
                    disabled={disabled}
                    className="colorPickerBtn"
                    style={{ "--color": value.hsl().string() }}
                    onClick={onClickHandler}
                    onKeyDown={(e) => {
                        if (e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                        }
                    }}
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
        );
};

export default InputColor;
