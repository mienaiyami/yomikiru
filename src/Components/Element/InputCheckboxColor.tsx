import React from "react";

const InputCheckboxColor = ({
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
}: {
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    value: string;
    checked: boolean;
    onChangeCheck: React.ChangeEventHandler<HTMLInputElement>;
    onChangeColor: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
    disabled?: boolean;
}) => {
    return (
        <label className={(disabled ? "disabled " : "") + (checked ? "optionSelected " : "") + className}>
            <input type="checkbox" checked={checked} onChange={onChangeCheck} />
            {labelBefore}
            {paraBefore && <p>{paraBefore}</p>}
            <input type="color" disabled={disabled || !checked} value={value} onChange={onChangeColor} />
            {paraAfter && <p>{paraAfter}</p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckboxColor;
