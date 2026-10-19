import {
    dedupeTriggers,
    formatTriggerAsMenuAccelerator,
    formatTriggerForDisplay,
    triggerMatchesLive,
} from "./binding";
import { COMMAND_CATALOG, type CommandId, resolveDefaultBindings } from "./catalog";
import { compareClaimedCommands, mostSpecificClaimedContext } from "./contexts";
import type {
    BindingTrigger,
    ContextKind,
    InputPolicy,
    InvocationPolicy,
    KeymapDocument,
    KeymapPlatform,
    LiveTrigger,
} from "./types";

/**
 * One compiled binding that can win for a live trigger. Catalog policy is
 * copied so resolvers do not read the catalog again per keypress.
 */
export type CommandCandidate = {
    commandId: CommandId;
    trigger: BindingTrigger;
    contextKinds: readonly ContextKind[];
    tieOrder: number;
    invocation: InvocationPolicy;
    inputPolicy: InputPolicy;
};

/**
 * Effective keymap: per-command bindings plus a flat candidate list for lookup.
 * Rebuild when overrides, catalog, or platform change; not on reading progress.
 */
export type CompiledKeymap = {
    platform: KeymapPlatform;
    byCommand: ReadonlyMap<CommandId, readonly BindingTrigger[]>;
    candidates: readonly CommandCandidate[];
};

/** Explicit per-command binding lists. Omitted keys inherit catalog defaults. */
export type KeymapOverrides = Readonly<Partial<Record<CommandId, readonly BindingTrigger[]>>>;

/**
 * Compiles catalog defaults plus explicit overrides. A missing key inherits;
 * an empty array unbinds. Identical triggers on one command are collapsed.
 */
export const compileKeymap = (overrides: KeymapOverrides, platform: KeymapPlatform): CompiledKeymap => {
    const byCommand = new Map<CommandId, readonly BindingTrigger[]>();
    const candidates: CommandCandidate[] = [];
    for (const entry of COMMAND_CATALOG) {
        const commandId = entry.id;
        const hasOverride = Object.hasOwn(overrides, commandId);
        const bindings = dedupeTriggers(
            hasOverride ? (overrides[commandId] ?? []) : resolveDefaultBindings(entry, platform),
        );
        byCommand.set(commandId, bindings);
        for (const trigger of bindings) {
            candidates.push({
                commandId,
                trigger,
                contextKinds: entry.contextKinds,
                tieOrder: entry.tieOrder,
                invocation: entry.invocation,
                inputPolicy: entry.inputPolicy,
            });
        }
    }
    return { platform, byCommand, candidates };
};

/**
 * Candidates whose stored trigger matches this live input, in catalog order.
 * Same command with several matching alternatives appears once (first trigger).
 */
export const lookupCandidates = (keymap: CompiledKeymap, live: LiveTrigger): CommandCandidate[] => {
    const matched: CommandCandidate[] = [];
    const seen = new Set<CommandId>();
    for (const candidate of keymap.candidates) {
        if (seen.has(candidate.commandId)) continue;
        if (!triggerMatchesLive(candidate.trigger, live)) continue;
        seen.add(candidate.commandId);
        matched.push(candidate);
    }
    return matched;
};

export type ResolveHandled = {
    outcome: "handled";
    candidate: CommandCandidate;
    context: ContextKind;
};

export type ResolveUnmatched = { outcome: "unmatched" };

/** Pure routing result: at most one candidate, or unmatched. */
export type ResolveResult = ResolveHandled | ResolveUnmatched;

/**
 * Picks at most one matching command for the active owner contexts. Hidden
 * contexts are ignored; registration order is not consulted.
 */
export const resolveCommand = (
    keymap: CompiledKeymap,
    live: LiveTrigger,
    activeContexts: readonly ContextKind[],
): ResolveResult => {
    const matched = lookupCandidates(keymap, live).filter(
        (candidate) => mostSpecificClaimedContext(candidate.contextKinds, activeContexts) !== null,
    );
    if (matched.length === 0) return { outcome: "unmatched" };
    const first = matched[0];
    if (!first) return { outcome: "unmatched" };
    let winner = first;
    for (const candidate of matched.slice(1)) {
        if (compareClaimedCommands(candidate, winner, activeContexts) < 0) winner = candidate;
    }
    const context = mostSpecificClaimedContext(winner.contextKinds, activeContexts);
    if (!context) return { outcome: "unmatched" };
    return { outcome: "handled", candidate: winner, context };
};

/**
 * Maps Node's `process.platform` onto {@link KeymapPlatform}. Anything other
 * than darwin/win32 is treated as linux (Ctrl defaults).
 */
export const keymapPlatformFromNode = (platform: string): KeymapPlatform => {
    if (platform === "darwin") return "darwin";
    if (platform === "win32") return "win32";
    return "linux";
};

/** One derived display row (`command` + formatted keys) for a catalog command. */
export type ShortcutDisplayRow = {
    command: CommandId;
    keys: string[];
};

/**
 * Builds display rows for Usage. Every catalog command is included; an empty
 * `keys` array means deliberately unbound.
 */
export const toShortcutDisplayEntries = (
    document: KeymapDocument,
    platform: KeymapPlatform,
): ShortcutDisplayRow[] => {
    const compiled = compileKeymap(document.overrides, platform);
    return COMMAND_CATALOG.map((entry) => {
        const commandId = entry.id;
        const bindings = compiled.byCommand.get(commandId) ?? [];
        return {
            command: commandId,
            keys: bindings.map((trigger) => formatTriggerForDisplay(trigger)),
        };
    });
};

/**
 * Electron MenuItem `accelerator` for the first keyboard/logical binding of a
 * command, or empty when unbound or only pointer-bound. Used with
 * `registerAccelerator: false` so the menu shows the chord without a second dispatcher.
 */
export const firstBindingMenuAccelerator = (
    document: KeymapDocument,
    commandId: CommandId,
    platform: KeymapPlatform,
): string => {
    const bindings = compileKeymap(document.overrides, platform).byCommand.get(commandId) ?? [];
    for (const trigger of bindings) {
        const accelerator = formatTriggerAsMenuAccelerator(trigger);
        if (accelerator) return accelerator;
    }
    return "";
};
