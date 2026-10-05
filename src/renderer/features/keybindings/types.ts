import type { CommandId, ContextKind } from "@common/keybindings";

/**
 * Why a routed command did not run even though an owner claimed the context.
 */
export type BlockedReason = "uiLock" | "recorder" | "modality" | "native" | "ime";

/** Typed result of one ingress or {@link KeybindingRuntime.executeCommand} call. */
export type CommandOutcome =
    | { outcome: "handled"; commandId: CommandId; context: ContextKind }
    | { outcome: "dismissed"; context: ContextKind }
    | { outcome: "unavailable"; commandId: CommandId; context: ContextKind }
    | { outcome: "blocked"; reason: BlockedReason }
    | { outcome: "unmatched" }
    | { outcome: "failed"; commandId: CommandId; error: unknown };

/**
 * Repeat / first-press facts for one invocation. Held commands use `freshPress`
 * to start a session; manga page stepping uses it at chapter edges.
 */
export type InvokeContext = {
    repeat: boolean;
    freshPress: boolean;
};

/** One-shot or repeating command body. */
export type CommandHandler = (ctx: InvokeContext) => void | Promise<void>;

/** Held command: `start` begins animation; `stop` is idempotent. */
export type HeldCommandHandler = {
    start: (ctx: InvokeContext) => void;
    stop: () => void;
};

/**
 * One mounted owner in this renderer. `ownerId` is unique in the window.
 * Cleanup of a registration token must not delete a newer slot with the same id.
 */
export type OwnerSpec = {
    ownerId: string;
    contextKinds: readonly ContextKind[];
    visible: boolean;
    parentOwnerId?: string | null;
    /** Fallback containment root when {@link OwnerSpec.ownsEventTarget} is omitted. */
    focusRoot?: () => HTMLElement | null;
    /**
     * When set, used instead of a single {@link OwnerSpec.focusRoot} contains
     * check (eligibility and `ownInputs` / `ownOrIdle`).
     */
    ownsEventTarget?: (node: EventTarget | null) => boolean;
    handlers?: Partial<Record<CommandId, CommandHandler>>;
    heldHandlers?: Partial<Record<CommandId, HeldCommandHandler>>;
    available?: Partial<Record<CommandId, () => boolean>>;
    /**
     * Same-context owner rank; lower wins. Used for simultaneous home search
     * fields. Omitted owners rank after explicit values.
     */
    tieOrder?: number;
    /** Escape dismissal; return true when this press was consumed. */
    onEscape?: () => boolean;
};

/** Handle returned by {@link KeybindingRuntime.registerOwner}. */
export type OwnerToken = {
    update: (spec: OwnerSpec) => void;
    unregister: () => void;
};

/** Optional test seams for time and async animation (held sessions stay feature-owned). */
export type RuntimeClock = {
    now: () => number;
};
