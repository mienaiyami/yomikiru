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
    title,
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
    onChange: React.ChangeEventHandler<HTMLInputElement>;
}) => {
    if (labeled)
        return (
            <label className={(disabled ? "disabled " : "") + (labelText && "labeled ") + className} title={title}>
                {labelText && <p>{labelText}</p>}
                <input
                    type="range"
                    disabled={disabled}
                    onChange={onChange}
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
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
