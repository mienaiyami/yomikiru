import type readerEn from "@common/i18n/locales/en/reader.json";

/** i18n key under reader.shortcutNames; a typo fails at compile time. */
export type ShortcutNameKey = `shortcutNames.${keyof typeof readerEn.shortcutNames & string}`;

/**
 * Catalog command id. Same union as English `shortcutNames` keys so a draft
 * without a label (or a label without a command) fails at compile time.
 * Runtime membership is still checked against the compiled catalog.
 */
export type CommandId = keyof typeof readerEn.shortcutNames & string;

/**
 * Host family used when resolving catalog defaults that differ by modifier key
 * (Ctrl vs Meta). Matches Node's platform ids without importing Node.
 */
export type KeymapPlatform = "darwin" | "win32" | "linux";

/**
 * Environments in which a command may apply. Overlap and specificity live in
 * {@link ./contexts}; owners declare which of these they currently occupy.
 */
export const CONTEXT_KINDS = [
    "uiLock",
    "recorder",
    "modal",
    "menu",
    "settings",
    "readerPanel",
    "searchWidget",
    "selection",
    "galleryDetails",
    "mangaReader",
    "bookReader",
    "home",
    "app",
] as const;

/** One documented environment from {@link CONTEXT_KINDS}. */
export type ContextKind = (typeof CONTEXT_KINDS)[number];

/**
 * Editor / help grouping. Membership is catalog metadata, not a runtime owner.
 */
export const COMMAND_GROUPS = [
    "readerNavigation",
    "readerView",
    "readerPresets",
    "home",
    "lists",
    "window",
    "settings",
] as const;

/** Discoverability group id from {@link COMMAND_GROUPS}. */
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

/**
 * How a command treats OS key-repeat and hold.
 *
 * - `oneShot`: fire once per press (Home, bookmark, open Settings). Repeats from
 *   a held key are ignored.
 * - `osRepeat`: fire again while the OS repeats the key (page next/prev).
 * - `held`: start a session on press and stop on release (reader scroll).
 *
 * A book owner may still ignore repeats for `osRepeat` page commands in
 * continuous mode; that is owner policy, not a fourth enum value.
 */
export type InvocationPolicy = "oneShot" | "osRepeat" | "held";

/**
 * Whether a binding may run while focus is in an editable.
 *
 * - `never`: idle only (plain `D` for next page does not type into a search field).
 * - `chordInInputs`: unchorded keys are idle-only; Ctrl/Alt/Meta chords still run
 *   in any field (Ctrl+F search).
 * - `ownOrIdle`: unchorded keys run when idle or inside this owner (list arrows
 *   in that list's filter); foreign fields still need a chord.
 * - `ownInputs`: only when the event target is inside the owner (find-in-page
 *   field), never while idle on the reader canvas.
 */
export type InputPolicy = "never" | "chordInInputs" | "ownOrIdle" | "ownInputs";

/**
 * Ctrl / Alt / Shift / Meta flags shared by stored and live triggers.
 * Identity includes these four; display strings are not identity.
 */
export type KeyModifiers = {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
};

/**
 * Fills omitted modifier flags with false. Catalog defaults and tests use this
 * so a `{ ctrl: true }` chord is not missing `alt`/`shift`/`meta`.
 */
export const keyModifiers = (mods: Partial<KeyModifiers> = {}): KeyModifiers => ({
    ctrl: Boolean(mods.ctrl),
    alt: Boolean(mods.alt),
    shift: Boolean(mods.shift),
    meta: Boolean(mods.meta),
});

/** Copies the four modifier flags off a trigger or live event. */
export const pickKeyModifiers = (source: KeyModifiers): KeyModifiers => ({
    ctrl: source.ctrl,
    alt: source.alt,
    shift: source.shift,
    meta: source.meta,
});

/**
 * Standard `KeyboardEvent.code` values the catalog and recorder accept.
 * Modifier-only codes are omitted; those never become bindings.
 */
