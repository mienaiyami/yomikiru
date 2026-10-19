import {
    type BindingTrigger,
    type CommandId,
    effectiveBindingsFor,
    emptyKeymapDocument,
    type KeymapDocument,
    type KeymapEditOp,
    type KeymapLoadStatus,
    type KeymapPlatform,
    type KeymapSnapshot,
    keymapPlatformFromNode,
    toShortcutDisplayEntries,
} from "@common/keybindings";
import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import { createRendererLogger } from "../utils/logger";
import type { RootState } from ".";

const log = createRendererLogger("store/shortcuts");

const platformOfThisWindow = (): KeymapPlatform => keymapPlatformFromNode(window.process.platform);

/**
 * Renderer keymap session: canonical {@link KeymapDocument} plus derived
 * display rows for Usage.
 */
export type ShortcutsState = {
    entries: ShortcutSchema[];
    /** Canonical keymap envelope (not the DOM document). */
    document: KeymapDocument;
    status: "hydrating" | KeymapLoadStatus;
    saveState: "idle" | "saving" | "failed" | "stale";
    /** Catalog command id of a stale same-command edit; null for resetAll. */
    staleCommandId: CommandId | null;
    platform: KeymapPlatform;
};

const entriesFromSnapshot = (snapshot: KeymapSnapshot): ShortcutSchema[] =>
    toShortcutDisplayEntries(snapshot.document, snapshot.platform);

const stateFromSnapshot = (
    snapshot: KeymapSnapshot,
    saveState: ShortcutsState["saveState"] = "idle",
    staleCommandId: CommandId | null = null,
): ShortcutsState => ({
    entries: entriesFromSnapshot(snapshot),
    document: snapshot.document,
    status: snapshot.status,
    saveState,
    staleCommandId,
    platform: snapshot.platform,
});

const initialPlatform = platformOfThisWindow();

/**
 * Catalog defaults until {@link hydrateKeymap} returns the durable snapshot.
 *
 * First paint may briefly show catalog keys before custom ones.
 * Upgrade is a blocking splash or a snapshot injected before first React paint.
 */
export const initialShortcutsState: ShortcutsState = {
    entries: toShortcutDisplayEntries(emptyKeymapDocument(), initialPlatform),
    document: emptyKeymapDocument(),
    status: "hydrating",
    saveState: "idle",
    staleCommandId: null,
    platform: initialPlatform,
};

/**
 * Loads the canonical keymap from main. Safe to call more than once; later
 * snapshots with a lower revision are ignored.
 */
export const hydrateKeymap = createAsyncThunk("shortcuts/hydrate", async () => {
    return await window.electron.invoke("keymap:get");
});

/** Sends one typed edit to the main-process keymap owner. */
const editKeymap = createAsyncThunk("shortcuts/edit", async (operation: KeymapEditOp) => {
    return await window.electron.invoke("keymap:edit", operation);
});

type BindingEditArgs = {
    commandId: CommandId;
    trigger: BindingTrigger;
};

/**
 * Adds one {@link BindingTrigger} to a command. Duplicate add is a no-op in main.
 */
export const addKeymapBinding = createAsyncThunk(
    "shortcuts/addBinding",
    async ({ commandId, trigger }: BindingEditArgs, { getState, dispatch }) => {
        const session = (getState() as RootState).shortcuts;
        const expectedBindings = effectiveBindingsFor(session.document, commandId, session.platform);
        await dispatch(
            editKeymap({
                type: "addBinding",
                commandId,
                trigger,
                expectedBindings,
            }),
        );
    },
);

/** Removes one {@link BindingTrigger} from a command. */
export const removeKeymapBinding = createAsyncThunk(
    "shortcuts/removeBinding",
    async ({ commandId, trigger }: BindingEditArgs, { getState, dispatch }) => {
        const session = (getState() as RootState).shortcuts;
        const expectedBindings = effectiveBindingsFor(session.document, commandId, session.platform);
        await dispatch(
            editKeymap({
                type: "removeBinding",
                commandId,
                trigger,
                expectedBindings,
            }),
        );
    },
);

