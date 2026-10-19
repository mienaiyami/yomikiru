/**
 * Widget chrome keys (submit, click, toggle). Not catalog commands: these
 * chords are not user-rebinding and must not steal typing in search fields.
 */

/** Enter without Shift, Shift+Enter, or Space. */
export type WidgetActivateKind = "enter" | "shiftEnter" | "space";

/** Fields {@link widgetActivateKind} reads from a keyboard event. */
export type WidgetKeyFields = {
    key: string;
    code?: string;
    shiftKey: boolean;
    /** IME composition; activate keys are ignored while this is true. */
    isComposing?: boolean;
};

/** Prevents the browser default when a chrome handler runs. */
type WidgetActivateRun = {
    preventDefault: () => void;
};

/**
 * Handlers for {@link onWidgetActivateKey}. `activate` is the fallback when a
 * more specific key is omitted. Shift+Enter falls back to `enter` then `activate`.
 * Space never falls back to `enter`.
 */
export type WidgetActivateHandlers = {
    activate?: () => void;
    enter?: () => void;
    shiftEnter?: () => void;
    space?: () => void;
};

/**
 * Classifies Enter, Shift+Enter, or Space. Returns null for other keys and
 * while {@link WidgetKeyFields.isComposing} is set.
 */
export const widgetActivateKind = (keyEvent: WidgetKeyFields): WidgetActivateKind | null => {
    if (keyEvent.isComposing) return null;
    const isEnter = keyEvent.key === "Enter" || keyEvent.code === "Enter";
    const isSpace = keyEvent.key === " " || keyEvent.code === "Space";
    if (isEnter) return keyEvent.shiftKey ? "shiftEnter" : "enter";
    if (isSpace) return "space";
    return null;
};

/**
 * True for Enter and Shift+Enter. Space is not included.
 */
export const isWidgetEnterKey = (keyEvent: WidgetKeyFields): boolean => {
    const kind = widgetActivateKind(keyEvent);
    return kind === "enter" || kind === "shiftEnter";
};

/**
 * Picks enter / shiftEnter / space, with Shift+Enter falling back to enter.
 */
const handlerForKind = (kind: WidgetActivateKind, handlers: WidgetActivateHandlers): (() => void) | undefined => {
    if (kind === "enter") return handlers.enter ?? handlers.activate;
    if (kind === "shiftEnter") return handlers.shiftEnter ?? handlers.enter ?? handlers.activate;
    return handlers.space ?? handlers.activate;
};

/**
 * Runs the matching chrome handler. Returns true when a handler ran.
 *
 * Pass a function to treat Enter, Shift+Enter, and Space as the same action
 * (click a label or non-button control). Pass {@link WidgetActivateHandlers}
 * when those keys mean different things (submit vs find previous).
 */
export const onWidgetActivateKey = (
    keyEvent: WidgetKeyFields & WidgetActivateRun,
    run: (() => void) | WidgetActivateHandlers,
): boolean => {
    const kind = widgetActivateKind(keyEvent);
    if (!kind) return false;
    const handlers: WidgetActivateHandlers = typeof run === "function" ? { activate: run } : run;
    const action = handlerForKind(kind, handlers);
    if (!action) return false;
    keyEvent.preventDefault();
    action();
    return true;
};

/**
 * Clicks {@link HTMLElement.click} on Enter, Shift+Enter, or Space.
 * For non-button chrome (`label`, `div`, `a` without href). Real `<button>`
 * already has native activation.
 */
export const clickOnWidgetActivateKey = (
    keyEvent: WidgetKeyFields &
        WidgetActivateRun & {
            currentTarget: { click: () => void };
        },
): boolean => onWidgetActivateKey(keyEvent, () => keyEvent.currentTarget.click());