export const KEYBOARD_CODES = [
    "KeyA",
    "KeyB",
    "KeyC",
    "KeyD",
    "KeyE",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyI",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyM",
    "KeyN",
    "KeyO",
    "KeyP",
    "KeyQ",
    "KeyR",
    "KeyS",
    "KeyT",
    "KeyU",
    "KeyV",
    "KeyW",
    "KeyX",
    "KeyY",
    "KeyZ",
    "Digit0",
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
    "Digit8",
    "Digit9",
    "Numpad0",
    "Numpad1",
    "Numpad2",
    "Numpad3",
    "Numpad4",
    "Numpad5",
    "Numpad6",
    "Numpad7",
    "Numpad8",
    "Numpad9",
    "NumpadAdd",
    "NumpadSubtract",
    "NumpadMultiply",
    "NumpadDivide",
    "NumpadDecimal",
    "NumpadEnter",
    "NumpadEqual",
    "NumpadComma",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
    "F13",
    "F14",
    "F15",
    "F16",
    "F17",
    "F18",
    "F19",
    "F20",
    "F21",
    "F22",
    "F23",
    "F24",
    "ArrowDown",
    "ArrowUp",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Insert",
    "Delete",
    "Backspace",
    "Tab",
    "Enter",
    "Escape",
    "Space",
    "CapsLock",
    "ContextMenu",
    "PrintScreen",
    "ScrollLock",
    "Pause",
    "NumLock",
    "Backquote",
    "Minus",
    "Equal",
    "BracketLeft",
    "BracketRight",
    "Backslash",
    "Semicolon",
    "Quote",
    "Comma",
    "Period",
    "Slash",
    "IntlBackslash",
    "IntlRo",
    "IntlYen",
] as const;

/** Physical `KeyboardEvent.code` from {@link KEYBOARD_CODES}. */
export type KeyboardCode = (typeof KEYBOARD_CODES)[number];

const KEYBOARD_CODE_SET: ReadonlySet<string> = new Set(KEYBOARD_CODES);

/**
 * True when `code` is a catalog/recorder {@link KeyboardCode} (not a modifier).
 */
export const isKeyboardCode = (code: string): code is KeyboardCode => KEYBOARD_CODE_SET.has(code);

/**
 * Physical keyboard chord. Identity is {@link KeyboardTrigger.code} plus
 * {@link KeyModifiers}; labels like "Ctrl+A" are display only.
 *
 * Example: `{ kind: "keyboard", code: "KeyA", ...keyModifiers({ ctrl: true }) }`
 * is Ctrl plus the leftmost home-row letter key (`KeyA`). On AZERTY that key
 * still matches; it may type `q`.
 */
export type KeyboardTrigger = {
    kind: "keyboard";
    /** Physical {@link KeyboardCode} (`KeyboardEvent.code`). */
    code: KeyboardCode;
} & KeyModifiers;

/**
 * COMPAT (legacy ingest): `KeyboardEvent.key` character from old `key1`/`key2`
 * files when a physical {@link KeyboardCode} cannot be proved. The recorder
 * never creates these; keymap ingest may. Matches live `key` (the character
 * produced), not `code`.
 *
 * Example: `{ kind: "logicalKey", key: "/", ...keyModifiers() }` fires when the
 * event's `key` is `/`, even if that character is not on `Slash` for the layout.
 *
 * Remove with `legacy.ts` once historical arrays are gone.
 */
export type LogicalKeyTrigger = {
    kind: "logicalKey";
    /** Literal `KeyboardEvent.key` from the legacy file, including case. */
    key: string;
} & KeyModifiers;

/** Mouse back / forward (browser buttons 4 and 5). */
export type PointerButton = "back" | "forward";

/**
 * How stored pointer modifiers are compared to the live event.
 * `any`: ignore Ctrl/Alt/Shift/Meta (old `keys` mouse rows).
 * `exact`: all four flags must match (new recordings).
 */
export type PointerModifierMatch = "exact" | "any";

/**
 * Side-button chord. Example: `{ kind: "pointer", button: "back",
 * modifierMatch: "any", ...keyModifiers() }` is mouse 4 regardless of Ctrl.
 */
export type PointerTrigger = {
    kind: "pointer";
    button: PointerButton;
    modifierMatch: PointerModifierMatch;
} & KeyModifiers;

/** One alternative input that can invoke a command. */
export type BindingTrigger = KeyboardTrigger | LogicalKeyTrigger | PointerTrigger;

/**
 * Live keyboard event after ingress. Unlike {@link KeyboardTrigger}, this keeps
 * both `code` and `key` plus `repeat` so {@link LogicalKeyTrigger} rows and
 * held/repeat policy can still see the character and OS repeat flag.
 */
export type LiveKeyboardTrigger = {
    kind: "keyboard";
    code: KeyboardCode;
    key: string;
    repeat: boolean;
} & KeyModifiers;

/** Live side-button event after ingress. Always compared with exact modifiers. */
export type LivePointerTrigger = {
    kind: "pointer";
    button: PointerButton;
} & KeyModifiers;

/** Normalized live input presented to the resolver. */
export type LiveTrigger = LiveKeyboardTrigger | LivePointerTrigger;

