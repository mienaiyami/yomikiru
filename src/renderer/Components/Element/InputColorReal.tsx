import React, { useRef, useState, useEffect, useLayoutEffect, useContext } from "react";
import { AppContext } from "../../App";
import InputNumber from "./InputNumber";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEyeDropper, faSort } from "@fortawesome/free-solid-svg-icons";

import FocusLock, { MoveFocusInside } from "react-focus-lock";

// ! not indented to be used without `AppContext::colorSelectData`

const COLOR_FORMATS = ["RGBA", "HEX", "HSLA"] as const;

const VALID_SLIDER = {
    SL: "SL",
    HUE: "HUE",
    ALPHA: "ALPHA",
} as const;

type ValidSlider = keyof typeof VALID_SLIDER;

const InputColorReal = () => {
    const { colorSelectData, setColorSelectData } = useContext(AppContext);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [formatSelected, setFormatSelected] = useState(0);
    const [color, setColor] = useState(window.color.new());
    const [sliding, setSliding] = useState<ValidSlider | null>(null);
    const ref = useRef<HTMLDivElement | null>(null);
    const slRef = useRef<HTMLDivElement | null>(null);
    const hueRef = useRef<HTMLDivElement | null>(null);
    const alphaRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (colorSelectData) {
            setColor(colorSelectData.value);
            if (!colorSelectData.elemBox) return window.logger.error("MenuList: elem box prop not provided.");
            if (ref.current) {
                let x = 0;
                let y = 0;
                if (colorSelectData.elemBox instanceof HTMLElement) {
                    x = colorSelectData.elemBox.getBoundingClientRect().x;
                    y =
                        colorSelectData.elemBox.getBoundingClientRect().y +
                        colorSelectData.elemBox.getBoundingClientRect().height +
                        4;
                } else if ("x" in colorSelectData.elemBox) {
                    x = colorSelectData.elemBox.x;
                    y = colorSelectData.elemBox.y;
                }
                if (x >= window.innerWidth - ref.current.offsetWidth - 10) {
                    if (colorSelectData.elemBox instanceof HTMLElement)
                        x = colorSelectData.elemBox.getBoundingClientRect().right - ref.current.offsetWidth;
                    else x -= ref.current.offsetWidth;
                }
                if (y >= window.innerHeight - ref.current.offsetHeight - 10) {
                    if (colorSelectData.elemBox instanceof HTMLElement)
                        y -= ref.current.offsetHeight + 8 + colorSelectData.elemBox.getBoundingClientRect().height;
                    else y -= ref.current.offsetHeight;
                    if (y <= window.app.titleBarHeight && colorSelectData.elemBox instanceof HTMLElement) {
                        y = window.app.titleBarHeight;
                        ref.current.style.maxHeight = colorSelectData.elemBox.getBoundingClientRect().top + "px";
                    }
                }
                setPos({ x, y });
                ref.current.focus();
            }
        }
    }, [colorSelectData]);

    useLayoutEffect(() => {
        const ff = () => {
            ref.current?.blur();
        };
        window.addEventListener("wheel", ff);
        return () => {
            window.removeEventListener("wheel", ff);
        };
    }, []);

    useLayoutEffect(() => {
        if (colorSelectData) {
            colorSelectData.onChange && colorSelectData.onChange(color);
        }
    }, [color]);

    const handleMouseUp = () => {
        setSliding(null);
    };
    const calcAndSetHue = (e: MouseEvent | React.MouseEvent) => {
        const target = hueRef.current;
        const slider = hueRef.current?.querySelector(".slider") as HTMLElement;
        if (target && slider) {
            let x = e.clientX - target.getBoundingClientRect().x;
            if (x < 0) x = 0;
            if (x > target.getBoundingClientRect().width) x = target.getBoundingClientRect().width;
            const percent = parseFloat((x / target.getBoundingClientRect().width).toFixed(2));
            setColor((init) => init.hue(Math.round(percent * 360)));
            slider.style.left = (percent * 100).toFixed(2) + "%";
        }
    };
    const calcAndSetAlpha = (e: MouseEvent | React.MouseEvent) => {
        const target = alphaRef.current;
        const slider = alphaRef.current?.querySelector(".slider") as HTMLElement;
        if (target && slider) {
            let x = e.clientX - target.getBoundingClientRect().x;
            if (x < 0) x = 0;
            if (x > target.getBoundingClientRect().width) x = target.getBoundingClientRect().width;
            const percent = parseFloat((x / target.getBoundingClientRect().width).toFixed(2));
            setColor((init) => init.alpha(percent));
            slider.style.left = (percent * 100).toFixed(2) + "%";
        }
    };
    const calcAndSetSL = (e: MouseEvent | React.MouseEvent) => {
        const target = slRef.current;
        const slider = slRef.current?.querySelector(".slider") as HTMLElement;
        if (target && slider) {
            let x = e.clientX - target.getBoundingClientRect().x;
            let y = e.clientY - target.getBoundingClientRect().y;
            if (x < 0) x = 0;
            if (x > target.getBoundingClientRect().width) x = target.getBoundingClientRect().width;
            const percentX = parseFloat((x / target.getBoundingClientRect().width).toFixed(2));
            if (y < 0) y = 0;
            if (y > target.getBoundingClientRect().height) y = target.getBoundingClientRect().height;
            const percentY = parseFloat((y / target.getBoundingClientRect().height).toFixed(2));
            setColor((init) => init.saturationv(percentX * 100).value(100 - percentY * 100));
            slider.style.left = percentX * 100 + "%";
            slider.style.top = percentY * 100 + "%";
        }
    };
    const handleMouseMove = (e: MouseEvent) => {
        if (sliding === "SL") slRef.current && calcAndSetSL(e);
        if (sliding === "HUE") hueRef.current && calcAndSetHue(e);
        if (sliding === "ALPHA") alphaRef.current && calcAndSetAlpha(e);
    };
    useLayoutEffect(() => {
        document.body.style.cursor = "auto";
        if (sliding) {
            document.body.style.cursor = "crosshair";
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            return () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [sliding]);

    return (
        colorSelectData && (
            <FocusLock
                onDeactivation={() => {
                    colorSelectData.focusBackElem && colorSelectData.focusBackElem.focus();
                    // setColorSelectData(null);
                }}
            >
                <div
                    id="realColorInput"
                    tabIndex={-1}
                    onBlur={(e) => {
                        if (
                            e.currentTarget.contains(e.relatedTarget) ||
                            (e.relatedTarget && e.relatedTarget.getAttribute("data-focus-guard") === "true")
                        )
                            return;
                        // colorSelectData.focusBackElem && colorSelectData.focusBackElem.focus();
                        //todo, check if creates any issue or move to FocusLock
                        colorSelectData.onBlur && colorSelectData.onBlur(e);
                        setColorSelectData(null);
                    }}
                    onWheel={(e) => {
                        e.stopPropagation();
                    }}
                    ref={ref}
                    style={{
                        left: pos.x,
                        top: pos.y,
                        // display: display ? "block" : "none",
                        visibility: colorSelectData ? "visible" : "hidden",
                        "--hue": color.hue() + "deg",
                        "--color": color.hsl().string(),
                        "--color-noAlpha": window.color.new(color).alpha(1).hsl().string(),
                    }}
                    onKeyDown={(e) => {
                        if (!e.ctrlKey && !["Tab", " ", "Enter"].includes(e.key)) {
                            e.stopPropagation();
                            e.preventDefault();
                        }
                        if (
                            (e.ctrlKey && e.key === "/") ||
                            (e.shiftKey && e.key === "F10") ||
                            e.key === "ContextMenu"
                        ) {
                            e.currentTarget.focus();
                            e.currentTarget.blur();
                            return;
                        }
                        switch (e.key) {
                            case "Escape":
                                e.currentTarget.focus();
                                e.currentTarget.blur();
                                break;
                            default:
                                break;
                        }
                    }}
                >
                    <div
                        className="SLGradient"
                        ref={slRef}
                        onMouseDown={(e) => {
                            setSliding("SL");
                            calcAndSetSL(e);
                        }}
                    >
                        <span
                            className={`slider SLSlider ${sliding === "SL" ? "sliding" : ""} `}
                            style={{ left: color.saturationv() + "%", top: 100 - color.value() + "%" }}
                        ></span>
                    </div>
                    <div className="block2">
                        <MoveFocusInside>
                            <button
                                className="eyeDropper"
                                onClick={() => {
                                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                    //@ts-ignore
                                    const eyeDropper = new EyeDropper();
                                    eyeDropper.open().then((result: any) => {
                                        setColor((init) => init.hex(result.sRGBHex));
                                    });
                                }}
                            >
                                <FontAwesomeIcon icon={faEyeDropper} />
                            </button>
                        </MoveFocusInside>
                        <div className="hue-opacity">
                            <div
                                className="hueRange"
                                ref={hueRef}
                                onMouseDown={(e) => {
                                    setSliding("HUE");
                                    calcAndSetHue(e);
                                }}
                            >
                                <span
                                    className={`slider hueSlider ${sliding === "HUE" ? "sliding" : ""} `}
                                    style={{ left: color.hue() / 3.6 + "%" }}
                                ></span>
                            </div>
                            <div
                                className="opacityRange"
                                ref={alphaRef}
                                onMouseDown={(e) => {
                                    setSliding("ALPHA");
                                    calcAndSetAlpha(e);
                                }}
                            >
                                <span
                                    className={`slider opacitySlider ${sliding === "ALPHA" ? "sliding" : ""} `}
                                    style={{ left: color.alpha() * 100 + "%" }}
                                ></span>
                            </div>
                        </div>
                    </div>
                    <div className="values">
                        <button
                            onClick={() => {
                                setFormatSelected((init) => (init + 1) % COLOR_FORMATS.length);
                            }}
                        >
                            {/* {COLOR_FORMATS[formatSelected]} */}
                            <FontAwesomeIcon icon={faSort} />
                        </button>
                        {formatSelected === 0 && <RGBAInput color={color} setColor={setColor} key="rgba" />}
                        {formatSelected === 1 && <HEXAInput color={color} setColor={setColor} key="hexa" />}
                        {formatSelected === 2 && <HSLAInput color={color} setColor={setColor} key="hsla" />}
                    </div>
                </div>
            </FocusLock>
        )
    );
};

const RGBAInput = ({
    color,
    setColor,
}: {
    color: Color;
    setColor: React.Dispatch<React.SetStateAction<Color>>;
}) => {
    return (
        <div className="colorValueInput">
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.red(e.valueAsNumber));
                }}
                className="noBG"
                value={Math.round(color.red())}
                min={0}
                max={255}
                labelBefore="R"
                noSpin
            />
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.green(e.valueAsNumber));
                }}
                className="noBG"
                value={Math.round(color.green())}
                min={0}
                max={255}
                labelBefore="G"
                noSpin
            />
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.blue(e.valueAsNumber));
                }}
                className="noBG"
                value={Math.round(color.blue())}
                min={0}
                max={255}
                labelBefore="B"
                noSpin
            />
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.alpha(e.valueAsNumber));
                }}
                className="noBG"
                value={parseFloat(color.alpha().toFixed(2))}
                min={0}
                max={1}
                step={0.05}
                labelBefore="A"
                noSpin
            />
        </div>
    );
};
const HSLAInput = ({
    color,
    setColor,
}: {
    color: Color;
    setColor: React.Dispatch<React.SetStateAction<Color>>;
}) => {
    return (
        <div className="colorValueInput">
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.hue(e.valueAsNumber));
                }}
                className="noBG"
                value={Math.round(color.hue())}
                min={0}
                max={360}
                labelBefore="H°"
                noSpin
            />
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.saturationl(e.valueAsNumber));
                }}
                className="noBG"
                value={Math.round(color.saturationl())}
                min={0}
                max={100}
                labelBefore="S%"
                noSpin
            />
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.lightness(e.valueAsNumber));
                }}
                className="noBG"
                value={Math.round(color.lightness())}
                min={0}
                max={100}
                labelBefore="L%"
                noSpin
            />
            <InputNumber
                onChange={(e) => {
                    setColor((init) => init.alpha(e.valueAsNumber));
                }}
                className="noBG"
                value={parseFloat(color.alpha().toFixed(2))}
                min={0}
                max={1}
                step={0.1}
                labelBefore="A"
                noSpin
            />
        </div>
    );
};
const HEXAInput = ({
    color,
    setColor,
}: {
    color: Color;
    setColor: React.Dispatch<React.SetStateAction<Color>>;
}) => {
    const [value, setValue] = useState(color.hexa());
    useLayoutEffect(() => {
        const timeout = setTimeout(() => {
            try {
                const newColor = window.color.new(value);
                setColor(newColor);
            } catch {
                //
            }
        }, 1000);
        return () => {
            clearTimeout(timeout);
        };
    }, [value]);
    useLayoutEffect(() => {
        setValue(color.hexa());
    }, [color]);
    return (
        <div className="colorValueInput">
            <label className="noBG">
                HEX
                <input
                    type="text"
                    value={value}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                    }}
                    onChange={(e) => {
                        setValue(e.currentTarget.value);
                        // try {
                        // const newColor = window.color.new(e.currentTarget.value);
                        // setColor(newColor);
                        // } catch {
                        //     //
                        // }
                    }}
                />
            </label>
        </div>
    );
};

export default InputColorReal;
