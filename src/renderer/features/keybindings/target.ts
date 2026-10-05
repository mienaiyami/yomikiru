import {
    isKeyboardCode,
    type KeyboardCode,
    type LiveKeyboardTrigger,
    type LivePointerTrigger,
    type LiveTrigger,
    type PointerButton,
} from "@common/keybindings";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA"]);

/**
 * `KeyboardEvent.key` values that are catalog codes under a different name
 * (or a host alias). Used when `event.code` is empty or Unidentified.
 */
const NAMED_KEY_TO_CODE: Record<string, KeyboardCode> = {
    Apps: "ContextMenu",
    " ": "Space",
};

/** Side-button `MouseEvent.button` values that map to pointer triggers. */
const POINTER_BUTTON_BY_MOUSE: Partial<Record<number, PointerButton>> = {
    3: "back",
    4: "forward",
};

/**
 * True when `node` is a typing surface (input, textarea, or contenteditable),
 * including when it is a descendant of one.
 */
export const isTypingSurface = (node: EventTarget | null): boolean => {
    if (!(node instanceof Element)) return false;
    let current: Element | null = node;
    while (current) {
        if (current instanceof HTMLElement && current.isContentEditable) return true;
        if (EDITABLE_TAGS.has(current.tagName)) return true;
        current = current.parentElement;
    }
    return false;
};

/**
 * True when Space/Enter would activate a native button, checkbox, or summary
 * rather than an app command.
 */
export const isNativeActivationTarget = (node: EventTarget | null): boolean => {
    if (!(node instanceof Element)) return false;
    const tag = node.tagName;
    if (tag === "BUTTON" || tag === "SUMMARY") return true;
    if (tag === "INPUT") {
        const type = (node as HTMLInputElement).type;
        return type === "checkbox" || type === "radio" || type === "button" || type === "submit";
    }
    if (node.getAttribute("role") === "button") return true;
    return false;
};

/** True when arrow/space/enter navigation belongs to a native `<select>`. */
export const isNativeSelectTarget = (node: EventTarget | null): boolean => node instanceof HTMLSelectElement;

/**
 * True while IME composition or AltGraph text entry should not become an app chord.
 */
export const isImeOrAltGraph = (e: KeyboardEvent): boolean => {
    if (e.isComposing || e.key === "Process") return true;
    if (e.code === "AltRight" && e.getModifierState?.("AltGraph")) return true;
    return false;
};

/** Physical trigger id used to track held sessions (no `key` / `repeat`). */
export const liveTriggerId = (live: LiveTrigger): string => {
    if (live.kind === "pointer") {
        return `p:${live.button}:${Number(live.ctrl)}${Number(live.alt)}${Number(live.shift)}${Number(live.meta)}`;
    }
    return `k:${live.code}:${Number(live.ctrl)}${Number(live.alt)}${Number(live.shift)}${Number(live.meta)}`;
};

/**
 * Physical catalog code for this event. Prefers `KeyboardEvent.code`; when that
 * is empty or Unidentified (common for the application Menu key), uses a named
 * `KeyboardEvent.key` that is already a {@link KeyboardCode} or a known alias.
 * Does not invent a code for unknown keys - those stay unmatched and are not
 * recorded as bindings.
 */
export const keyboardCodeFromEvent = (e: KeyboardEvent): KeyboardCode | null => {
    if (isKeyboardCode(e.code)) return e.code;
    const aliased = NAMED_KEY_TO_CODE[e.key];
    if (aliased) return aliased;
    if (isKeyboardCode(e.key)) return e.key;
    return null;
};

/**
 * True when `el` is present and no HTMLElement ancestor is `hidden` or has
 * inline `display:none` (home hides itself that way while a reader is open).
 *
 * Stylesheet-only hiding is not detected; upgrade:
 * HTMLElement.checkVisibility when the Chromium floor allows it.
 */
export const elementIsShown = (el: Element | null): boolean => {
    let current: Element | null = el;
    while (current) {
        if (current instanceof HTMLElement) {
            if (current.hidden) return false;
            if (current.style.display === "none") return false;
        }
        current = current.parentElement;
    }
    return Boolean(el);
};

/**
 * Whether a list widget should handle a key for `node`. Owns the search field,
 * the list element, and the list's immediate scroller (not the document
 * root). Idle `document.body` / `document.documentElement` is owned only when
 * the widget is shown and `hasFocusedRow` is true, so a display-none home
 * list cannot steal reader ArrowDown.
 *
 * Several shown lists with focused rows all claim body; first
 * registered owner wins. Upgrade: last-pointer list identity.
 */
export const listWidgetOwnsEventTarget = (
    node: EventTarget | null,
    input: HTMLElement | null,
    list: HTMLElement | null,
    hasFocusedRow: boolean,
): boolean => {
    if (!(node instanceof Node)) return false;
    if (input?.contains(node) || list?.contains(node)) return true;
    const host = list?.parentElement;
    if (
        host &&
        host !== document.body &&
        host !== document.documentElement &&
        host.contains(node) &&
        elementIsShown(host)
    ) {
        return true;
    }
    if (!elementIsShown(list) && !elementIsShown(input)) return false;
    if ((node === document.body || node === document.documentElement) && hasFocusedRow) {
        return true;
    }
    return false;
};

/**
 * Normalizes a keyboard event to a live trigger. Modifier-only codes are not
 * returned (ingress ignores them for command matching). Unknown physical codes
 * with no named-key fallback are also omitted.
 */
export const liveTriggerFromKeyboard = (e: KeyboardEvent): LiveKeyboardTrigger | null => {
    const code = keyboardCodeFromEvent(e);
    if (!code) return null;
    return {
        kind: "keyboard",
        code,
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        repeat: e.repeat,
    };
};

/** Side-button live trigger, or null for left/middle/right click. */
export const liveTriggerFromMouse = (e: MouseEvent): LivePointerTrigger | null => {
    const button = POINTER_BUTTON_BY_MOUSE[e.button];
    if (!button) return null;
    return {
        kind: "pointer",
        button,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
    };
};

/** True when `node` is inside `root` (inclusive). */
export const nodeIsInside = (root: HTMLElement | null, node: EventTarget | null): boolean => {
    if (!root || !(node instanceof Node)) return false;
    return root === node || root.contains(node);
};
