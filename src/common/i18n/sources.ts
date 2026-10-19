import { BUILTIN_EN_SOURCE } from "./builtins";
import { PACK_ID_PATTERN } from "./packSchema";
import type { LanguageSource } from "./types";

export type { LanguageSource, LanguageSourceKind } from "./types";

/**
 * Builds the stable source id for an installed pack (`pack:<packId>`).
 */
export const packSourceId = (packId: string): string => `pack:${packId}`;

/**
 * Parses `pack:<id>` source ids. Returns null for builtins, empty ids, or ids outside {@link PACK_ID_PATTERN}.
 */
export const parsePackSourceId = (sourceId: string): string | null => {
    if (!sourceId.startsWith("pack:")) return null;
    const packId = sourceId.slice("pack:".length);
    if (!PACK_ID_PATTERN.test(packId)) return null;
    return packId;
};

/**
 * Resolves `sourceId` against available sources; heals to builtin English when missing.
 */
export const resolveLanguageSource = (
    sourceId: string,
    sources: readonly LanguageSource[],
): { source: LanguageSource; healed: boolean } => {
    const found = sources.find((s) => s.id === sourceId);
    if (found) return { source: found, healed: false };
    return { source: BUILTIN_EN_SOURCE, healed: true };
};
