import type {
    BindingTrigger,
    CommandCatalogEntry,
    CommandGroup,
    CommandId,
    ContextKind,
    InputPolicy,
    InvocationPolicy,
    KeyboardCode,
    KeyboardTrigger,
    KeyModifiers,
    KeymapPlatform,
    PointerButton,
    PointerTrigger,
} from "./types";
import { keyModifiers } from "./types";

const kbd = (code: KeyboardCode, mods: Partial<KeyModifiers> = {}): KeyboardTrigger => ({
    kind: "keyboard",
    code,
    ...keyModifiers(mods),
});

const ptr = (button: PointerButton): PointerTrigger => ({
    kind: "pointer",
    button,
    ...keyModifiers(),
    modifierMatch: "any",
});

const READER = ["mangaReader", "bookReader"] as const satisfies readonly ContextKind[];
const MANGA = ["mangaReader"] as const satisfies readonly ContextKind[];
const BOOK = ["bookReader"] as const satisfies readonly ContextKind[];
const APP = ["app"] as const satisfies readonly ContextKind[];
const HOME_AND_DETAILS = ["home", "galleryDetails"] as const satisfies readonly ContextKind[];
const LISTS = ["searchWidget"] as const satisfies readonly ContextKind[];
/**
 * Surfaces whose owners open or dismiss a context menu. Includes focused
 * list widgets and menu overlays so the command routes there instead of home.
 */
const CONTEXT_MENU = [
    "menu",
    "searchWidget",
    "selection",
    "mangaReader",
    "bookReader",
    "home",
] as const satisfies readonly ContextKind[];
const SELECTION = ["selection"] as const satisfies readonly ContextKind[];
const SETTINGS = ["settings"] as const satisfies readonly ContextKind[];
const HOME = ["home"] as const satisfies readonly ContextKind[];

type CatalogDraft = {
    id: CommandId;
    group: CommandGroup;
    defaultBindings: readonly BindingTrigger[];
    darwinDefaultBindings?: readonly BindingTrigger[];
    contextKinds: readonly ContextKind[];
    inputPolicy?: InputPolicy;
    invocation?: InvocationPolicy;
};

/**
 * Builds a catalog row. {@link CommandCatalogEntry.labelKey} is derived from
 * {@link CatalogDraft.id} so it cannot drift from the command identity.
 */
const row = (draft: CatalogDraft, tieOrder: number): CommandCatalogEntry => ({
    id: draft.id,
    labelKey: `shortcutNames.${draft.id}`,
    group: draft.group,
    defaultBindings: Object.freeze([...draft.defaultBindings]) as readonly BindingTrigger[],
    ...(draft.darwinDefaultBindings
        ? {
              darwinDefaultBindings: Object.freeze([...draft.darwinDefaultBindings]) as readonly BindingTrigger[],
          }
        : {}),
    contextKinds: draft.contextKinds,
    inputPolicy: draft.inputPolicy ?? "never",
    invocation: draft.invocation ?? "oneShot",
    tieOrder,
});

const ctrl = (code: KeyboardCode): KeyboardTrigger => kbd(code, { ctrl: true });
const meta = (code: KeyboardCode): KeyboardTrigger => kbd(code, { meta: true });

