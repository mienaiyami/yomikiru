import React from "react";

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
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
    disabled?: boolean;
}) => {
    if (labeled) {
        return (
            <label className={(disabled ? "disabled " : "") + className}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}
                <input
                    type="number"
                    disabled={disabled}
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                    onChange={onChange}
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
                value={value}
                min={min}
                max={max}
                step={step}
                onKeyDown={(e) => {
                    if (e.key !== "Escape") {
                        e.stopPropagation();
                    }
                }}
                onChange={onChange}
            />
        );
};

export default InputNumber;
