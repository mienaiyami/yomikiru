import { triggersMayOverlap } from "./binding";
import { COMMAND_CATALOG, type CommandId } from "./catalog";
import { classifyBindingOverlap } from "./contexts";
import type { CompiledKeymap } from "./keymap";
import type { BindingTrigger } from "./types";

/** Competing command for one binding on {@link BindingDiagnostic.commandId}. */
export type DiagnosticCompetitor = {
    commandId: CommandId;
    overlap: "conflict" | "harmless";
};

/**
 * Derived warning/info for one command binding. Never persisted; recompute from
 * the compiled keymap after edits, hydration, or catalog changes.
 */
export type BindingDiagnostic = {
    commandId: CommandId;
    trigger: BindingTrigger;
    severity: "warning" | "info";
    competitors: DiagnosticCompetitor[];
};

/**
 * Projects duplicate-binding diagnostics from a compiled keymap. Independent of
 * which Settings screen is open and of transient selection/availability.
 * Overlap uses the same specificity and tie order as keymap resolve on
 * representative location stacks.
 */
export const projectBindingDiagnostics = (keymap: CompiledKeymap): BindingDiagnostic[] => {
    const diagnostics: BindingDiagnostic[] = [];
    for (const left of COMMAND_CATALOG) {
        const leftId = left.id;
        const leftBindings = keymap.byCommand.get(leftId) ?? [];
        for (const trigger of leftBindings) {
            const competitors: DiagnosticCompetitor[] = [];
            for (const right of COMMAND_CATALOG) {
                if (right.id === left.id) continue;
                const rightId = right.id;
                const rightBindings = keymap.byCommand.get(rightId) ?? [];
                const overlaps = rightBindings.some((other) => triggersMayOverlap(trigger, other));
                if (!overlaps) continue;
                competitors.push({
                    commandId: rightId,
                    overlap: classifyBindingOverlap(left, right),
                });
            }
            if (competitors.length === 0) continue;
            const severity = competitors.some((competitor) => competitor.overlap === "conflict")
                ? "warning"
                : "info";
            diagnostics.push({ commandId: leftId, trigger, severity, competitors });
        }
    }
    return diagnostics;
};
