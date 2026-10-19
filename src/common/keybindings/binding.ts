import type {
    BindingTrigger,
    KeyboardCode,
    KeyboardTrigger,
    KeyModifiers,
    LiveTrigger,
    LogicalKeyTrigger,
    PointerButton,
    PointerModifierMatch,
    PointerTrigger,
} from "./types";
import { isKeyboardCode, KEYBOARD_CODES, keyModifiers, pickKeyModifiers } from "./types";

const POINTER_BUTTON_BY_ALIAS: Readonly<Record<string, PointerButton>> = {
    mouse4: "back",
    mouse5: "forward",
    back: "back",
    forward: "forward",
};

/** Old `keyFormatter` tokens that are not `code.toLowerCase()`. */
const LEGACY_TOKEN_BY_CODE: Partial<Record<KeyboardCode, string>> = {
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowLeft: "left",
    ArrowRight: "right",
    PageDown: "pagedown",
    PageUp: "pageup",
    ContextMenu: "menu",
    NumpadAdd: "numpad_plus",
    NumpadSubtract: "numpad_minus",
    NumpadMultiply: "numpad_multiply",
    NumpadDivide: "numpad_divide",
    NumpadDecimal: "numpad_period",
    NumpadEnter: "numpad_enter",
};

const letterFromCode = (code: KeyboardCode): string | undefined =>
    code.startsWith("Key") && code.length === 4 ? code.slice(3) : undefined;

const digitFromCode = (code: KeyboardCode): string | undefined =>
    code.startsWith("Digit") && code.length === 6 ? code.slice(5) : undefined;

const numpadDigitFromCode = (code: KeyboardCode): string | undefined =>
    code.startsWith("Numpad") && code.length === 7 ? code.slice(6) : undefined;

/**
 * Token the pre-envelope `keys` array stored for this code (`a`, `down`).
 */
const legacyTokenForCode = (code: KeyboardCode): string => {
    const mapped = LEGACY_TOKEN_BY_CODE[code];
    if (mapped) return mapped;
    const letter = letterFromCode(code);
    if (letter) return letter.toLowerCase();
    const digit = digitFromCode(code);
    if (digit) return digit;
    const numpadDigit = numpadDigitFromCode(code);
    if (numpadDigit) return `numpad_${numpadDigit}`;
    if (code.startsWith("F") && code.length >= 2 && code.length <= 3) return code.toLowerCase();
    return code.toLowerCase();
};

const PHYSICAL_CODE_BY_ALIAS: Readonly<Record<string, KeyboardCode>> = (() => {
    const aliases: Record<string, KeyboardCode> = {};
    for (const code of KEYBOARD_CODES) {
        aliases[legacyTokenForCode(code)] = code;
        aliases[code.toLowerCase()] = code;
    }
    return aliases;
})();

const US_KEY_BY_CODE: Readonly<Partial<Record<KeyboardCode, { unshifted: string; shifted?: string }>>> = (() => {
    const mapped: Partial<Record<KeyboardCode, { unshifted: string; shifted?: string }>> = {
        Slash: { unshifted: "/", shifted: "?" },
        Space: { unshifted: " " },
        Digit1: { unshifted: "1", shifted: "!" },
        Equal: { unshifted: "=", shifted: "+" },
        Minus: { unshifted: "-", shifted: "_" },
        BracketLeft: { unshifted: "[", shifted: "{" },
        BracketRight: { unshifted: "]", shifted: "}" },
        Comma: { unshifted: ",", shifted: "<" },
        Period: { unshifted: ".", shifted: ">" },
        Backquote: { unshifted: "`", shifted: "~" },
    };
    for (const code of KEYBOARD_CODES) {
        const letter = letterFromCode(code);
        if (letter) mapped[code] = { unshifted: letter.toLowerCase(), shifted: letter };
    }
    return mapped;
})();

