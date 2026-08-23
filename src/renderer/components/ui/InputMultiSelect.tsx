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

/** Closed-state context for {@link InputMultiSelectProps.renderActivatorLabel}. */
export type InputMultiSelectActivatorContext = {
    selectedValues: readonly string[];
    selectedOptions: readonly InputMultiSelectOption[];
    isEmpty: boolean;
};

/** Props for {@link InputMultiSelect}. */
export type InputMultiSelectProps = {
    /** Selected option values (controlled). */
    value: readonly string[];
    /** Replace the full selection; panel stays open while toggling. */
    onChange: (next: readonly string[]) => void;
    options: readonly InputMultiSelectOption[];
    /** Closed label when nothing is selected. */
    emptyLabel: string;
    /** Closed label when more than one value is selected. */
    multipleLabel: (count: number) => string;
    /** Accessible name for the activator and popover. */
    "aria-label": string;
    /** Toggle-all row label; receives whether every enabled option is selected. */
    toggleAllLabel: (allSelected: boolean) => string;
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
    align?: PopoverAlign;
    placement?: PopoverPlacement;
    /** Fully override closed activator body (chevron is still rendered). */
    renderActivatorLabel?: (ctx: InputMultiSelectActivatorContext) => ReactNode;
    /** Override one option row body; row shell handles focus and toggle. */
    renderOption?: (ctx: { option: InputMultiSelectOption; checked: boolean; checkbox: ReactNode }) => ReactNode;
    /** Optional content above the row list. */
    header?: ReactNode;
    /** Optional content below the row list. */
    footer?: ReactNode;
};

/**
 * Multi-value select built on {@link Popover}. Option rows are focusable divs with
 * {@link SelectionCheckbox}; the full row toggles selection. Toggle-all is a button.
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
    const enabledOptions = options.filter((opt) => !opt.disabled);
    const allSelected = enabledOptions.length > 0 && enabledOptions.every((opt) => selectedSet.has(opt.value));
    const selectedOptions = options.filter((opt) => selectedSet.has(opt.value));
    const activatorCtx: InputMultiSelectActivatorContext = {
        selectedValues: value,
        selectedOptions,
        isEmpty: value.length === 0,
    };

    const defaultActivatorLabel = (): ReactNode => {
        if (value.length === 0) return emptyLabel;
        if (value.length === 1) return selectedOptions[0]?.label ?? emptyLabel;
        return multipleLabel(value.length);
    };

    const toggleValue = (optionValue: string) => {
        if (selectedSet.has(optionValue)) {
            onChange(value.filter((v) => v !== optionValue));
            return;
        }
        onChange([...value, optionValue]);
    };

    const toggleAll = () => {
        if (allSelected) {
            onChange([]);
            return;
        }
        onChange(enabledOptions.map((opt) => opt.value));
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

    const optionCheckbox = (option: InputMultiSelectOption, checked: boolean, toggle: () => void) => (
        <SelectionCheckbox
            className="rowSelectCheck inputMultiSelectRowCheck"
            boxClassName="checkBox"
            checked={checked}
            onToggle={() => toggle()}
            ariaLabel={optionAriaLabel?.(option) ?? option.label}
            tabIndex={-1}
        />
    );

    const panelBody = (close: () => void) => {
        let rowSlot = 0;
        const bindRowRef = () => {
            const slot = rowSlot;
            rowSlot += 1;
            return (node: HTMLElement | null) => {
                rowRefs.current[slot] = node;
            };
        };

        return (
            <div className="inputMultiSelectPanel" role="group" aria-label={ariaLabel}>
                {header}
                {showToggleAll && options.length > 0 ? (
                    <button
                        type="button"
                        ref={bindRowRef()}
                        className="inputMultiSelectRow inputMultiSelectToggleAll"
                        onClick={toggleAll}
                        onMouseEnter={(e) => e.currentTarget.focus()}
                        onKeyDown={(e) => onRowKeyDown(e, close, toggleAll)}
                    >
                        {toggleAllLabel(allSelected)}
                    </button>
                ) : null}
                {options.map((option) => {
                    const checked = selectedSet.has(option.value);
                    const toggle = () => {
                        if (option.disabled) return;
                        toggleValue(option.value);
                    };
                    const checkbox = optionCheckbox(option, checked, toggle);
                    return (
                        <div
                            key={option.value}
                            ref={bindRowRef()}
                            role="option"
                            aria-selected={checked}
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
                                renderOption({ option, checked, checkbox })
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
            </div>
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
                            value.length > 0 ? "has-selection" : "",
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
