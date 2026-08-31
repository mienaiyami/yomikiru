import type React from "react";

export type SelectionCheckboxProps = {
    checked: boolean;
    /**
     * Native mixed state (`aria-checked="mixed"`). Default off.
     * Do not combine with {@link SelectionCheckboxProps.excluded}.
     */
    indeterminate?: boolean;
    /**
     * Exclude polarity: dash visual, `aria-checked` false. Default off.
     * Do not combine with {@link SelectionCheckboxProps.indeterminate}.
     */
    excluded?: boolean;
    /** Called with the click modifiers so callers can support Shift+range select. */
    onToggle: (opts: { shiftKey: boolean }) => void;
    ariaLabel: string;
    className?: string;
    inputClassName?: string;
    boxClassName?: string;
    /**
     * Native input tab order. Defaults to `-1` so bulk row-select UIs skip the box.
     * Overlay hosts that treat Space as click still receive that key unless the input stops it.
     */
    tabIndex?: number;
};

/**
 * Reusable selection checkbox wrapper used by row and gallery selection UIs.
 *
 * Implemented as a `<label>` so the full label area is clickable. The input is
 * kept as the accessibility source-of-truth while visual styling is handled by
 * the sibling `.checkBox` span. {@link SelectionCheckboxProps.indeterminate} and
 * {@link SelectionCheckboxProps.excluded} are opt-in; omitted callers stay binary.
 */
const SelectionCheckbox: React.FC<SelectionCheckboxProps> = ({
    checked,
    indeterminate = false,
    excluded = false,
    onToggle,
    ariaLabel,
    className = "",
    inputClassName = "",
    boxClassName = "",
    tabIndex = -1,
}) => {
    const mixed = indeterminate && !checked && !excluded;
    const ariaChecked: boolean | "mixed" = mixed ? "mixed" : checked;

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
            <input
                type="checkbox"
                tabIndex={tabIndex}
                checked={checked}
                readOnly
                ref={(node) => {
                    if (!node) return;
                    /* React has no indeterminate prop; the DOM property must be set on the node */
                    node.indeterminate = mixed;
                }}
                aria-checked={ariaChecked}
                data-excluded={excluded && !checked ? "true" : undefined}
                className={inputClassName}
                onKeyDown={(e) => {
                    if (e.key !== " ") return;
                    /* Modal overlay treats Space as click; keep that key on this control */
                    e.preventDefault();
                    e.stopPropagation();
                    onToggle({ shiftKey: e.shiftKey });
                }}
            />
            <span className={boxClassName || "checkBox"} />
        </label>
    );
};

export default SelectionCheckbox;