/** Restores catalog defaults for one command (drops its override). */
export const resetKeymapCommand = createAsyncThunk(
    "shortcuts/resetCommand",
    async (commandId: CommandId, { getState, dispatch }) => {
        const session = (getState() as RootState).shortcuts;
        const expectedBindings = effectiveBindingsFor(session.document, commandId, session.platform);
        await dispatch(
            editKeymap({
                type: "resetCommand",
                commandId,
                expectedBindings,
            }),
        );
    },
);

/** Clears every override (inherit catalog defaults) after a revision check. */
export const resetShortcuts = createAsyncThunk("shortcuts/resetAll", async (_, { getState, dispatch }) => {
    const session = (getState() as RootState).shortcuts;
    await dispatch(
        editKeymap({
            type: "resetAll",
            expectedRevision: session.document.revision,
        }),
    );
});

/**
 * Applies a snapshot from another window when Sync Settings is on.
 * Same-window echoes and older revisions are ignored by the caller / reducer.
 */
export const applyExternalKeymapSnapshot = createAsyncThunk(
    "shortcuts/applyExternal",
    async (snapshot: KeymapSnapshot) => snapshot,
);

/**
 * Whether this window should apply a `keymap:changed` broadcast.
 * The origin window already applied the invoke result; others follow Sync Settings.
 *
 * @param originWindowId BrowserWindow id that submitted the edit, or null
 * @param thisWindowId this renderer's {@link window.electron.currentWindow} id
 */
export const shouldApplyRemoteKeymapChange = (
    originWindowId: number | null,
    thisWindowId: number,
    syncSettingsEnabled: boolean,
): boolean => {
    if (originWindowId !== null && originWindowId === thisWindowId) return false;
    return syncSettingsEnabled;
};

/**
 * Replaces session state when the snapshot is not older than the current revision.
 * Equal revision is applied so a no-op edit still leaves saveState idle.
 */
const applySnapshotIfNewer = (state: ShortcutsState, snapshot: KeymapSnapshot): ShortcutsState => {
    if (snapshot.document.revision < state.document.revision) return state;
    return stateFromSnapshot(snapshot, "idle", null);
};

const shortcuts = createSlice({
    name: "shortcuts",
    initialState: initialShortcutsState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(hydrateKeymap.fulfilled, (state, action) => applySnapshotIfNewer(state, action.payload));
        builder.addCase(hydrateKeymap.rejected, (state) => {
            log.error("keymap:get invoke failed");
            // keep catalog defaults; IPC failure is not a durable recovery snapshot
            state.saveState = "failed";
        });
        builder.addCase(editKeymap.pending, (state) => {
            state.saveState = "saving";
        });
        builder.addCase(editKeymap.fulfilled, (state, action) => {
            const result = action.payload;
            if (result.ok) {
                return applySnapshotIfNewer(state, result.snapshot);
            }
            if (result.code === "stale") {
                const operation = action.meta.arg;
                const staleCommandId = operation.type === "resetAll" ? null : operation.commandId;
                return stateFromSnapshot(result.snapshot, "stale", staleCommandId);
            }
            return stateFromSnapshot(result.snapshot, "failed");
        });
        builder.addCase(editKeymap.rejected, (state) => {
            state.saveState = "failed";
            log.error("keymap:edit invoke failed");
        });
        builder.addCase(applyExternalKeymapSnapshot.fulfilled, (state, action) =>
            applySnapshotIfNewer(state, action.payload),
        );
    },
});

/**
 * Command -> display-key map for Usage. Memoized so callers do not re-render
 * when unrelated store slices change.
 */
export const getShortcutsMapped = createSelector([(state: RootState) => state.shortcuts.entries], (entries) => {
    const mapped = {} as Record<ShortcutCommands, string[]>;
    for (const entry of entries) {
        mapped[entry.command] = entry.keys;
    }
    return mapped;
});

export default shortcuts.reducer;
