import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppSelector } from "@store/hooks";
import { getShortcutsMapped } from "@store/shortcuts";
import { keyFormatter } from "@utils/keybindings";
import type { CSSProperties, KeyboardEvent, ReactNode, RefCallback, RefObject } from "react";
import { useEffect, useRef } from "react";
import { shallowEqual } from "react-redux";
import Popover, { type PopoverAlign, type PopoverPlacement } from "./Popover";
import SelectionCheckbox from "./SelectionCheckbox";

/** One row in {@link InputMultiSelect}. */
export type InputMultiSelectOption = {
    value: string;
    label: string;
    disabled?: boolean;
    /** Optional inline row style for generic consumers. */
    style?: CSSProperties;
};

/**
 * Master-row aggregate when {@link InputMultiSelectProps.triState} is on.
 * `"on"` means every enabled option is included (checked).
 */
export type InputMultiSelectTriStateAggregate = "off" | "on" | "exclude" | "mixed";

/** Closed-state context for {@link InputMultiSelectProps.renderActivatorLabel}. */
export type InputMultiSelectActivatorContext = {
    selectedValues: readonly string[];
    selectedOptions: readonly InputMultiSelectOption[];
    isEmpty: boolean;
};

/** Props for {@link InputMultiSelect}. */
export type InputMultiSelectProps = {
    /** Selected option values (controlled). Include list when {@link InputMultiSelectProps.triState}. */
    value: readonly string[];
    /**
     * Replace the selection; panel stays open while toggling.
     * Second argument is passed only when {@link InputMultiSelectProps.triState} is on.
     */
    onChange: (next: readonly string[], excluded?: readonly string[]) => void;
    options: readonly InputMultiSelectOption[];
    /** Closed label when nothing is selected. */
    emptyLabel: string;
    /** Closed label when more than one value is selected. */
    multipleLabel: (count: number) => string;
    /** Accessible name for the activator and popover. */
    "aria-label": string;
    /**
     * Toggle-all row label; receives whether every enabled option is selected.
     * When {@link InputMultiSelectProps.triState}, the second argument is the master aggregate.
     */
    toggleAllLabel: (allSelected: boolean, aggregate?: InputMultiSelectTriStateAggregate) => string;
    /** Per-option checkbox accessible name; defaults to the option label. */
    optionAriaLabel?: (option: InputMultiSelectOption) => string;
    /** Optional tooltip on the closed activator (e.g. explain empty selection). */
    activatorTitle?: string;
    className?: string;
    activatorClassName?: string;
    popoverClassName?: string;
    disabled?: boolean;
    /** When true, show the select/unselect-all control above the list. */
    showToggleAll?: boolean;
    /**
     * Opt-in include / exclude / off cycle per row. Default off (binary checkboxes).
     * When on, {@link InputMultiSelectProps.excludedValues} is the exclude list.
     */
    triState?: boolean;
    /** Exclude list when {@link InputMultiSelectProps.triState} is on. Ignored otherwise. */
    excludedValues?: readonly string[];
    align?: PopoverAlign;
    placement?: PopoverPlacement;
    /** Fully override closed activator body (chevron is still rendered). */
    renderActivatorLabel?: (ctx: InputMultiSelectActivatorContext) => ReactNode;
    /** Override one option row body; row shell handles focus and toggle. */
    renderOption?: (ctx: {
        option: InputMultiSelectOption;
        checked: boolean;
        excluded?: boolean;
        checkbox: ReactNode;
    }) => ReactNode;
    /** Optional content above the row list. */
    header?: ReactNode;
    /** Optional content below the row list. */
    footer?: ReactNode;
};

/**
 * Include/exclude aggregate of enabled option values versus the two controlled lists.
 */
const triStateAggregateOf = (
    enabledValues: readonly string[],
    included: ReadonlySet<string>,
    excluded: ReadonlySet<string>,
): InputMultiSelectTriStateAggregate => {
    if (enabledValues.length === 0) return "off";
    let includeCount = 0;
    let excludeCount = 0;
    for (const value of enabledValues) {
        if (included.has(value)) includeCount += 1;
        else if (excluded.has(value)) excludeCount += 1;
    }
    if (includeCount === enabledValues.length) return "on";
    if (excludeCount === enabledValues.length) return "exclude";
    if (includeCount === 0 && excludeCount === 0) return "off";
    return "mixed";
};

/**
 * Multi-value select built on {@link Popover}. Option rows are focusable divs with
 * {@link SelectionCheckbox}; the full row toggles selection. Toggle-all is a button
 * unless {@link InputMultiSelectProps.triState}, then it is a 3-state checkbox row.
 * Escape closes and refocuses the activator.
 */