const CODE_DISPLAY: Partial<Record<KeyboardCode, string>> = {
    ArrowDown: "Down",
    ArrowUp: "Up",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    PageDown: "PageDown",
    PageUp: "PageUp",
    ContextMenu: "Menu",
    NumpadAdd: "Numpad+",
    NumpadSubtract: "Numpad-",
    NumpadMultiply: "Numpad*",
    NumpadDivide: "Numpad/",
    NumpadDecimal: "Numpad.",
    NumpadEnter: "NumpadEnter",
    Space: "Space",
    Escape: "Escape",
    Enter: "Enter",
    Backspace: "Backspace",
    Delete: "Delete",
    Tab: "Tab",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Slash: "/",
    Backquote: "`",
    Comma: ",",
    Period: ".",
};

const MENU_ACCELERATOR_CODE: Partial<Record<KeyboardCode, string>> = {
    ArrowDown: "Down",
    ArrowUp: "Up",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    PageDown: "PageDown",
    PageUp: "PageUp",
    Space: "Space",
    Escape: "Esc",
    Enter: "Return",
    Backspace: "Backspace",
    Delete: "Delete",
    Tab: "Tab",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Slash: "/",
    Backquote: "`",
    Comma: ",",
    Period: ".",
};

/** Why a binding string could not become a {@link BindingTrigger}. */
export type BindingParseFailureReason = "empty" | "modifierOnly" | "unknownToken";

/** Result of parsing a persisted or recorded combination string. */
export type BindingParseResult =
    | { ok: true; trigger: BindingTrigger }
    | { ok: false; reason: BindingParseFailureReason };

/** Split `ctrl+shift+a` into modifiers plus the last token. Used by ingest. */
export type BindingComboSplit =
    | { ok: true; mods: KeyModifiers; keyToken: string }
    | { ok: false; reason: BindingParseFailureReason };

const applyModifierToken = (mods: KeyModifiers, token: string): boolean => {
    switch (token) {
        case "ctrl":
        case "control":
            mods.ctrl = true;
            return true;
        case "alt":
        case "option":
            mods.alt = true;
            return true;
        case "shift":
            mods.shift = true;
            return true;
        case "meta":
        case "cmd":
        case "command":
        case "super":
        case "win":
            mods.meta = true;
            return true;
        default:
            return false;
    }
};

/**
 * Splits a combination string into modifiers and the final key/button token.
 */
export const splitBindingCombo = (raw: string): BindingComboSplit => {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, reason: "empty" };
    const parts = trimmed
        .split("+")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    if (parts.length === 0) return { ok: false, reason: "empty" };
    const keyToken = parts[parts.length - 1];
    if (keyToken === undefined) return { ok: false, reason: "empty" };
    const mods = keyModifiers();
    for (const token of parts.slice(0, -1)) {
        if (!applyModifierToken(mods, token.toLowerCase())) return { ok: false, reason: "unknownToken" };
    }
    if (applyModifierToken(keyModifiers(), keyToken.toLowerCase())) {
        return { ok: false, reason: "modifierOnly" };
    }
    return { ok: true, mods, keyToken };
};

const resolvePhysicalCode = (keyToken: string): KeyboardCode | undefined => {
    if (isKeyboardCode(keyToken)) return keyToken;
    const alias = PHYSICAL_CODE_BY_ALIAS[keyToken.toLowerCase()];
    if (alias && isKeyboardCode(alias)) return alias;
    return undefined;
};

/**
 * Pointer trigger when `keyToken` is a mouse-4/5 alias; otherwise `null`.
 */
export const pointerTriggerFromToken = (
    keyToken: string,
    mods: KeyModifiers,
    modifierMatch: PointerModifierMatch,
): PointerTrigger | null => {
    const button = POINTER_BUTTON_BY_ALIAS[keyToken.toLowerCase()];
    if (!button) return null;
    return { kind: "pointer", button, ...mods, modifierMatch };
};

/**
 * Parses a current-format combination (`ctrl+shift+a`, `mouse4`, `numpad_plus`)
 * into a physical or pointer trigger. Used when ingesting pre-envelope `keys`
 * arrays; the recorder uses {@link triggerFromLive} instead.
 */
export const parsePhysicalBindingString = (raw: string): BindingParseResult => {
    const split = splitBindingCombo(raw);
    if (!split.ok) return { ok: false, reason: split.reason };
    const pointer = pointerTriggerFromToken(split.keyToken, split.mods, "any");
    if (pointer) return { ok: true, trigger: pointer };
    const code = resolvePhysicalCode(split.keyToken);
    if (!code) return { ok: false, reason: "unknownToken" };
    return { ok: true, trigger: { kind: "keyboard", code, ...split.mods } };
};

