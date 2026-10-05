import { dedupeTriggers, triggersEqual } from "./binding";
import { type CommandId, getCommand, isCommandId, resolveDefaultBindings } from "./catalog";
import type { BindingTrigger, KeymapDocument, KeymapPlatform } from "./types";
import { KEYMAP_SCHEMA_VERSION } from "./types";

/**
 * Typed edit submitted by a renderer. Same-command ops carry the bindings that
 * window last observed so a concurrent edit to this command can be rejected
 * without blocking a merge of a different command.
 */
export type KeymapEditOp =
    | {
          type: "addBinding";
          commandId: CommandId;
          trigger: BindingTrigger;
          expectedBindings: readonly BindingTrigger[];
      }
    | {
          type: "removeBinding";
          commandId: CommandId;
          trigger: BindingTrigger;
          expectedBindings: readonly BindingTrigger[];
      }
    | {
          type: "resetCommand";
          commandId: CommandId;
          expectedBindings: readonly BindingTrigger[];
      }
    | {
          type: "resetAll";
          expectedRevision: number;
      };

/** Why {@link applyKeymapEdit} refused to mutate. */
export type KeymapEditFailureCode = "stale" | "unknownCommand";

/** Successful {@link applyKeymapEdit}: `changed` is false when the op was a no-op. */
export type KeymapEditOk = { ok: true; document: KeymapDocument; changed: boolean };
/** Rejected {@link applyKeymapEdit}; `document` is the unchanged input. */
export type KeymapEditFail = { ok: false; code: KeymapEditFailureCode; document: KeymapDocument };
/** Result of {@link applyKeymapEdit}. */
export type KeymapEditResult = KeymapEditOk | KeymapEditFail;

/** Fresh envelope with no overrides (all commands inherit). */
export const emptyKeymapDocument = (): KeymapDocument => ({
    schemaVersion: KEYMAP_SCHEMA_VERSION,
    revision: 0,
    overrides: {},
});

const cloneDocument = (document: KeymapDocument): KeymapDocument => ({
    schemaVersion: document.schemaVersion,
    revision: document.revision,
    overrides: { ...document.overrides },
    ...(document.inactive
        ? { inactive: document.inactive.map((row) => ({ ...row, bindings: [...row.bindings] })) }
        : {}),
});

/**
 * Effective bindings for one catalog command (override or platform defaults).
 */
export const effectiveBindingsFor = (
    document: KeymapDocument,
    commandId: CommandId,
    platform: KeymapPlatform,
): BindingTrigger[] => {
    const entry = getCommand(commandId);
    if (!entry) return [];
    if (Object.hasOwn(document.overrides, commandId)) {
        return dedupeTriggers(document.overrides[commandId] ?? []);
    }
    return resolveDefaultBindings(entry, platform);
};

const sameBindings = (left: readonly BindingTrigger[], right: readonly BindingTrigger[]): boolean => {
    if (left.length !== right.length) return false;
    return left.every((trigger, index) => {
        const other = right[index];
        return other !== undefined && triggersEqual(trigger, other);
    });
};

const bump = (document: KeymapDocument): KeymapDocument => ({
    ...document,
    revision: document.revision + 1,
});

/**
 * Applies a typed edit to a keymap document. Does not touch the filesystem.
 * Identical add/remove that would not change bindings is `changed: false` and
 * does not bump {@link KeymapDocument.revision}.
 */
export const applyKeymapEdit = (
    document: KeymapDocument,
    operation: KeymapEditOp,
    platform: KeymapPlatform,
): KeymapEditResult => {
    if (operation.type === "resetAll") {
        if (operation.expectedRevision !== document.revision) {
            return { ok: false, code: "stale", document };
        }
        const next = emptyKeymapDocument();
        next.revision = document.revision + 1;
        if (document.inactive) next.inactive = document.inactive;
        return { ok: true, document: next, changed: true };
    }

    if (!isCommandId(operation.commandId)) {
        return { ok: false, code: "unknownCommand", document };
    }
    const commandId = operation.commandId;
    const current = effectiveBindingsFor(document, commandId, platform);
    if (!sameBindings(current, operation.expectedBindings)) {
        return { ok: false, code: "stale", document };
    }

    if (operation.type === "resetCommand") {
        if (!Object.hasOwn(document.overrides, commandId)) {
            return { ok: true, document, changed: false };
        }
        const next = cloneDocument(document);
        delete next.overrides[commandId];
        return { ok: true, document: bump(next), changed: true };
    }

    if (operation.type === "addBinding") {
        if (current.some((trigger) => triggersEqual(trigger, operation.trigger))) {
            return { ok: true, document, changed: false };
        }
        const next = cloneDocument(document);
        next.overrides[commandId] = [...current, operation.trigger];
        return { ok: true, document: bump(next), changed: true };
    }

    const nextBindings = current.filter((trigger) => !triggersEqual(trigger, operation.trigger));
    if (nextBindings.length === current.length) {
        return { ok: true, document, changed: false };
    }
    const next = cloneDocument(document);
    next.overrides[commandId] = nextBindings;
    return { ok: true, document: bump(next), changed: true };
};
