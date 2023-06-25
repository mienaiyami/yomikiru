import React, { ReactNode } from "react";

export const InputSelect = ({
    onChange,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    labeled = false,
    className = "",
    children,
    options = [],
    disabled = false,
}: {
    labeled?: boolean;
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
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
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}
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
                {paraAfter && <p>{paraAfter}</p>}
                {labelAfter}
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