const modifiersEqual = (left: KeyModifiers, right: KeyModifiers): boolean =>
    left.ctrl === right.ctrl && left.alt === right.alt && left.shift === right.shift && left.meta === right.meta;

/**
 * Structural equality of two bindings. Pointer `any` vs `exact` with the same
 * button are not equal; overlap is a separate question.
 */
export const triggersEqual = (left: BindingTrigger, right: BindingTrigger): boolean => {
    if (left.kind !== right.kind) return false;
    if (left.kind === "keyboard" && right.kind === "keyboard") {
        return left.code === right.code && modifiersEqual(left, right);
    }
    if (left.kind === "logicalKey" && right.kind === "logicalKey") {
        return left.key === right.key && modifiersEqual(left, right);
    }
    if (left.kind === "pointer" && right.kind === "pointer") {
        return (
            left.button === right.button &&
            left.modifierMatch === right.modifierMatch &&
            modifiersEqual(left, right)
        );
    }
    return false;
};

/**
 * Drops identical triggers inside one command. Order of first occurrence is kept.
 */
export const dedupeTriggers = (triggers: readonly BindingTrigger[]): BindingTrigger[] => {
    const unique: BindingTrigger[] = [];
    for (const trigger of triggers) {
        if (!unique.some((existing) => triggersEqual(existing, trigger))) unique.push(trigger);
    }
    return unique;
};

/**
 * True when a stored binding should fire for this live input.
 */
export const triggerMatchesLive = (binding: BindingTrigger, live: LiveTrigger): boolean => {
    if (binding.kind === "pointer") {
        if (live.kind !== "pointer" || live.button !== binding.button) return false;
        if (binding.modifierMatch === "any") return true;
        return modifiersEqual(binding, live);
    }
    if (live.kind !== "keyboard") return false;
    if (binding.kind === "keyboard") {
        return binding.code === live.code && modifiersEqual(binding, live);
    }
    /* COMPAT: LogicalKeyTrigger matches KeyboardEvent.key, not code */
    return binding.key === live.key && modifiersEqual(binding, live);
};

const logicalKeysForPhysical = (trigger: KeyboardTrigger): string[] => {
    const mapped = US_KEY_BY_CODE[trigger.code];
    if (!mapped) return [];
    if (trigger.shift && mapped.shifted !== undefined) return [mapped.shifted];
    return [mapped.unshifted];
};

/**
 * COMPAT: conservative overlap when a historical character binding sits next
 * to a physical code. Unknown US pairs are treated as overlapping.
 */
const logicalMayOverlapPhysical = (logical: LogicalKeyTrigger, physical: KeyboardTrigger): boolean => {
    if (!modifiersEqual(logical, physical)) {
        const mapped = US_KEY_BY_CODE[physical.code];
        if (!mapped) return true;
        const sameNonShift =
            logical.ctrl === physical.ctrl && logical.alt === physical.alt && logical.meta === physical.meta;
        if (!sameNonShift) return false;
        return logical.key === mapped.unshifted || logical.key === mapped.shifted;
    }
    const typical = logicalKeysForPhysical(physical);
    if (typical.length === 0) return true;
    return typical.includes(logical.key);
};

/**
 * Whether two bindings can represent the same user input. Logical vs physical
 * pairs are conservative when the layout cannot prove exclusivity.
 */
export const triggersMayOverlap = (left: BindingTrigger, right: BindingTrigger): boolean => {
    if (triggersEqual(left, right)) return true;
    if (left.kind === "pointer" && right.kind === "pointer") {
        if (left.button !== right.button) return false;
        if (left.modifierMatch === "any" || right.modifierMatch === "any") return true;
        return modifiersEqual(left, right);
    }
    if (left.kind === "logicalKey" && right.kind === "keyboard") {
        return logicalMayOverlapPhysical(left, right);
    }
    if (left.kind === "keyboard" && right.kind === "logicalKey") {
        return logicalMayOverlapPhysical(right, left);
    }
    if (left.kind === "logicalKey" && right.kind === "logicalKey") {
        if (!modifiersEqual(left, right) && left.key !== right.key) return false;
        return left.key === right.key || left.key.toLowerCase() === right.key.toLowerCase();
    }
    if (left.kind === "keyboard" && right.kind === "keyboard") {
        return left.code === right.code && modifiersEqual(left, right);
    }
    return false;
};

