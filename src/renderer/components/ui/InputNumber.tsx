import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createRendererLogger } from "@utils/logger";
import { useLayoutEffect, useRef, useState } from "react";

const log = createRendererLogger("components/ui/InputNumber");

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
    integerOnly = false,
    title,
    tooltip,
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
    noSpin?: boolean;
    /** When true, block decimal entry and truncate pasted or spun values to whole numbers. */
    integerOnly?: boolean;
    onChange?: (currentTarget: HTMLInputElement) => void | number;
    /**
     * `[time_in_ms, fn_on_timeout]`
     * `fn_on_timeout` is called after time had passed after `onChange` and active element is event target
     */
    timeout?: [number, (value: number) => void];
    className?: string;
    title?: string;
    tooltip?: string;
    disabled?: boolean;
}) => {
    if (!onChange && !timeout) throw new Error("InputNumber: onChange or timeout must be defined");

    const blockIntegerOnlyKey = (key: string) =>
        integerOnly && (key === "." || key === "," || key === "e" || key === "E");

    const normalizeInputValue = (input: HTMLInputElement) => {
        const parsed = input.valueAsNumber;
        if (!Number.isFinite(parsed)) return parsed;
        if (!integerOnly) return parsed;
        const whole = Math.trunc(parsed);
        if (whole !== parsed) input.value = whole.toString();
        return whole;
    };

    const [valueProxy, setValueProxy] = useState(value);
    const repeater = useRef<NodeJS.Timer | null>(null);
    const mouseDownRef = useRef(false);
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

    const changeHandler = () => {
        const currentTarget = inputRef.current;
        if (!currentTarget) {
            log.error("inputRef is null (DOM not mounted)");
            return;
        }
        if (!currentTarget.value) currentTarget.value = "0";
        const aaa = onChange?.(currentTarget);
        if (aaa !== undefined) currentTarget.value = aaa.toString();
        if (timeout) {
            if (aaa === undefined) {
                const fallback = parseFloat(min.toString());
                const parsed = normalizeInputValue(currentTarget);
                setValueProxy(Number.isFinite(parsed) ? parsed : fallback);
            } else setValueProxy(aaa);
        }
    };
    const stopRepeater = () => {
        if (mouseDownRef.current) mouseDownRef.current = false;
        if (repeater.current) {
            clearInterval(repeater.current);
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 200);
        }
        repeater.current = null;
    };

    // todo : refactor, remove component from inside
    // biome-ignore lint/correctness/noNestedComponentDefinitions: <creating this outside doesnt bring any benefits in perf, over creating it inside>
    const ButtonUp = () => {
        const valueUp = () => {
            if (inputRef.current) {
                const value = inputRef.current.valueAsNumber ?? parseFloat(min.toString());
                inputRef.current.value = parseFloat((value + step).toFixed(3)).toString();
                if (max !== undefined && value + step > parseFloat(max.toString()))
                    inputRef.current.value = max.toString();
                changeHandler();
            }
        };
        return (
            <button
                className="spin"
                onMouseLeave={stopRepeater}
                // onMouseOut={stopRepeater}
                onMouseUp={stopRepeater}
                onMouseDown={() => {
                    mouseDownRef.current = true;
                    if (repeater.current) clearInterval(repeater.current);
                    valueUp();
                    setTimeout(() => {
                        // yea maybe not the best way to do it but too lazy to make new ref
                        if (repeater.current) clearInterval(repeater.current);
                        if (mouseDownRef.current) repeater.current = setInterval(valueUp, 100);
                    }, 500);
                }}
            >
                <FontAwesomeIcon icon={faCaretUp} />
            </button>
        );
    };

    // biome-ignore lint/correctness/noNestedComponentDefinitions: <creating this outside doesnt bring any benefits in perf, over creating it inside>
    const ButtonDown = () => {
        const valueDown = () => {
            if (inputRef.current) {
                const value = inputRef.current.valueAsNumber ?? parseFloat(min.toString());
                inputRef.current.value = parseFloat((value - step).toFixed(3)).toString();
                if (min !== undefined && value - step < parseFloat(min.toString()))
                    inputRef.current.value = min.toString();
                changeHandler();
            }
        };
        return (
            <button
                className="spin"
                onMouseLeave={stopRepeater}
                // onMouseOut={stopRepeater}
                onMouseUp={stopRepeater}
                onMouseDown={() => {
                    mouseDownRef.current = true;
                    if (repeater.current) clearInterval(repeater.current);
                    valueDown();
                    setTimeout(() => {
                        if (repeater.current) clearInterval(repeater.current);
                        if (mouseDownRef.current) repeater.current = setInterval(valueDown, 100);
                    }, 500);
                }}
            >
                <FontAwesomeIcon icon={faCaretDown} />
            </button>
        );
    };

    if (labelAfter || labelBefore || paraAfter || paraBefore) {
        return (
            <label className={(disabled ? "disabled " : "") + className} title={title} data-tooltip={tooltip}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}{" "}
                <span className={`input ${disabled ? "disabled " : ""}`}>
                    <input
                        type="number"
                        ref={inputRef}
                        disabled={disabled}
                        value={valueProxy}
                        min={min}
                        max={max}
                        step={step}
                        onKeyDown={(e) => {
                            if (blockIntegerOnlyKey(e.key)) {
                                e.preventDefault();
                                return;
                            }
                            if (!["Escape", "Tab"].includes(e.key)) {
                                e.stopPropagation();
                            }
                        }}
                        onChange={(e) => {
                            const value = normalizeInputValue(e.currentTarget);
                            if (Number.isFinite(value)) {
                                if (min !== undefined && value < parseFloat(min.toString()))
                                    e.currentTarget.value = min.toString();
                                if (max !== undefined && value > parseFloat(max.toString()))
                                    e.currentTarget.value = max.toString();
                            }
                            changeHandler();
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
            <span className={`input ${disabled ? "disabled " : ""}`} data-tooltip={tooltip}>
                <input
                    type="number"
                    ref={inputRef}
                    disabled={disabled}
                    value={valueProxy}
                    min={min}
                    max={max}
                    step={step}
                    onKeyDown={(e) => {
                        if (blockIntegerOnlyKey(e.key)) {
                            e.preventDefault();
                            return;
                        }
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                    onChange={(e) => {
                        const value = normalizeInputValue(e.currentTarget);
                        if (Number.isFinite(value)) {
                            if (min !== undefined && value < parseFloat(min.toString()))
                                e.currentTarget.value = min.toString();
                            if (max !== undefined && value > parseFloat(max.toString()))
                                e.currentTarget.value = max.toString();
                        }
                        changeHandler();
                    }}
                    title={title}
                />
                {!noSpin && <ButtonUp />}
                {!noSpin && <ButtonDown />}
            </span>
        );
};

export default InputNumber;
