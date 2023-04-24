import React from "react";

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
}: {
    labeled?: boolean;
    labelText?: string;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    value: number;
    className?: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
}) => {
    if (labeled)
        return (
            <label className={(disabled ? "disabled " : "") + className}>
                {labelText && <p>{labelText}</p>}
                <input
                    type="range"
                    disabled={disabled}
                    onChange={onChange}
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                />
                <p>{value}</p>
            </label>
        );
    return (
        <input
            type="range"
            disabled={disabled}
            onChange={onChange}
            className={className}
            min={min}
            max={max}
            step={step}
            value={value}
        />
    );
};

export default InputRange;
