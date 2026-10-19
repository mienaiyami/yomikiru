import {
    CONTEXT_SPECIFICITY,
    type CommandId,
    type CompiledKeymap,
    type ContextKind,
    compileKeymap,
    getCommand,
    type InputPolicy,
    isCommandId,
    type KeymapDocument,
    type KeymapPlatform,
    type LiveTrigger,
    mostSpecificClaimedContext,
    resolveCommand,
} from "@common/keybindings";
import {
    isImeOrAltGraph,
    isNativeActivationTarget,
    isNativeSelectTarget,
    isTypingSurface,
    liveTriggerFromKeyboard,
    liveTriggerFromMouse,
    liveTriggerId,
    nodeIsInside,
} from "./target";
import type { CommandOutcome, InvokeContext, OwnerSpec, OwnerToken, RuntimeClock } from "./types";

const OVERLAY_BLOCKERS: ReadonlySet<ContextKind> = new Set(["modal", "menu", "settings"]);

const HELD_OPPOSITE: Partial<Record<CommandId, CommandId>> = {
    scrollDown: "scrollUp",
    scrollUp: "scrollDown",
    largeScroll: "largeScrollReverse",
    largeScrollReverse: "largeScroll",
};

type OwnerSlot = OwnerSpec & { generation: number };

type HeldGroup = {
    commandId: CommandId;
    ownerId: string;
    contributing: Set<string>;
    stop: () => void;
};

const ownerKey = (ownerId: string, commandId: CommandId): string => `${ownerId}\0${commandId}`;

const defaultClock: RuntimeClock = { now: () => Date.now() };

const consume = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
};

const chordPresent = (live: LiveTrigger): boolean => live.ctrl || live.alt || live.meta;

/**
 * Window-local command runtime: owners, keymap compile, and one ingress.
 * Feature code registers handlers; it does not attach window listeners.
 */
export type KeybindingRuntime = {
    setDocument: (document: KeymapDocument, platform: KeymapPlatform) => void;
    setUiLocked: (locked: boolean) => void;
    /**
     * Starts a capture session. Optional `onCancel` runs whenever
     * {@link KeybindingRuntime.cancelRecording} ends the session (Escape, Tab,
     * a later {@link KeybindingRuntime.beginRecording}, or the editor).
     */
    beginRecording: (onCapture: (live: LiveTrigger) => void, onCancel?: () => void) => void;
    /**
     * Ends the capture session. Returns whether a session was active. Runs the
     * `onCancel` passed to {@link KeybindingRuntime.beginRecording} when present.
     */
    cancelRecording: () => boolean;
    isRecording: () => boolean;
    registerOwner: (spec: OwnerSpec) => OwnerToken;
    executeCommand: (commandId: CommandId, ownerId?: string) => CommandOutcome;
    handleKeyDown: (e: KeyboardEvent) => CommandOutcome;
    handleKeyUp: (e: KeyboardEvent) => void;
    handlePointerDown: (e: MouseEvent) => CommandOutcome;
    handlePointerUp: (e: MouseEvent) => void;
    handleBlur: () => void;
    handleVisibilityHidden: () => void;
    handleComposition: (active: boolean) => void;
};

/**
 * Creates one runtime for this renderer. Tests inject {@link RuntimeClock};
 * production uses wall time.
 */
