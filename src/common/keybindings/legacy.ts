/* COMPAT: ingest helpers for pre-envelope `shortcuts.json` and one-shot
 * catalog splits. Do not call from the recorder, catalog defaults, or new
 * Settings edits.
 *
 * Remove this module, LogicalKeyTrigger, and the logical branches in
 * triggerMatchesLive / triggersMayOverlap once historical key1/key2 arrays
 * and pre-envelope keys files are no longer in the wild (plan: a couple of
 * years after the v1 envelope shipped).
 */
import { type BindingParseResult, pointerTriggerFromToken, splitBindingCombo } from "./binding";
import type { BindingTrigger, KeyModifiers } from "./types";
import { keyModifiers } from "./types";

/**
 * Parses a pre-2.18.5 `key1`/`key2` `KeyboardEvent.key` string. Empty means
 * unbound. Conversion to a physical code is not attempted; identity stays
 * logical so a non-US layout is not silently rewritten.
 */
export const parseHistoricalKeyString = (raw: string): BindingParseResult => {
    if (raw === "") return { ok: false, reason: "empty" };
    const split = splitBindingCombo(raw);
    if (!split.ok) {
        if (raw === " ") {
            return { ok: true, trigger: { kind: "logicalKey", key: " ", ...keyModifiers() } };
        }
        return { ok: false, reason: split.reason };
    }
    const pointer = pointerTriggerFromToken(split.keyToken, split.mods, "any");
    if (pointer) return { ok: true, trigger: pointer };
    return { ok: true, trigger: { kind: "logicalKey", key: split.keyToken, ...split.mods } };
};

/**
 * Adds Shift to a physical/pointer trigger when it is not already shifted.
 * Used when expanding implicit reverse-fit chords during ingest.
 *
 * @returns A new trigger, or `null` when Shift is already required.
 */
export const withShift = (trigger: BindingTrigger): BindingTrigger | null => {
    if (trigger.shift) return null;
    const mods: KeyModifiers = { ...trigger, shift: true };
    if (trigger.kind === "pointer") {
        return {
            ...trigger,
            ...mods,
            modifierMatch: trigger.modifierMatch === "any" ? "exact" : trigger.modifierMatch,
        };
    }
    return { ...trigger, ...mods };
};
