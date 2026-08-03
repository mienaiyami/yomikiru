import type React from "react";

export type SelectionCheckboxProps = {
    checked: boolean;
    /** Called with the click modifiers so callers can support Shift+range select. */
    onToggle: (opts: { shiftKey: boolean }) => void;
    ariaLabel: string;
    className?: string;
    inputClassName?: string;
    boxClassName?: string;
};

/**
 * Reusable selection checkbox wrapper used by row and gallery selection UIs.
 *
 * Implemented as a `<label>` so the full label area is clickable. The input is
 * kept as the accessibility source-of-truth while visual styling is handled by
 * the sibling `.checkBox` span.
 */
const SelectionCheckbox: React.FC<SelectionCheckboxProps> = ({
    checked,
    onToggle,
    ariaLabel,
    className = "",
    inputClassName = "",
    boxClassName = "",
}) => {
    return (
        <label
            className={className}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle({ shiftKey: e.shiftKey });
            }}
            aria-label={ariaLabel}
        >
            <input type="checkbox" tabIndex={-1} checked={checked} readOnly className={inputClassName} />
            <span className={boxClassName || "checkBox"} />
        </label>
    );
};

export default SelectionCheckbox;
