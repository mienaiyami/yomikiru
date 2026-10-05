/* COMPAT: on-disk keymap ingest. Pre-envelope arrays and historical
 * `key1`/`key2` helpers live in `legacy.ts`. This module orchestrates zod
 * envelopes, inactive rows, and synthesized split commands.
 */
import { z } from "zod";
import { dedupeTriggers, parsePhysicalBindingString } from "./binding";
import { type CommandId, isCommandId } from "./catalog";
import { parseHistoricalKeyString, withShift } from "./legacy";
import type {
    BindingTrigger,
    InactiveBindingRow,
    KeymapDocument,
    KeymapIngestResult,
    KeymapIngestWarning,
} from "./types";
import { isKeyboardCode, KEYMAP_SCHEMA_VERSION } from "./types";

const triggerSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("keyboard"),
        code: z.string().min(1),
        ctrl: z.boolean(),
        alt: z.boolean(),
        shift: z.boolean(),
        meta: z.boolean(),
    }),
    z.object({
        kind: z.literal("logicalKey"),
        key: z.string().min(1),
        ctrl: z.boolean(),
        alt: z.boolean(),
        shift: z.boolean(),
        meta: z.boolean(),
    }),
    z.object({
        kind: z.literal("pointer"),
        button: z.enum(["back", "forward"]),
        ctrl: z.boolean(),
        alt: z.boolean(),
        shift: z.boolean(),
        meta: z.boolean(),
        modifierMatch: z.enum(["exact", "any"]),
    }),
]);

const inactiveRowSchema = z.object({
    command: z.string(),
    bindings: z.array(triggerSchema),
    raw: z.unknown(),
});

const envelopeSchema = z.object({
    schemaVersion: z.number().int(),
    revision: z.number().int().nonnegative(),
    overrides: z.record(z.array(triggerSchema)),
    inactive: z.array(inactiveRowSchema).optional(),
});

const currentRowSchema = z.object({
    command: z.string(),
    keys: z.array(z.string()),
});

const historicalRowSchema = z.object({
    command: z.string(),
    name: z.string().optional(),
    key1: z.string(),
    key2: z.string(),
});

type ParsedRow = { command: string; bindings: BindingTrigger[]; warnings: KeymapIngestWarning[]; raw: unknown };

const parsePhysicalKeys = (command: string, keys: readonly string[]): ParsedRow => {
    const bindings: BindingTrigger[] = [];
    const warnings: KeymapIngestWarning[] = [];
    for (const key of keys) {
        const parsed = parsePhysicalBindingString(key);
        if (!parsed.ok) {
            warnings.push({ code: "malformedRow", command, detail: key });
            continue;
        }
        bindings.push(parsed.trigger);
    }
    const unique = dedupeTriggers(bindings);
    if (unique.length !== bindings.length) {
        warnings.push({ code: "duplicateTrigger", command, detail: "identical triggers collapsed" });
    }
    return { command, bindings: unique, warnings, raw: keys };
};

const parseHistoricalKeys = (command: string, key1: string, key2: string, raw: unknown): ParsedRow => {
    const bindings: BindingTrigger[] = [];
    const warnings: KeymapIngestWarning[] = [];
    for (const key of [key1, key2]) {
        const parsed = parseHistoricalKeyString(key);
        if (!parsed.ok) {
            if (parsed.reason !== "empty") warnings.push({ code: "malformedRow", command, detail: key });
            continue;
        }
        bindings.push(parsed.trigger);
    }
    return { command, bindings: dedupeTriggers(bindings), warnings, raw };
};

/**
 * Drops keyboard rows whose `code` is not a {@link KeyboardCode} so a single
 * unknown physical code cannot fail ingest of the rest of the file.
 */
const keepExecutableBindings = (
    command: string,
    bindings: readonly z.infer<typeof triggerSchema>[],
    warnings: KeymapIngestWarning[],
): BindingTrigger[] => {
    const kept: BindingTrigger[] = [];
    for (const binding of bindings) {
        if (binding.kind === "keyboard") {
            if (!isKeyboardCode(binding.code)) {
                warnings.push({ code: "unsupportedTrigger", command, detail: binding.code });
                continue;
            }
            kept.push({
                kind: "keyboard",
                code: binding.code,
                ctrl: binding.ctrl,
                alt: binding.alt,
                shift: binding.shift,
                meta: binding.meta,
            });
            continue;
        }
        kept.push(binding);
    }
    return dedupeTriggers(kept);
};

/**
 * Copies chapter/fit bindings onto split catalog commands that older files
 * did not have as their own rows.
 */
const applySynthesizedCommands = (
    overrides: Partial<Record<CommandId, BindingTrigger[]>>,
    presentIds: ReadonlySet<string>,
): void => {
    /* Settings tabs used the chapter bindings; copy including explicit unbind. */
    if (presentIds.has("nextChapter") && !presentIds.has("settingsTabNext")) {
        overrides.settingsTabNext = [...(overrides.nextChapter ?? [])];
    }
    if (presentIds.has("prevChapter") && !presentIds.has("settingsTabPrev")) {
        overrides.settingsTabPrev = [...(overrides.prevChapter ?? [])];
    }
    if (presentIds.has("cycleFitOptions") && !presentIds.has("cycleFitOptionsReverse")) {
        const source = overrides.cycleFitOptions ?? [];
        const reversed: BindingTrigger[] = [];
        for (const trigger of source) {
            const shifted = withShift(trigger);
            if (shifted) reversed.push(shifted);
        }
        overrides.cycleFitOptionsReverse = reversed;
    }
};