const InputMultiSelect = ({
    value,
    onChange,
    options,
    emptyLabel,
    multipleLabel,
    "aria-label": ariaLabel,
    toggleAllLabel,
    optionAriaLabel,
    activatorTitle,
    className = "",
    activatorClassName = "",
    popoverClassName = "",
    disabled = false,
    showToggleAll = true,
    triState = false,
    excludedValues = [],
    align = "start",
    placement = "bottom",
    renderActivatorLabel,
    renderOption,
    header,
    footer,
}: InputMultiSelectProps) => {
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const rowRefs = useRef<(HTMLElement | null)[]>([]);
    const activatorRef = useRef<HTMLButtonElement | null>(null);

    const selectedSet = new Set(value);
    const excludedSet = new Set(triState ? excludedValues : []);
    const enabledOptions = options.filter((opt) => !opt.disabled);
    const enabledValues = enabledOptions.map((opt) => opt.value);
    const allSelected = enabledOptions.length > 0 && enabledOptions.every((opt) => selectedSet.has(opt.value));
    const triAggregate = triState ? triStateAggregateOf(enabledValues, selectedSet, excludedSet) : undefined;
    const selectedOptions = options.filter((opt) => selectedSet.has(opt.value));
    const hasSelection = value.length > 0 || (triState && excludedValues.length > 0);
    const activatorCtx: InputMultiSelectActivatorContext = {
        selectedValues: value,
        selectedOptions,
        isEmpty: !hasSelection,
    };

    const defaultActivatorLabel = (): ReactNode => {
        if (!hasSelection) return emptyLabel;
        if (value.length === 1 && (!triState || excludedValues.length === 0)) {
            return selectedOptions[0]?.label ?? emptyLabel;
        }
        if (triState && value.length === 0 && excludedValues.length === 1) {
            return options.find((opt) => opt.value === excludedValues[0])?.label ?? emptyLabel;
        }
        return multipleLabel(value.length);
    };

    const emitBinary = (next: readonly string[]) => {
        onChange(next);
    };

    const emitTriState = (included: readonly string[], excluded: readonly string[]) => {
        onChange(included, excluded);
    };

    const toggleValue = (optionValue: string) => {
        if (triState) {
            if (selectedSet.has(optionValue)) {
                emitTriState(
                    value.filter((v) => v !== optionValue),
                    [...excludedValues, optionValue],
                );
                return;
            }
            if (excludedSet.has(optionValue)) {
                emitTriState(
                    value,
                    excludedValues.filter((v) => v !== optionValue),
                );
                return;
            }
            emitTriState([...value, optionValue], excludedValues);
            return;
        }
        if (selectedSet.has(optionValue)) {
            emitBinary(value.filter((v) => v !== optionValue));
            return;
        }
        emitBinary([...value, optionValue]);
    };

    const toggleAll = () => {
        if (triState) {
            if (triAggregate === "off" || triAggregate === "mixed") {
                emitTriState(enabledValues, []);
                return;
            }
            if (triAggregate === "on") {
                emitTriState([], enabledValues);
                return;
            }
            emitTriState([], []);
            return;
        }
        if (allSelected) {
            emitBinary([]);
            return;
        }
        emitBinary(enabledValues);
    };

    /** Focusable panel rows in DOM order (toggle-all when shown, then each option). */
    const focusableRows = (): HTMLElement[] =>
        rowRefs.current.filter((node): node is HTMLElement => node != null && node.tabIndex >= 0);

    const stepRowFocus = (current: HTMLElement, delta: number) => {
        const rows = focusableRows();
        const idx = rows.indexOf(current);
        if (idx < 0) return;
        const next = rows[(idx + delta + rows.length) % rows.length];
        next?.focus();
        next?.scrollIntoView?.({ behavior: "instant", block: "nearest" });
    };

    const closeAndReturnFocus = (close: () => void) => {
        close();
        requestAnimationFrame(() => activatorRef.current?.focus());
    };

    const onRowKeyDown = (e: KeyboardEvent<HTMLElement>, close: () => void, activate?: () => void) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeAndReturnFocus(close);
            return;
        }

        e.stopPropagation();
        const keyStr = keyFormatter(e, false);
        if (keyStr === "") return;

        if (shortcutsMapped.listDown.includes(keyStr) || keyStr === "right") {
            e.preventDefault();
            stepRowFocus(e.currentTarget, 1);
            return;
        }
        if (shortcutsMapped.listUp.includes(keyStr) || keyStr === "left") {
            e.preventDefault();
            stepRowFocus(e.currentTarget, -1);
            return;
        }
        if (shortcutsMapped.listSelect.includes(keyStr) || keyStr === "space") {
            e.preventDefault();
            activate?.();
        }
    };

    const optionCheckbox = (
        option: InputMultiSelectOption,
        checked: boolean,
        excluded: boolean,
        toggle: () => void,
    ) => (
        <SelectionCheckbox
            className="rowSelectCheck inputMultiSelectRowCheck noBG"
            boxClassName="checkBox"
            checked={checked}
            excluded={excluded}
            onToggle={() => toggle()}
            ariaLabel={optionAriaLabel?.(option) ?? option.label}
            tabIndex={-1}
        />
    );

    const toggleAllLabelText = toggleAllLabel(allSelected, triAggregate);

    const panelBody = (close: () => void) => {
        let rowSlot = 0;
        const bindRowRef = () => {
            const slot = rowSlot;
            rowSlot += 1;
            return (node: HTMLElement | null) => {
                rowRefs.current[slot] = node;
            };
        };

        const toggleAllCheckbox =
            triState && triAggregate ? (
                <SelectionCheckbox
                    className="rowSelectCheck inputMultiSelectRowCheck noBG"
                    boxClassName="checkBox"
                    checked={triAggregate === "on"}
                    excluded={triAggregate === "exclude"}
                    indeterminate={triAggregate === "mixed"}
                    onToggle={() => toggleAll()}
                    ariaLabel={toggleAllLabelText}
                    tabIndex={-1}
                />
            ) : null;

        return (
            <fieldset className="inputMultiSelectPanel" aria-label={ariaLabel}>
                {header}
                {showToggleAll && options.length > 0 ? (
                    triState ? (
                        <div
                            ref={bindRowRef()}
                            role="option"
                            aria-label={toggleAllLabelText}
                            aria-selected={triAggregate === "on" || triAggregate === "exclude"}
                            tabIndex={0}
                            className="inputMultiSelectRow inputMultiSelectToggleAll"
                            onClick={toggleAll}
                            onMouseEnter={(e) => e.currentTarget.focus()}
                            onKeyDown={(e) => onRowKeyDown(e, close, toggleAll)}
                        >
                            {toggleAllCheckbox}
                            <span className="inputMultiSelectRowLabel">{toggleAllLabelText}</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            ref={bindRowRef()}
                            className="inputMultiSelectRow inputMultiSelectToggleAll"
                            onClick={toggleAll}
                            onMouseEnter={(e) => e.currentTarget.focus()}
                            onKeyDown={(e) => onRowKeyDown(e, close, toggleAll)}
                        >
                            {toggleAllLabelText}
                        </button>
                    )
                ) : null}
                {options.map((option) => {
                    const checked = selectedSet.has(option.value);
                    const excluded = excludedSet.has(option.value);
                    const toggle = () => {
                        if (option.disabled) return;
                        toggleValue(option.value);
                    };
                    const checkbox = optionCheckbox(option, checked, excluded, toggle);
                    return (
                        <div
                            key={option.value}
                            ref={bindRowRef()}
                            role="option"
                            aria-selected={checked || excluded}
                            aria-disabled={option.disabled || undefined}
                            tabIndex={option.disabled ? -1 : 0}
                            className={`inputMultiSelectRow${option.disabled ? " is-disabled" : ""}`}
                            style={option.style}
                            onClick={toggle}
                            onMouseEnter={(e) => {
                                if (!option.disabled) e.currentTarget.focus();
                            }}
                            onKeyDown={(e) => onRowKeyDown(e, close, toggle)}
                        >
                            {renderOption ? (
                                renderOption({ option, checked, excluded, checkbox })
                            ) : (
                                <>
                                    {checkbox}
                                    <span className="inputMultiSelectRowLabel" aria-hidden>
                                        {option.label}
                                    </span>
                                </>
                            )}
                        </div>
                    );
                })}
                {footer}
            </fieldset>
        );
    };

    return (
        <span className={`inputMultiSelect ${className}`.trim()}>
            <Popover
                label={ariaLabel}
                align={align}
                placement={placement}
                className={`inputMultiSelectPopover ${popoverClassName}`.trim()}
                trigger={({ ref, toggle, ariaProps, open }) => (
                    <button
                        type="button"
                        ref={(node) => {
                            activatorRef.current = node;
                            (ref as RefCallback<HTMLButtonElement>)(node);
                        }}
                        className={[
                            "inputMultiSelectActivator",
                            activatorClassName,
                            open ? "is-open" : "",
                            hasSelection ? "has-selection" : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        disabled={disabled}
                        title={activatorTitle}
                        data-tooltip={activatorTitle}
                        onClick={toggle}
                        aria-label={ariaLabel}
                        {...ariaProps}
                    >
                        <span className="inputMultiSelectActivatorBody">
                            {renderActivatorLabel ? renderActivatorLabel(activatorCtx) : defaultActivatorLabel()}
                        </span>
                        <FontAwesomeIcon icon={faChevronDown} className="inputMultiSelectChevron" />
                    </button>
                )}
            >
                {({ close }) => (
                    <>
                        <FocusFirstPanelRow rowRefs={rowRefs} />
                        {panelBody(close)}
                    </>
                )}
            </Popover>
        </span>
    );
};

type FocusFirstPanelRowProps = {
    rowRefs: RefObject<(HTMLElement | null)[]>;
};

/**
 * Focuses the first panel row when the popover opens so list shortcuts work immediately.
 */
const FocusFirstPanelRow = ({ rowRefs }: FocusFirstPanelRowProps) => {
    useEffect(() => {
        const rows = rowRefs.current;
        if (!rows) return;
        const first =
            rows.find(
                (node) =>
                    node != null &&
                    node.tabIndex >= 0 &&
                    !("disabled" in node && (node as HTMLButtonElement).disabled),
            ) ?? null;
        first?.focus();
    }, [rowRefs]);
    return null;
};

export default InputMultiSelect;
