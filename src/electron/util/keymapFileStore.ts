import path from "node:path";
import {
    applyKeymapEdit,
    emptyKeymapDocument,
    ingestPersistedKeymap,
    type KeymapDocument,
    type KeymapEditIpcResult,
    type KeymapEditOp,
    type KeymapLoadStatus,
    type KeymapPlatform,
    type KeymapSnapshot,
} from "@common/keybindings";
import { createJsonFileOwner } from "./file";
import { createMainLogger } from "./logger";

const log = createMainLogger("util/keymapFileStore");

export type KeymapFileStore = {
    /** Reads disk, migrates if needed, and becomes the canonical in-memory document. */
    load: () => Promise<KeymapSnapshot>;
    snapshot: () => KeymapSnapshot;
    applyEdit: (operation: KeymapEditOp) => Promise<KeymapEditIpcResult>;
};

/**
 * Process-local keymap owner. Callers must {@link KeymapFileStore.load} once
 * before serving IPC. Disk IO is {@link createJsonFileOwner}; this module owns
 * ingest, typed edits, and recovery / read-only policy.
 */
export const createKeymapFileStore = (options: {
    keymapPath: string;
    platform: KeymapPlatform;
}): KeymapFileStore => {
    const json = createJsonFileOwner(options.keymapPath);
    const keymapPath = options.keymapPath;
    const platform = options.platform;

    let status: KeymapLoadStatus = "recovery";
    let document: KeymapDocument = emptyKeymapDocument();

    const snapshot = (): KeymapSnapshot => ({ status, document, platform });

    const persist = async (next: KeymapDocument): Promise<boolean> => {
        try {
            await json.save(next);
            document = next;
            status = "ready";
            return true;
        } catch (err) {
            log.error("keymap atomic write failed; previous document kept", { keymapPath }, err);
            return false;
        }
    };

    const load = (): Promise<KeymapSnapshot> =>
        json.enqueue(async () => {
            const loaded = await json.load();
            if (loaded.kind === "missing") {
                const fresh = emptyKeymapDocument();
                const written = await persist(fresh);
                if (!written) {
                    status = "recovery";
                    document = fresh;
                    log.error("could not create shortcuts.json; using in-memory defaults");
                }
                return snapshot();
            }
            if (loaded.kind === "unreadable") {
                log.error(
                    "shortcuts.json unreadable; recovery defaults, file left intact",
                    { keymapPath },
                    loaded.err,
                );
                status = "recovery";
                document = emptyKeymapDocument();
                return snapshot();
            }
            if (loaded.kind === "invalidJson") {
                log.error(
                    "shortcuts.json is not JSON; recovery defaults, file left intact",
                    { keymapPath },
                    loaded.err,
                );
                status = "recovery";
                document = emptyKeymapDocument();
                return snapshot();
            }

            const ingested = ingestPersistedKeymap(loaded.value);
            if (ingested.status === "unsupportedVersion") {
                log.warn("shortcuts.json schema is newer than this build; file is read-only", {
                    schemaVersion: ingested.schemaVersion,
                });
                status = "readOnly";
                document = emptyKeymapDocument();
                return snapshot();
            }
            if (ingested.status === "corrupt") {
                log.error("shortcuts.json failed ingest; recovery defaults, file left intact", {
                    reason: ingested.reason,
                });
                status = "recovery";
                document = emptyKeymapDocument();
                return snapshot();
            }

            if (ingested.migratedFrom !== null) {
                try {
                    await json.backupIfAbsent();
                } catch (err) {
                    log.error("keymap backup before migrate failed; source left intact", { keymapPath }, err);
                    status = "recovery";
                    document = ingested.document;
                    return snapshot();
                }
                const written = await persist(ingested.document);
                if (!written) {
                    status = "recovery";
                    document = ingested.document;
                    return snapshot();
                }
                log.log("shortcuts.json migrated to keymap envelope", { from: ingested.migratedFrom });
                return snapshot();
            }

            document = ingested.document;
            status = "ready";
            return snapshot();
        });

    const applyEdit = (operation: KeymapEditOp): Promise<KeymapEditIpcResult> =>
        json.enqueue(async () => {
            const current = snapshot();
            if (current.status === "readOnly") {
                return { ok: false, code: "readOnly", snapshot: current };
            }
            if (current.status === "recovery" && operation.type !== "resetAll") {
                return { ok: false, code: "recoveryBlocked", snapshot: current };
            }

            const edited = applyKeymapEdit(current.document, operation, platform);
            if (!edited.ok) {
                return { ok: false, code: edited.code, snapshot: current };
            }
            if (!edited.changed) {
                return { ok: true, snapshot: current };
            }
            const written = await persist(edited.document);
            if (!written) {
                return { ok: false, code: "writeFailed", snapshot: snapshot() };
            }
            return { ok: true, snapshot: snapshot() };
        });

    return { load, snapshot, applyEdit };
};

let processStore: KeymapFileStore | null = null;

/**
 * Creates the process-wide keymap owner and loads/migrates `shortcuts.json`.
 * Call from `app.ready` before the first window.
 */
export const initializeKeymapFileStore = async (
    userDataPath: string,
    platform: KeymapPlatform,
): Promise<KeymapSnapshot> => {
    processStore = createKeymapFileStore({
        keymapPath: path.join(userDataPath, "shortcuts.json"),
        platform,
    });
    return processStore.load();
};

/**
 * Canonical keymap owner for IPC handlers.
 *
 * @throws {Error} When {@link initializeKeymapFileStore} has not run
 */
export const getKeymapFileStore = (): KeymapFileStore => {
    if (!processStore) throw new Error("keymap file store is not initialized");
    return processStore;
};

/** Keymap owner if {@link initializeKeymapFileStore} has run; otherwise null. */
export const tryGetKeymapFileStore = (): KeymapFileStore | null => processStore;