const rowsToDocument = (
    rows: ParsedRow[],
    migratedFrom: "array" | "historical",
    extraWarnings: KeymapIngestWarning[] = [],
): KeymapIngestResult => {
    const overrides: Partial<Record<CommandId, BindingTrigger[]>> = {};
    const inactive: InactiveBindingRow[] = [];
    const warnings = [...extraWarnings];
    const presentIds = new Set<string>();
    for (const row of rows) {
        warnings.push(...row.warnings);
        if (presentIds.has(row.command)) {
            warnings.push({
                code: "duplicateTrigger",
                command: row.command,
                detail: "later row ignored; first row kept",
            });
            continue;
        }
        presentIds.add(row.command);
        if (isCommandId(row.command)) {
            overrides[row.command] = row.bindings;
        } else {
            warnings.push({ code: "unknownCommand", command: row.command, detail: "preserved inactive" });
            inactive.push({ command: row.command, bindings: row.bindings, raw: row.raw });
        }
    }
    applySynthesizedCommands(overrides, presentIds);
    const document: KeymapDocument = {
        schemaVersion: KEYMAP_SCHEMA_VERSION,
        revision: 0,
        overrides,
        ...(inactive.length > 0 ? { inactive } : {}),
    };
    return { status: "ok", document, migratedFrom, warnings };
};

const ingestEnvelope = (raw: unknown): KeymapIngestResult => {
    const parsed = envelopeSchema.safeParse(raw);
    if (!parsed.success) {
        return { status: "corrupt", reason: parsed.error.message, raw };
    }
    if (parsed.data.schemaVersion > KEYMAP_SCHEMA_VERSION) {
        return { status: "unsupportedVersion", schemaVersion: parsed.data.schemaVersion, raw };
    }
    if (parsed.data.schemaVersion < 1) {
        return { status: "corrupt", reason: "schemaVersion must be >= 1", raw };
    }
    const overrides: Partial<Record<CommandId, BindingTrigger[]>> = {};
    const warnings: KeymapIngestWarning[] = [];
    /* inactive rows are unknown commands, not unknown codes; codes still go through keepExecutableBindings */
    const inactive: InactiveBindingRow[] = (parsed.data.inactive ?? []).map((row) => ({
        command: row.command,
        bindings: keepExecutableBindings(row.command, row.bindings, warnings),
        // envelope parse may omit raw; keep the parsed row as the recovery payload
        raw: row.raw ?? row,
    }));
    for (const [command, bindings] of Object.entries(parsed.data.overrides)) {
        const unique = keepExecutableBindings(command, bindings, warnings);
        if (isCommandId(command)) {
            overrides[command] = unique;
        } else {
            warnings.push({ code: "unknownCommand", command, detail: "preserved inactive" });
            inactive.push({ command, bindings: unique, raw: bindings });
        }
    }
    return {
        status: "ok",
        document: {
            schemaVersion: KEYMAP_SCHEMA_VERSION,
            revision: parsed.data.revision,
            overrides,
            ...(inactive.length > 0 ? { inactive } : {}),
        },
        migratedFrom: null,
        warnings,
    };
};

const isHistoricalArray = (rows: unknown[]): boolean => {
    const first = rows[0];
    return Boolean(first && typeof first === "object" && first !== null && "key1" in first);
};

/**
 * COMPAT: reads any supported on-disk keymap shape into {@link KeymapDocument}.
 * Pre-envelope arrays and historical `key1`/`key2` parsing live in `legacy.ts`.
 * Does not touch the filesystem. Newer unsupported versions are not rewritten.
 */
export const ingestPersistedKeymap = (raw: unknown): KeymapIngestResult => {
    if (raw === null || raw === undefined) {
        return { status: "corrupt", reason: "empty keymap document", raw };
    }
    if (Array.isArray(raw)) {
        if (raw.length === 0) {
            return {
                status: "ok",
                document: { schemaVersion: KEYMAP_SCHEMA_VERSION, revision: 0, overrides: {} },
                migratedFrom: "array",
                warnings: [],
            };
        }
        if (isHistoricalArray(raw)) {
            const rows: ParsedRow[] = [];
            const extraWarnings: KeymapIngestWarning[] = [];
            for (const item of raw) {
                const parsed = historicalRowSchema.safeParse(item);
                if (!parsed.success) {
                    extraWarnings.push({ code: "malformedRow", detail: "historical row skipped" });
                    continue;
                }
                rows.push(parseHistoricalKeys(parsed.data.command, parsed.data.key1, parsed.data.key2, item));
            }
            return rowsToDocument(rows, "historical", extraWarnings);
        }
        const rows: ParsedRow[] = [];
        const extraWarnings: KeymapIngestWarning[] = [];
        for (const item of raw) {
            const parsed = currentRowSchema.safeParse(item);
            if (!parsed.success) {
                extraWarnings.push({ code: "malformedRow", detail: "array row skipped" });
                continue;
            }
            rows.push(parsePhysicalKeys(parsed.data.command, parsed.data.keys));
        }
        return rowsToDocument(rows, "array", extraWarnings);
    }
    if (typeof raw === "object") {
        if ("schemaVersion" in raw) return ingestEnvelope(raw);
        return { status: "corrupt", reason: "unrecognized keymap object", raw };
    }
    return { status: "corrupt", reason: "keymap must be an array or object", raw };
};