const serializeModifierPrefix = (mods: KeyModifiers): string => {
    let prefix = "";
    if (mods.ctrl) prefix += "ctrl+";
    if (mods.alt) prefix += "alt+";
    if (mods.shift) prefix += "shift+";
    if (mods.meta) prefix += "meta+";
    return prefix;
};

/**
 * Canonical identity string for tests and keymap indexing. Not a UI label.
 */
export const serializeTrigger = (trigger: BindingTrigger): string => {
    const prefix = serializeModifierPrefix(trigger);
    if (trigger.kind === "keyboard") return `${prefix}${trigger.code}`;
    if (trigger.kind === "logicalKey") return `${prefix}logical:${trigger.key}`;
    const match = trigger.modifierMatch === "any" ? ":any" : "";
    return `${prefix}mouse:${trigger.button}${match}`;
};

const displayLabelForCode = (code: KeyboardCode): string => {
    const mapped = CODE_DISPLAY[code];
    if (mapped) return mapped;
    const letter = letterFromCode(code);
    if (letter) return letter;
    const digit = digitFromCode(code);
    if (digit) return digit;
    return code;
};

const displayModifierParts = (mods: KeyModifiers): string[] => {
    const parts: string[] = [];
    if (mods.ctrl) parts.push("Ctrl");
    if (mods.shift) parts.push("Shift");
    if (mods.alt) parts.push("Alt");
    if (mods.meta) parts.push("Meta");
    return parts;
};

/**
 * User-facing binding label (Ctrl+Shift+F, Down, Mouse Back). Not persisted.
 */
export const formatTriggerForDisplay = (trigger: BindingTrigger): string => {
    const parts = displayModifierParts(trigger);
    if (trigger.kind === "pointer") {
        parts.push(trigger.button === "back" ? "Mouse Back" : "Mouse Forward");
        return parts.join("+");
    }
    if (trigger.kind === "logicalKey") {
        parts.push(trigger.key === " " ? "Space" : trigger.key);
        return parts.join("+");
    }
    parts.push(displayLabelForCode(trigger.code));
    return parts.join("+");
};

const menuAcceleratorTokenForCode = (code: KeyboardCode): string => {
    if (Object.hasOwn(MENU_ACCELERATOR_CODE, code)) return MENU_ACCELERATOR_CODE[code] ?? "";
    const letter = letterFromCode(code);
    if (letter) return letter;
    const digit = digitFromCode(code);
    if (digit) return digit;
    return code;
};

/**
 * Electron MenuItem `accelerator` string for display with
 * `registerAccelerator: false`. Pointer triggers cannot be shown and return "".
 */
export const formatTriggerAsMenuAccelerator = (trigger: BindingTrigger): string => {
    if (trigger.kind === "pointer") return "";
    const parts: string[] = [];
    if (trigger.ctrl) parts.push("Control");
    if (trigger.shift) parts.push("Shift");
    if (trigger.alt) parts.push("Alt");
    if (trigger.meta) parts.push("Meta");
    const token =
        trigger.kind === "logicalKey"
            ? trigger.key === " "
                ? "Space"
                : trigger.key
            : menuAcceleratorTokenForCode(trigger.code);
    if (!token) return "";
    parts.push(token);
    return parts.join("+");
};

/**
 * Persisted trigger from a live ingress event. Pointer recordings use exact
 * modifiers; keyboard drops `key` / `repeat` (identity is {@link KeyboardCode}).
 */
export const triggerFromLive = (live: LiveTrigger): BindingTrigger => {
    const mods = pickKeyModifiers(live);
    if (live.kind === "pointer") {
        return { kind: "pointer", button: live.button, ...mods, modifierMatch: "exact" };
    }
    return { kind: "keyboard", code: live.code, ...mods };
};
