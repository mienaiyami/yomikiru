import React, { ReactNode } from "react";

export const InputSelect = ({
    onChange,
    value,
    labelText = "",
    labeled = false,
    className = "",
    children,
    options = [],
    disabled = false,
}: {
    labeled?: boolean;
    labelText?: string;
    value: string;
    onChange: React.ChangeEventHandler<HTMLSelectElement>;
    className?: string;
    //string | JSX.Element | JSX.Element[] |( () => JSX.Element)
    //ReactNode
    children?: ReactNode;
    options?: string[];
    disabled?: boolean;
}) => {
    if (labeled)
        return (
            <label className={(disabled ? "disabled " : "") + className}>
                {labelText && <p>{labelText}</p>}
                <select
                    disabled={disabled}
                    value={value}
                    onChange={onChange}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                >
                    {children}
                    {options.map((e) => (
                        <option value={e} key={e}>
                            {e}
                        </option>
                    ))}
                </select>
            </label>
        );
    return (
        <select
            className={className}
            disabled={disabled}
            value={value}
            onChange={onChange}
            onKeyDown={(e) => {
                if (e.key !== "Escape") {
                    e.stopPropagation();
                }
            }}
        >
            {children}
            {options.map((e) => (
                <option value={e} key={e}>
                    {e}
                </option>
            ))}
        </select>
    );
};