const DRAFTS = [
    { id: "navToPage", group: "readerNavigation", defaultBindings: [kbd("KeyF")], contextKinds: MANGA },
    { id: "toggleZenMode", group: "readerView", defaultBindings: [kbd("Backquote")], contextKinds: READER },
    {
        id: "largeScroll",
        group: "readerNavigation",
        defaultBindings: [kbd("Space")],
        contextKinds: READER,
        invocation: "held",
    },
    {
        id: "largeScrollReverse",
        group: "readerNavigation",
        defaultBindings: [kbd("Space", { shift: true })],
        contextKinds: READER,
        invocation: "held",
    },
    {
        id: "scrollDown",
        group: "readerNavigation",
        defaultBindings: [kbd("KeyS"), kbd("ArrowDown")],
        contextKinds: READER,
        invocation: "held",
    },
    {
        id: "scrollUp",
        group: "readerNavigation",
        defaultBindings: [kbd("KeyW"), kbd("ArrowUp")],
        contextKinds: READER,
        invocation: "held",
    },
    {
        id: "prevPage",
        group: "readerNavigation",
        defaultBindings: [kbd("KeyA"), kbd("ArrowLeft"), ptr("back")],
        contextKinds: READER,
        invocation: "osRepeat",
    },
    {
        id: "nextPage",
        group: "readerNavigation",
        defaultBindings: [kbd("KeyD"), kbd("ArrowRight"), ptr("forward")],
        contextKinds: READER,
        invocation: "osRepeat",
    },
    {
        id: "nextChapter",
        group: "readerNavigation",
        defaultBindings: [kbd("BracketRight")],
        contextKinds: READER,
    },
    {
        id: "prevChapter",
        group: "readerNavigation",
        defaultBindings: [kbd("BracketLeft")],
        contextKinds: READER,
    },
    {
        id: "focusPageSearch",
        group: "home",
        defaultBindings: [kbd("Slash"), kbd("KeyF", { ctrl: true, shift: true })],
        contextKinds: ["settings", "modal", "home", "galleryDetails", "mangaReader", "bookReader"],
        inputPolicy: "chordInInputs",
    },
    { id: "randomChapter", group: "readerNavigation", defaultBindings: [kbd("KeyR")], contextKinds: MANGA },
    { id: "bookmark", group: "readerView", defaultBindings: [kbd("KeyB")], contextKinds: READER },
    {
        id: "sizePlus",
        group: "readerView",
        defaultBindings: [kbd("Equal"), kbd("NumpadAdd")],
        contextKinds: READER,
    },
    {
        id: "sizeMinus",
        group: "readerView",
        defaultBindings: [kbd("Minus"), kbd("NumpadSubtract")],
        contextKinds: READER,
    },
    { id: "readerSettings", group: "readerView", defaultBindings: [kbd("KeyQ")], contextKinds: READER },
    {
        id: "savePreset",
        group: "readerPresets",
        defaultBindings: [ctrl("KeyS")],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "cyclePresetNext",
        group: "readerPresets",
        defaultBindings: [kbd("Period", { alt: true })],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "cyclePresetPrev",
        group: "readerPresets",
        defaultBindings: [kbd("Comma", { alt: true })],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "selectPreset1",
        group: "readerPresets",
        defaultBindings: [kbd("Digit1", { alt: true })],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "selectPreset2",
        group: "readerPresets",
        defaultBindings: [kbd("Digit2", { alt: true })],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "selectPreset3",
        group: "readerPresets",
        defaultBindings: [kbd("Digit3", { alt: true })],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "selectPreset4",
        group: "readerPresets",
        defaultBindings: [kbd("Digit4", { alt: true })],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "selectPreset5",
        group: "readerPresets",
        defaultBindings: [kbd("Digit5", { alt: true })],
        contextKinds: READER,
        inputPolicy: "chordInInputs",
    },
    {
        id: "showHidePageNumberInZen",
        group: "readerView",
        defaultBindings: [kbd("KeyP")],
        contextKinds: READER,
    },
    { id: "cycleFitOptions", group: "readerView", defaultBindings: [kbd("KeyV")], contextKinds: MANGA },
    {
        id: "cycleFitOptionsReverse",
        group: "readerView",
        defaultBindings: [kbd("KeyV", { shift: true })],
        contextKinds: MANGA,
    },
    { id: "selectReaderMode0", group: "readerView", defaultBindings: [kbd("Digit9")], contextKinds: MANGA },
    { id: "selectReaderMode1", group: "readerView", defaultBindings: [kbd("Digit0")], contextKinds: MANGA },
    { id: "selectReaderMode2", group: "readerView", defaultBindings: [], contextKinds: MANGA },
    { id: "selectPagePerRow1", group: "readerView", defaultBindings: [kbd("Digit1")], contextKinds: MANGA },
    { id: "selectPagePerRow2", group: "readerView", defaultBindings: [kbd("Digit2")], contextKinds: MANGA },
    { id: "selectPagePerRow2odd", group: "readerView", defaultBindings: [kbd("Digit3")], contextKinds: MANGA },
    {
        id: "fontSizePlus",
        group: "readerView",
        defaultBindings: [kbd("Equal", { shift: true })],
        contextKinds: BOOK,
    },
    {
        id: "fontSizeMinus",
        group: "readerView",
        defaultBindings: [kbd("Minus", { shift: true })],
        contextKinds: BOOK,
    },
    { id: "navToHome", group: "window", defaultBindings: [kbd("KeyH")], contextKinds: APP },
    {
        id: "dirUp",
        group: "home",
        defaultBindings: [kbd("ArrowUp", { alt: true })],
        contextKinds: HOME_AND_DETAILS,
        inputPolicy: "chordInInputs",
    },
    {
        id: "contextMenu",
        group: "lists",
        defaultBindings: [kbd("Slash", { ctrl: true }), kbd("F10", { shift: true }), kbd("ContextMenu")],
        contextKinds: CONTEXT_MENU,
        inputPolicy: "ownOrIdle",
    },
    { id: "readerSize_50", group: "readerView", defaultBindings: [ctrl("Digit1")], contextKinds: MANGA },
    { id: "readerSize_100", group: "readerView", defaultBindings: [ctrl("Digit2")], contextKinds: MANGA },
    { id: "readerSize_150", group: "readerView", defaultBindings: [ctrl("Digit3")], contextKinds: MANGA },
    { id: "readerSize_200", group: "readerView", defaultBindings: [ctrl("Digit4")], contextKinds: MANGA },
    { id: "readerSize_250", group: "readerView", defaultBindings: [ctrl("Digit5")], contextKinds: MANGA },
    {
        id: "openSettings",
        group: "window",
        defaultBindings: [ctrl("KeyI")],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
    },
    {
        id: "uiSizeReset",
        group: "window",
        defaultBindings: [ctrl("Digit0")],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
    },
    {
        id: "uiSizeDown",
        group: "window",
        defaultBindings: [ctrl("Minus")],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
        invocation: "osRepeat",
    },
    {
        id: "uiSizeUp",
        group: "window",
        defaultBindings: [ctrl("Equal")],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
        invocation: "osRepeat",
    },
    {
        id: "listDown",
        group: "lists",
        defaultBindings: [kbd("ArrowDown"), kbd("KeyJ", { ctrl: true })],
        contextKinds: LISTS,
        inputPolicy: "ownInputs",
        invocation: "osRepeat",
    },
    {
        id: "listUp",
        group: "lists",
        defaultBindings: [kbd("ArrowUp"), kbd("KeyK", { ctrl: true })],
        contextKinds: LISTS,
        inputPolicy: "ownInputs",
        invocation: "osRepeat",
    },
    {
        id: "listSelect",
        group: "lists",
        defaultBindings: [kbd("Enter")],
        contextKinds: LISTS,
        inputPolicy: "ownInputs",
    },
    {
        id: "cycleBar1Prev",
        group: "home",
        defaultBindings: [kbd("BracketLeft", { alt: true })],
        contextKinds: HOME,
        inputPolicy: "chordInInputs",
    },
    {
        id: "cycleBar1Next",
        group: "home",
        defaultBindings: [kbd("BracketRight", { alt: true })],
        contextKinds: HOME,
        inputPolicy: "chordInInputs",
    },
    {
        id: "cycleBar2Prev",
        group: "home",
        defaultBindings: [kbd("Minus", { alt: true })],
        contextKinds: HOME,
        inputPolicy: "chordInInputs",
    },
    {
        id: "cycleBar2Next",
        group: "home",
        defaultBindings: [kbd("Equal", { alt: true })],
        contextKinds: HOME,
        inputPolicy: "chordInInputs",
    },
    { id: "deleteSelected", group: "lists", defaultBindings: [kbd("Delete")], contextKinds: SELECTION },
    {
        id: "settingsTabNext",
        group: "settings",
        defaultBindings: [kbd("BracketRight")],
        contextKinds: SETTINGS,
    },
    {
        id: "settingsTabPrev",
        group: "settings",
        defaultBindings: [kbd("BracketLeft")],
        contextKinds: SETTINGS,
    },
    {
        id: "newWindow",
        group: "window",
        defaultBindings: [ctrl("KeyN")],
        darwinDefaultBindings: [meta("KeyN")],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
    },
    {
        id: "closeWindow",
        group: "window",
        defaultBindings: [ctrl("KeyW")],
        darwinDefaultBindings: [meta("KeyW")],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
    },
    {
        id: "reload",
        group: "window",
        defaultBindings: [ctrl("KeyR")],
        darwinDefaultBindings: [meta("KeyR")],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
    },
    {
        id: "forceReload",
        group: "window",
        defaultBindings: [kbd("KeyR", { ctrl: true, shift: true })],
        darwinDefaultBindings: [kbd("KeyR", { meta: true, shift: true })],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
    },
    {
        id: "toggleDevTools",
        group: "window",
        defaultBindings: [kbd("KeyI", { ctrl: true, shift: true })],
        darwinDefaultBindings: [kbd("KeyI", { meta: true, alt: true })],
        contextKinds: APP,
        inputPolicy: "chordInInputs",
    },
    { id: "help", group: "window", defaultBindings: [kbd("F1")], contextKinds: APP },
    {
        id: "selectAll",
        group: "lists",
        defaultBindings: [ctrl("KeyA"), meta("KeyA")],
        contextKinds: SELECTION,
        inputPolicy: "chordInInputs",
    },
] as const satisfies readonly CatalogDraft[];

