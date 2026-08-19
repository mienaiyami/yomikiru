import {
    cloneElement,
    isValidElement,
    type ReactElement,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import FocusLock from "react-focus-lock";

/** Vertical anchor side of the popover relative to the trigger. */
export type PopoverPlacement = "bottom" | "top";
/** Horizontal alignment of the popover edge relative to the trigger. */
export type PopoverAlign = "start" | "center" | "end";

/** Props passed to a render-prop trigger. */
export type PopoverTriggerArg = {
    /** Whether the popover is currently open. */
    open: boolean;
    /** Toggle the popover. */
    toggle: () => void;
    /** Open the popover (no-op when already open). */
    show: () => void;
    /** Close the popover (no-op when already closed). */
    hide: () => void;
    /** Ref the consumer should attach to the trigger element so the popover anchors correctly. */
    ref: React.RefCallback<HTMLElement>;
    /** ARIA props the consumer should spread on the trigger for assistive tech. */
    ariaProps: {
        "aria-haspopup": "dialog";
        "aria-expanded": boolean;
    };
};

/** Props for {@link Popover}. */
export type PopoverProps = {
    /**
     * Trigger element. Either a single React element (cloned with click + ref +
     * aria props injected) or a render function for full control.
     *
     * When passing a React element, an `onClick` already on it is preserved and
     * called before toggling.
     */
    trigger: ReactElement | ((args: PopoverTriggerArg) => ReactNode);
    /** Popover body — typically a form, slider, menu, etc. */
    children: ReactNode | ((args: { close: () => void }) => ReactNode);
    /** Side of the trigger to anchor to. @default "bottom" */
    placement?: PopoverPlacement;
    /** Horizontal alignment of the popover relative to the trigger. @default "end" */
    align?: PopoverAlign;
    /** Pixel offset between trigger and popover. @default 6 */
    offset?: number;
    /** Optional class merged onto the popover container. */
    className?: string;
    /** ARIA label for the popover dialog. */
    label?: string;
    /** Notified whenever the open state flips. */
    onOpenChange?: (open: boolean) => void;
    /** Controlled open state. When provided, the popover does not manage its own state. */
    open?: boolean;
    /** Disable click-outside dismissal. @default false */
    disableOutsideClickClose?: boolean;
    /** Disable Escape key dismissal. @default false */
    disableEscapeClose?: boolean;
};

/**
 * Lightweight, reusable popover anchored to a trigger element. Handles
 * click-outside and Escape dismissal, traps keyboard focus while open,
 * supports controlled or uncontrolled open state, and supports either a
 * cloneable trigger element or a render prop for advanced cases.
 *
 * @example Basic usage with a button trigger
 * ```tsx
 * <Popover trigger={<button>Open</button>} label="Settings">
 *   <SettingsForm />
 * </Popover>
 * ```
 *
 * @example Controlled with render-prop trigger
 * ```tsx
 * <Popover
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   trigger={({ ref, toggle, ariaProps }) => (
 *     <button ref={ref} onClick={toggle} {...ariaProps}>Filters</button>
 *   )}
 * >
 *   {({ close }) => <FilterPanel onApply={close} />}
 * </Popover>
 * ```
 */
const Popover: React.FC<PopoverProps> = ({
    trigger,
    children,
    placement = "bottom",
    align = "end",
    offset = 6,
    className = "",
    label,
    onOpenChange,
    open: controlledOpen,
    disableOutsideClickClose = false,
    disableEscapeClose = false,
}) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;

    const wrapperRef = useRef<HTMLSpanElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);

    const setOpen = useCallback(
        (next: boolean) => {
            if (!isControlled) setUncontrolledOpen(next);
            onOpenChange?.(next);
        },
        [isControlled, onOpenChange],
    );

    const show = useCallback(() => {
        if (!open) setOpen(true);
    }, [open, setOpen]);

    const hide = useCallback(() => {
        if (open) setOpen(false);
    }, [open, setOpen]);

    const toggle = useCallback(() => {
        setOpen(!open);
    }, [open, setOpen]);

    /**
     * Closes the popover when the user clicks outside of it (and outside the
     * trigger) or presses Escape. Listeners are only attached while open.
     */
    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            if (disableOutsideClickClose) return;
            const target = e.target as Node;
            if (wrapperRef.current?.contains(target)) return;
            if (triggerRef.current?.contains(target)) return;
            hide();
        };
        const onKey = (e: KeyboardEvent) => {
            if (disableEscapeClose) return;
            if (e.key === "Escape") {
                e.stopPropagation();
                hide();
            }
        };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, hide, disableOutsideClickClose, disableEscapeClose]);

    /** Stable ref callback handed to the consumer trigger. */
    const triggerRefCb = useCallback<React.RefCallback<HTMLElement>>((node) => {
        triggerRef.current = node;
    }, []);

    const ariaProps = {
        "aria-haspopup": "dialog" as const,
        "aria-expanded": open,
    };

    let renderedTrigger: ReactNode;
    if (typeof trigger === "function") {
        renderedTrigger = trigger({ open, toggle, show, hide, ref: triggerRefCb, ariaProps });
    } else if (isValidElement(trigger)) {
        const props = trigger.props as { onClick?: (e: React.MouseEvent) => void };
        renderedTrigger = cloneElement(
            trigger as ReactElement,
            {
                ref: triggerRefCb,
                onClick: (e: React.MouseEvent) => {
                    props.onClick?.(e);
                    if (!e.defaultPrevented) toggle();
                },
                ...ariaProps,
            } as Partial<unknown>,
        );
    } else {
        renderedTrigger = trigger;
    }

    const popoverContent = typeof children === "function" ? children({ close: hide }) : children;

    return (
        <span ref={wrapperRef} className={`popover-wrapper ${open ? "open" : ""}`}>
            {renderedTrigger}
            {open && (
                <div
                    className={`popover ${className}`}
                    data-placement={placement}
                    data-align={align}
                    role="dialog"
                    aria-modal="true"
                    aria-label={label}
                    tabIndex={-1}
                    style={{ "--popover-offset": `${offset}px` } as React.CSSProperties}
                    onMouseDown={(e) => {
                        // keep mousedown inside so the document outside-click listener does not close
                        e.stopPropagation();
                    }}
                >
                    <FocusLock returnFocus>
                        {popoverContent}
                    </FocusLock>
                </div>
            )}
        </span>
    );
};

export default Popover;