/**
 * One catalog command. Feature adapters supply execution; this type is
 * presentation, defaults, and routing policy only.
 */
export type CommandCatalogEntry = {
    id: CommandId;
    labelKey: ShortcutNameKey;
    group: CommandGroup;
    defaultBindings: readonly BindingTrigger[];
    /** When set, replaces {@link CommandCatalogEntry.defaultBindings} on darwin. */
    darwinDefaultBindings?: readonly BindingTrigger[];
    contextKinds: readonly ContextKind[];
    inputPolicy: InputPolicy;
    invocation: InvocationPolicy;
    /**
     * Stable winner among same-context duplicates. Lower wins. Independent of
     * registration time, translation, and binding edit order.
     */
    tieOrder: number;
};

/**
 * Envelope persisted as `shortcuts.json`. Missing override keys inherit
 * catalog defaults; an empty array is an explicit unbind.
 */
export type KeymapDocument = {
    schemaVersion: number;
    revision: number;
    overrides: Partial<Record<CommandId, BindingTrigger[]>>;
    /**
     * Unknown or unexecutable command rows kept for recovery. They never run.
     */
    inactive?: InactiveBindingRow[];
};

/** Preserved row that is not in the current catalog. */
export type InactiveBindingRow = {
    command: string;
    bindings: BindingTrigger[];
    raw: unknown;
};

/** Outcome of reading an on-disk value into {@link KeymapDocument} (pure). */
export type KeymapIngestWarning = {
    code: "unknownCommand" | "malformedRow" | "duplicateTrigger" | "unsupportedTrigger";
    command?: string;
    detail: string;
};

/** Successful ingest, including migrated legacy arrays. */
export type KeymapIngestOk = {
    status: "ok";
    document: KeymapDocument;
    migratedFrom: "array" | "historical" | null;
    warnings: KeymapIngestWarning[];
};

/** Newer envelope this build must not rewrite. */
export type KeymapIngestUnsupported = {
    status: "unsupportedVersion";
    schemaVersion: number;
    raw: unknown;
};

/** Unreadable input; caller may load defaults in memory but must not overwrite. */
export type KeymapIngestCorrupt = {
    status: "corrupt";
    reason: string;
    raw: unknown;
};

/** Discriminated result of {@link ingestPersistedKeymap}. */
export type KeymapIngestResult = KeymapIngestOk | KeymapIngestUnsupported | KeymapIngestCorrupt;

/**
 * Schema version of the keymap envelope this build writes.
 *
 * - `1`: `{ schemaVersion, revision, overrides, inactive? }` (current).
 * - Older on-disk arrays (`keys` / `key1`+`key2`) have no version; ingest
 *   upgrades them to this number then the file owner rewrites.
 * - A file with a *greater* version is left untouched (`unsupportedVersion`).
 *
 * Bump only when the persisted JSON shape changes in a way old builds cannot
 * read. Additive optional fields can stay on the same version. Pair a bump
 * with an ingest branch in `migrate.ts`.
 */
export const KEYMAP_SCHEMA_VERSION = 1 as const;

/**
 * Allowlisted main-process actions dispatched from renderer keymap routing.
 * Menu clicks use the same ids; they must not keep a second live accelerator.
 */
export const NATIVE_KEYMAP_ACTIONS = [
    "newWindow",
    "closeWindow",
    "reload",
    "forceReload",
    "toggleDevTools",
    "help",
] as const satisfies readonly CommandId[];

/** One {@link NATIVE_KEYMAP_ACTIONS} id. */
export type NativeKeymapAction = (typeof NATIVE_KEYMAP_ACTIONS)[number];

/**
 * Durable load state of the keymap file owner.
 * `recovery` is in-memory defaults with writes blocked except reset-all.
 * `readOnly` is an unsupported newer schema left untouched on disk.
 */
export type KeymapLoadStatus = "ready" | "recovery" | "readOnly";

/**
 * Snapshot published to renderers. Diagnostics and owners are not included.
 */
export type KeymapSnapshot = {
    status: KeymapLoadStatus;
    document: KeymapDocument;
    platform: KeymapPlatform;
};

/** Failure codes returned by `keymap:edit` after the file owner runs. */
export type KeymapEditIpcFailureCode = "stale" | "unknownCommand" | "readOnly" | "writeFailed" | "recoveryBlocked";

/** Acknowledged result of a keymap edit, including the post-attempt snapshot. */
export type KeymapEditIpcResult =
    | { ok: true; snapshot: KeymapSnapshot }
    | { ok: false; code: KeymapEditIpcFailureCode; snapshot: KeymapSnapshot };
