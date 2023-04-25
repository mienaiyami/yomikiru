import React from "react";

const InputCheckboxNumber = ({
    onChangeNum,
    onChangeCheck,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    checked,
    max = "",
    min = "",
    step = 1,
    className = "",
    disabled = false,
}: {
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    min?: number | string;
    max?: number | string;
    step?: number;
    value: number;
    checked: boolean;
    onChangeCheck: React.ChangeEventHandler<HTMLInputElement>;
    onChangeNum: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
    disabled?: boolean;
}) => {
    return (
        <label className={(disabled ? "disabled " : "") + (checked ? "optionSelected " : "") + className}>
            <input type="checkbox" checked={checked} onChange={onChangeCheck} />
            {labelBefore}
            {paraBefore && <p>{paraBefore}</p>}
            <input
                type="number"
                disabled={disabled || !checked}
                value={value}
                min={min}
                max={max}
                step={step}
                onKeyDown={(e) => {
                    if (e.key !== "Escape") {
                        e.stopPropagation();
                    }
                }}
                onChange={onChangeNum}
            />
            {paraAfter && <p>{paraAfter}</p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckboxNumber;
