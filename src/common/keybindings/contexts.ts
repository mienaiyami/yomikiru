import type { ContextKind } from "./types";

/**
 * Specificity rank for owner selection. Lower is more specific and wins when
 * several declared contexts are active. mangaReader and bookReader share a
 * rank because they never coexist.
 */
export const CONTEXT_SPECIFICITY: Readonly<Record<ContextKind, number>> = {
    uiLock: 0,
    recorder: 1,
    modal: 2,
    menu: 3,
    settings: 4,
    readerPanel: 5,
    searchWidget: 6,
    selection: 7,
    galleryDetails: 8,
    mangaReader: 9,
    bookReader: 9,
    home: 10,
    app: 11,
};

/**
 * Mutually exclusive "where the window is" kinds. App chrome is ambient on
 * each; overlays are added separately when a command claims them.
 */
const LOCATION_KINDS = ["home", "mangaReader", "bookReader"] as const satisfies readonly ContextKind[];

const isLocationKind = (kind: ContextKind): kind is (typeof LOCATION_KINDS)[number] =>
    (LOCATION_KINDS as readonly ContextKind[]).includes(kind);

const mutuallyExclusive = (left: ContextKind, right: ContextKind): boolean => {
    if (left === right) return false;
    const leftIsReader = left === "mangaReader" || left === "bookReader";
    const rightIsReader = right === "mangaReader" || right === "bookReader";
    if (leftIsReader && rightIsReader) return true;
    if ((leftIsReader && right === "home") || (rightIsReader && left === "home")) return true;
    if ((leftIsReader && right === "galleryDetails") || (rightIsReader && left === "galleryDetails")) {
        return true;
    }
    if (left === "uiLock" || right === "uiLock") return true;
    if (left === "recorder" || right === "recorder") return true;
    return false;
};

/**
 * Whether two context kinds can be active in one window at once. Runtime
 * still consults the actual owner set; this is for overlap math only.
 */
export const contextsCanCoexist = (left: ContextKind, right: ContextKind): boolean =>
    left === right || !mutuallyExclusive(left, right);

/**
 * True when any context of `left` can be active together with any of `right`.
 */
export const contextSetsCanOverlap = (left: readonly ContextKind[], right: readonly ContextKind[]): boolean =>
    left.some((leftKind) => right.some((rightKind) => contextsCanCoexist(leftKind, rightKind)));

/**
 * Catalog fields needed to pick a winner the same way as keymap resolve.
 */
export type ClaimedCommand = {
    contextKinds: readonly ContextKind[];
    tieOrder: number;
};

/**
 * Most specific context in `active` that is also in `claimed`. `null` when
 * the owner set does not claim this input's environments.
 */
export const mostSpecificClaimedContext = (
    claimed: readonly ContextKind[],
    active: readonly ContextKind[],
): ContextKind | null => {
    let best: ContextKind | null = null;
    let bestRank = Number.POSITIVE_INFINITY;
    for (const kind of claimed) {
        if (!active.includes(kind)) continue;
        const rank = CONTEXT_SPECIFICITY[kind];
        if (rank < bestRank) {
            best = kind;
            bestRank = rank;
        }
    }
    return best;
};

/**
 * Sort key for two claiming commands on `active`: more specific claimed
 * context first, then lower {@link ClaimedCommand.tieOrder}. Callers must
 * pass a set where both already claim something (keymap resolve drops the rest).
 */
export const compareClaimedCommands = (
    left: ClaimedCommand,
    right: ClaimedCommand,
    active: readonly ContextKind[],
): number => {
    const leftContext = mostSpecificClaimedContext(left.contextKinds, active);
    const rightContext = mostSpecificClaimedContext(right.contextKinds, active);
    if (leftContext && rightContext && leftContext !== rightContext) {
        return CONTEXT_SPECIFICITY[leftContext] - CONTEXT_SPECIFICITY[rightContext];
    }
    return left.tieOrder - right.tieOrder;
};

/**
 * Typical mounted stacks for Settings overlap notes: ambient app plus one
 * location, then that stack with each overlay either command claims when the
 * overlay can coexist. Catalog commands claim few overlays (named ceiling).
 */
export const representativeActiveSets = (
    left: readonly ContextKind[],
    right: readonly ContextKind[],
): ContextKind[][] => {
    const claimed = new Set<ContextKind>([...left, ...right]);
    const overlays = [...claimed].filter((kind) => kind !== "app" && !isLocationKind(kind));
    const sets: ContextKind[][] = [];
    for (const location of LOCATION_KINDS) {
        if (!contextsCanCoexist("app", location)) continue;
        const base: ContextKind[] = ["app", location];
        sets.push(base);
        for (const overlay of overlays) {
            if (base.every((kind) => contextsCanCoexist(overlay, kind))) {
                sets.push([...base, overlay]);
            }
        }
    }
    return sets;
};

/**
 * Whether a shared trigger is a same-window fight or layered reuse. Harmless
 * when each command still wins on at least one representative stack. Conflict
 * when one command never wins (shared-claim tie, or a more specific claimant
 * on every stack).
 */
export const classifyBindingOverlap = (left: ClaimedCommand, right: ClaimedCommand): "conflict" | "harmless" => {
    let leftWins = false;
    let rightWins = false;
    for (const active of representativeActiveSets(left.contextKinds, right.contextKinds)) {
        const leftCtx = mostSpecificClaimedContext(left.contextKinds, active);
        const rightCtx = mostSpecificClaimedContext(right.contextKinds, active);
        if (!leftCtx && !rightCtx) continue;
        if (leftCtx && !rightCtx) {
            leftWins = true;
            continue;
        }
        if (!leftCtx && rightCtx) {
            rightWins = true;
            continue;
        }
        if (compareClaimedCommands(left, right, active) <= 0) leftWins = true;
        else rightWins = true;
    }
    return leftWins && rightWins ? "harmless" : "conflict";
};