export const createKeybindingRuntime = (clock: RuntimeClock = defaultClock): KeybindingRuntime => {
    let compiled: CompiledKeymap | null = null;
    let uiLocked = false;
    let recording: ((live: LiveTrigger) => void) | null = null;
    let recordingCancel: (() => void) | null = null;
    let composing = false;
    const owners = new Map<string, OwnerSlot>();
    const held = new Map<string, HeldGroup>();
    const pausedOpposite = new Map<string, HeldGroup>();
    const inFlight = new Set<string>();
    void clock;

    const setDocument = (document: KeymapDocument, platform: KeymapPlatform): void => {
        compiled = compileKeymap(document.overrides, platform);
        cancelAllHeld("keymap");
    };

    const setUiLocked = (locked: boolean): void => {
        uiLocked = locked;
        if (locked) cancelAllHeld("lock");
    };

    const cancelRecording = (): boolean => {
        if (!recording) return false;
        recording = null;
        const onCancel = recordingCancel;
        recordingCancel = null;
        onCancel?.();
        return true;
    };

    const beginRecording = (onCapture: (live: LiveTrigger) => void, onCancel?: () => void): void => {
        cancelRecording();
        recording = onCapture;
        recordingCancel = onCancel ?? null;
        cancelAllHeld("recorder");
    };

    const registerOwner = (spec: OwnerSpec): OwnerToken => {
        const slot: OwnerSlot = { ...spec, generation: (owners.get(spec.ownerId)?.generation ?? 0) + 1 };
        owners.set(spec.ownerId, slot);
        return {
            update: (next) => {
                if (owners.get(spec.ownerId) !== slot) return;
                Object.assign(slot, next, { generation: slot.generation });
            },
            unregister: () => {
                if (owners.get(spec.ownerId) !== slot) return;
                cancelHeldForOwner(spec.ownerId);
                owners.delete(spec.ownerId);
            },
        };
    };

    const ownerHasCommand = (owner: OwnerSlot, commandId: CommandId): boolean =>
        Boolean(owner.handlers?.[commandId] || owner.heldHandlers?.[commandId]);

    const isSearchWidgetOnly = (owner: OwnerSlot): boolean =>
        owner.contextKinds.length === 1 && owner.contextKinds[0] === "searchWidget";

    const overlayBlockersActive = (): OwnerSlot[] =>
        [...owners.values()].filter(
            (owner) => owner.visible && owner.contextKinds.some((kind) => OVERLAY_BLOCKERS.has(kind)),
        );

    const isDescendantOf = (owner: OwnerSlot, ancestorIds: Set<string>): boolean => {
        let parentId = owner.parentOwnerId ?? null;
        const seen = new Set<string>();
        while (parentId && !seen.has(parentId)) {
            if (ancestorIds.has(parentId)) return true;
            seen.add(parentId);
            parentId = owners.get(parentId)?.parentOwnerId ?? null;
        }
        return false;
    };

    const ownerOwnsTarget = (owner: OwnerSlot, eventTarget: EventTarget | null): boolean => {
        if (owner.ownsEventTarget) return owner.ownsEventTarget(eventTarget);
        return nodeIsInside(owner.focusRoot?.() ?? null, eventTarget);
    };

    /**
     * Visible owners that may receive this event. Overlay blockers drop
     * unrelated surfaces; a searchWidget-only owner stays only when it owns
     * the target (including a focused nested list without parentOwnerId).
     */
    const eligibleOwners = (eventTarget: EventTarget | null): OwnerSlot[] => {
        const visible = [...owners.values()].filter((owner) => {
            if (!owner.visible) return false;
            /* searchWidget is the focused field/popup only; a mounted list must not
             * steal ArrowDown from the reader or an unfocused sibling list */
            if (isSearchWidgetOnly(owner) && !ownerOwnsTarget(owner, eventTarget)) return false;
            return true;
        });
        const blockers = overlayBlockersActive();
        if (blockers.length === 0) return visible;
        const blockerIds = new Set(blockers.map((owner) => owner.ownerId));
        return visible.filter((owner) => {
            if (blockerIds.has(owner.ownerId)) return true;
            if (isDescendantOf(owner, blockerIds)) return true;
            /* focused list/combobox inside the overlay; parentOwnerId is optional */
            if (owner.contextKinds.includes("searchWidget") && ownerOwnsTarget(owner, eventTarget)) return true;
            return owner.contextKinds.length === 1 && owner.contextKinds[0] === "app";
        });
    };

    const activeContexts = (eligible: readonly OwnerSlot[]): ContextKind[] => {
        const kinds = new Set<ContextKind>();
        for (const owner of eligible) {
            for (const kind of owner.contextKinds) kinds.add(kind);
        }
        return [...kinds];
    };

    const ownersForContext = (kind: ContextKind, eligible: readonly OwnerSlot[]): OwnerSlot[] =>
        eligible.filter((owner) => owner.contextKinds.includes(kind));

    /**
     * Chooses one owner for `kind`. Prefers a handler over a context-only
     * claimant, then the owner of `eventTarget`, then specificity and tieOrder.
     */
    const pickOwner = (
        kind: ContextKind,
        eligible: readonly OwnerSlot[],
        eventTarget: EventTarget | null,
        commandId: CommandId,
    ): OwnerSlot | null => {
        const claimed = ownersForContext(kind, eligible);
        if (claimed.length === 0) return null;
        const capable = claimed.filter((owner) => ownerHasCommand(owner, commandId));
        /* keep a non-capable claimant so a missing handler stays unavailable, not a lower-layer fallthrough */
        const poolBase = capable.length > 0 ? capable : claimed;
        const focused = poolBase.filter((owner) => ownerOwnsTarget(owner, eventTarget));
        const pool = focused.length > 0 ? focused : poolBase;
        let best = pool[0];
        if (!best) return null;
        for (const owner of pool.slice(1)) {
            const bestRank = Math.min(...best.contextKinds.map((k) => CONTEXT_SPECIFICITY[k]));
            const ownerRank = Math.min(...owner.contextKinds.map((k) => CONTEXT_SPECIFICITY[k]));
            if (ownerRank < bestRank) {
                best = owner;
                continue;
            }
            if (ownerRank > bestRank) continue;
            const bestTie = best.tieOrder ?? Number.POSITIVE_INFINITY;
            const ownerTie = owner.tieOrder ?? Number.POSITIVE_INFINITY;
            if (ownerTie < bestTie) best = owner;
        }
        return best;
    };

    /**
     * Whether `policy` allows this live input for `owner`. `ownOrIdle` lets
     * unchorded bindings run when idle or inside the owner; foreign fields
     * still need Ctrl/Alt/Meta.
     */
    const inputPolicyOk = (
        policy: InputPolicy,
        live: LiveTrigger,
        owner: OwnerSlot,
        eventTarget: EventTarget | null,
    ): boolean => {
        const typing = isTypingSurface(eventTarget);
        const inOwn = ownerOwnsTarget(owner, eventTarget);
        if (policy === "never") return !typing;
        if (policy === "chordInInputs") return !typing || chordPresent(live);
        if (policy === "ownOrIdle") return !typing || inOwn || chordPresent(live);
        return inOwn;
    };

    const invokeHandler = (
        owner: OwnerSlot,
        commandId: CommandId,
        ctx: InvokeContext,
        context: ContextKind,
    ): CommandOutcome => {
        const available = owner.available?.[commandId];
        if (available && !available()) return { outcome: "unavailable", commandId, context };
        const flightKey = ownerKey(owner.ownerId, commandId);
        if (inFlight.has(flightKey)) return { outcome: "unavailable", commandId, context };
        const handler = owner.handlers?.[commandId];
        if (!handler) return { outcome: "unavailable", commandId, context };
        try {
            const result = handler(ctx);
            if (result && typeof result.then === "function") {
                inFlight.add(flightKey);
                void result.finally(() => inFlight.delete(flightKey));
            }
            return { outcome: "handled", commandId, context };
        } catch (error) {
            return { outcome: "failed", commandId, error };
        }
    };

    /**
     * Starts or joins a held session for `commandId`, pausing the opposite
     * direction when both are down.
     */
    const startHeld = (
        owner: OwnerSlot,
        commandId: CommandId,
        triggerId: string,
        ctx: InvokeContext,
    ): CommandOutcome => {
        const heldHandler = owner.heldHandlers?.[commandId];
        if (!heldHandler) return { outcome: "unavailable", commandId, context: owner.contextKinds[0] ?? "app" };
        const context =
            mostSpecificClaimedContext(owner.contextKinds, owner.contextKinds) ?? owner.contextKinds[0] ?? "app";
        const available = owner.available?.[commandId];
        if (available && !available()) return { outcome: "unavailable", commandId, context };

        const oppositeId = HELD_OPPOSITE[commandId];
        if (oppositeId) {
            const oppositeKey = ownerKey(owner.ownerId, oppositeId);
            const runningOpposite = held.get(oppositeKey);
            if (runningOpposite) {
                runningOpposite.stop();
                pausedOpposite.set(oppositeKey, runningOpposite);
                held.delete(oppositeKey);
            }
        }

        const key = ownerKey(owner.ownerId, commandId);
        const existing = held.get(key);
        if (existing) {
            existing.contributing.add(triggerId);
            return { outcome: "handled", commandId, context };
        }
        heldHandler.start(ctx);
        held.set(key, {
            commandId,
            ownerId: owner.ownerId,
            contributing: new Set([triggerId]),
            stop: heldHandler.stop,
        });
        return { outcome: "handled", commandId, context };
    };

    const releaseTrigger = (triggerId: string): void => {
        for (const [key, group] of [...held.entries()]) {
            if (!group.contributing.has(triggerId)) continue;
            group.contributing.delete(triggerId);
            if (group.contributing.size > 0) continue;
            group.stop();
            held.delete(key);
            const oppositeId = HELD_OPPOSITE[group.commandId];
            if (!oppositeId) continue;
            const paused = pausedOpposite.get(ownerKey(group.ownerId, oppositeId));
            if (paused && paused.contributing.size > 0) {
                const owner = owners.get(group.ownerId);
                const handler = owner?.heldHandlers?.[oppositeId];
                if (handler) handler.start({ repeat: false, freshPress: false });
                held.set(ownerKey(group.ownerId, oppositeId), paused);
                pausedOpposite.delete(ownerKey(group.ownerId, oppositeId));
            }
        }
        for (const [key, group] of [...pausedOpposite.entries()]) {
            group.contributing.delete(triggerId);
            if (group.contributing.size === 0) pausedOpposite.delete(key);
        }
    };

    const cancelHeldForOwner = (ownerId: string): void => {
        for (const [key, group] of [...held.entries()]) {
            if (group.ownerId !== ownerId) continue;
            group.stop();
            held.delete(key);
        }
        for (const [key, group] of [...pausedOpposite.entries()]) {
            if (group.ownerId !== ownerId) continue;
            pausedOpposite.delete(key);
        }
    };

    const cancelAllHeld = (_reason: string): void => {
        for (const group of held.values()) group.stop();
        held.clear();
        pausedOpposite.clear();
    };

    /**
     * Resolves one live trigger to at most one command and invokes it.
     */
    const routeLive = (live: LiveTrigger, event: Event, eventTarget: EventTarget | null): CommandOutcome => {
        if (uiLocked) {
            consume(event);
            return { outcome: "blocked", reason: "uiLock" };
        }
        if (recording) {
            /* capture on the matching press; Shortcuts then cancels.
             * Spec wanted release-before-dispatch. Upgrade: record on
             * keyup/pointerup so OS-repeat cannot run the new chord. */
            recording(live);
            consume(event);
            return { outcome: "blocked", reason: "recorder" };
        }
        if (!compiled) return { outcome: "unmatched" };

        const eligible = eligibleOwners(eventTarget);
        const contexts = activeContexts(eligible);
        const resolved = resolveCommand(compiled, live, contexts);
        if (resolved.outcome !== "handled") return { outcome: "unmatched" };

        const { candidate, context } = resolved;
        const owner = pickOwner(context, eligible, eventTarget, candidate.commandId);
        if (!owner) return { outcome: "unmatched" };
        if (!inputPolicyOk(candidate.inputPolicy, live, owner, eventTarget)) return { outcome: "unmatched" };

        const catalog = getCommand(candidate.commandId);
        if (!catalog) return { outcome: "unmatched" };

        const freshPress = live.kind === "keyboard" ? !live.repeat : true;
        const ctx: InvokeContext = {
            repeat: live.kind === "keyboard" ? live.repeat : false,
            freshPress,
        };

        if (catalog.invocation === "oneShot" && ctx.repeat) return { outcome: "unmatched" };

        if (catalog.invocation === "held") {
            if (!freshPress) {
                consume(event);
                return { outcome: "handled", commandId: candidate.commandId, context };
            }
            const result = startHeld(owner, candidate.commandId, liveTriggerId(live), ctx);
            if (result.outcome === "handled") consume(event);
            return result;
        }

        const result = invokeHandler(owner, candidate.commandId, ctx, context);
        if (result.outcome === "handled") consume(event);
        return result;
    };

    const handleKeyDown = (e: KeyboardEvent): CommandOutcome => {
        if (isImeOrAltGraph(e) || composing) return { outcome: "blocked", reason: "ime" };
        if (e.key === "Tab" || e.code === "Tab") {
            if (cancelRecording()) {
                consume(e);
                return { outcome: "blocked", reason: "recorder" };
            }
            return { outcome: "blocked", reason: "native" };
        }

        if (e.key === "Escape" || e.code === "Escape") {
            if (uiLocked) {
                consume(e);
                return { outcome: "blocked", reason: "uiLock" };
            }
            if (cancelRecording()) {
                consume(e);
                return { outcome: "blocked", reason: "recorder" };
            }
            const eligible = eligibleOwners(e.target);
            const ownerDepth = (owner: OwnerSlot): number => {
                let depth = 0;
                let parentId = owner.parentOwnerId ?? null;
                const seen = new Set<string>();
                while (parentId && !seen.has(parentId)) {
                    depth += 1;
                    seen.add(parentId);
                    parentId = owners.get(parentId)?.parentOwnerId ?? null;
                }
                return depth;
            };
            const ranked = [...eligible].sort((a, b) => {
                const depthDelta = ownerDepth(b) - ownerDepth(a);
                if (depthDelta !== 0) return depthDelta;
                const aRank = Math.min(...a.contextKinds.map((k) => CONTEXT_SPECIFICITY[k]));
                const bRank = Math.min(...b.contextKinds.map((k) => CONTEXT_SPECIFICITY[k]));
                return aRank - bRank;
            });
            for (const owner of ranked) {
                if (!owner.onEscape) continue;
                if (owner.onEscape()) {
                    consume(e);
                    return { outcome: "dismissed", context: owner.contextKinds[0] ?? "app" };
                }
            }
            return { outcome: "unmatched" };
        }

        /* recorder wins over native Space/Enter so chords like Shift+Space
         * can be captured while a button is focused */
        if (recording) {
            const live = liveTriggerFromKeyboard(e);
            if (!live) return { outcome: "unmatched" };
            return routeLive(live, e, e.target);
        }

        if (
            (e.key === " " || e.key === "Enter" || e.code === "Space" || e.code === "Enter") &&
            isNativeActivationTarget(e.target)
        ) {
            return { outcome: "blocked", reason: "native" };
        }
        if (isNativeSelectTarget(e.target) && (e.key.startsWith("Arrow") || e.key === " " || e.key === "Enter")) {
            return { outcome: "blocked", reason: "native" };
        }

        const live = liveTriggerFromKeyboard(e);
        if (!live) return { outcome: "unmatched" };
        return routeLive(live, e, e.target);
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
        const live = liveTriggerFromKeyboard(e);
        if (live) releaseTrigger(liveTriggerId(live));
        if (
            !(
                e.key === "Control" ||
                e.key === "Shift" ||
                e.key === "Alt" ||
                e.key === "Meta" ||
                e.code.startsWith("Control") ||
                e.code.startsWith("Shift") ||
                e.code.startsWith("Alt") ||
                e.code.startsWith("Meta")
            )
        ) {
            return;
        }
        const lostCtrl = e.key === "Control" || e.code.startsWith("Control");
        const lostAlt = e.key === "Alt" || e.code.startsWith("Alt");
        const lostShift = e.key === "Shift" || e.code.startsWith("Shift");
        const lostMeta = e.key === "Meta" || e.code.startsWith("Meta");
        for (const [key, group] of [...held.entries()]) {
            const kept = new Set<string>();
            for (const id of group.contributing) {
                const mods = id.split(":")[2] ?? "";
                const ctrl = mods[0] === "1";
                const alt = mods[1] === "1";
                const shift = mods[2] === "1";
                const meta = mods[3] === "1";
                if ((lostCtrl && ctrl) || (lostAlt && alt) || (lostShift && shift) || (lostMeta && meta)) continue;
                kept.add(id);
            }
            if (kept.size === group.contributing.size) continue;
            group.contributing = kept;
            if (group.contributing.size === 0) {
                group.stop();
                held.delete(key);
            }
        }
    };

    const handlePointerDown = (e: MouseEvent): CommandOutcome => {
        const live = liveTriggerFromMouse(e);
        if (!live) return { outcome: "unmatched" };
        return routeLive(live, e, e.target);
    };

    const handlePointerUp = (e: MouseEvent): void => {
        const live = liveTriggerFromMouse(e);
        if (live) releaseTrigger(liveTriggerId(live));
    };

    const executeCommand = (commandId: CommandId, ownerId?: string): CommandOutcome => {
        if (uiLocked) return { outcome: "blocked", reason: "uiLock" };
        if (!isCommandId(commandId)) return { outcome: "unmatched" };
        const eligible = eligibleOwners(document.activeElement);
        const catalog = getCommand(commandId);
        if (!catalog) return { outcome: "unmatched" };
        const contexts = activeContexts(eligible);
        const resolvedContext =
            (ownerId
                ? mostSpecificClaimedContext(catalog.contextKinds, owners.get(ownerId)?.contextKinds ?? [])
                : null) ?? mostSpecificClaimedContext(catalog.contextKinds, contexts);
        if (!resolvedContext) return { outcome: "unmatched" };
        const owner =
            (ownerId ? owners.get(ownerId) : undefined) ??
            pickOwner(resolvedContext, eligible, document.activeElement, commandId);
        if (!owner || !owner.visible) return { outcome: "unmatched" };
        const context = mostSpecificClaimedContext(catalog.contextKinds, owner.contextKinds);
        if (!context) return { outcome: "unmatched" };
        const ctx: InvokeContext = { repeat: false, freshPress: true };
        if (catalog.invocation === "held") {
            return startHeld(owner, commandId, "explicit", ctx);
        }
        return invokeHandler(owner, commandId, ctx, context);
    };

    return {
        setDocument,
        setUiLocked,
        beginRecording,
        cancelRecording,
        isRecording: () => recording !== null,
        registerOwner,
        executeCommand,
        handleKeyDown,
        handleKeyUp,
        handlePointerDown,
        handlePointerUp,
        handleBlur: () => cancelAllHeld("blur"),
        handleVisibilityHidden: () => cancelAllHeld("hidden"),
        handleComposition: (active: boolean) => {
            composing = active;
            if (active) cancelAllHeld("ime");
        },
    };
};