/**
 * Typed command catalog. Defaults are frozen; {@link resolveDefaultBindings}
 * returns a shallow copy so callers can assemble a keymap without mutating this.
 */
export const COMMAND_CATALOG: readonly CommandCatalogEntry[] = Object.freeze(
    DRAFTS.map((draft, index) => row(draft, index)),
);

export type { CommandId } from "./types";

const BY_ID = new Map<string, CommandCatalogEntry>(COMMAND_CATALOG.map((entry) => [entry.id, entry]));

/**
 * Returns the catalog row for {@link CommandId}, or `undefined` when the id is
 * not in this build's catalog (unknown persisted commands stay inactive).
 */
export const getCommand = (commandId: string): CommandCatalogEntry | undefined => BY_ID.get(commandId);

/**
 * Effective default bindings for a platform. Darwin uses
 * {@link CommandCatalogEntry.darwinDefaultBindings} when present.
 *
 * @returns A new array; never the frozen catalog tuple itself.
 */
export const resolveDefaultBindings = (entry: CommandCatalogEntry, platform: KeymapPlatform): BindingTrigger[] => {
    const source =
        platform === "darwin" && entry.darwinDefaultBindings ? entry.darwinDefaultBindings : entry.defaultBindings;
    return source.map((trigger) => ({ ...trigger }));
};

/** True when `commandId` is a catalog id in this build. */
export const isCommandId = (commandId: string): commandId is CommandId => BY_ID.has(commandId);
