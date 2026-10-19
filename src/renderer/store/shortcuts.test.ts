import { emptyKeymapDocument } from "@common/keybindings";
import { configureStore } from "@reduxjs/toolkit";
import { onInvoke } from "@test/mocks/preload";
import { describe, expect, it } from "vitest";
import type { RootState } from ".";
import shortcutsReducer, {
    addKeymapBinding,
    applyExternalKeymapSnapshot,
    getShortcutsMapped,
    hydrateKeymap,
    shouldApplyRemoteKeymapChange,
} from "./shortcuts";

/** Isolated shortcuts store. */
const makeStore = () =>
    configureStore({
        reducer: { shortcuts: shortcutsReducer },
    });

/** Physical G with no modifiers; used as a persisted navToHome override. */
const keyG = {
    kind: "keyboard" as const,
    code: "KeyG" as const,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
};

describe("shortcuts slice", () => {
    it("starts as catalog defaults while hydrating", () => {
        const store = makeStore();
        expect(store.getState().shortcuts.status).toBe("hydrating");
        expect(getShortcutsMapped(store.getState() as RootState).navToHome).toEqual(["H"]);
    });

    it("hydrateKeymap replaces state from main", async () => {
        onInvoke("keymap:get", () => ({
            status: "ready",
            document: {
                ...emptyKeymapDocument(),
                revision: 4,
                overrides: { navToHome: [keyG] },
            },
            platform: "win32",
        }));
        const store = makeStore();
        await store.dispatch(hydrateKeymap());
        const session = store.getState().shortcuts;
        expect(session.status).toBe("ready");
        expect(session.document.revision).toBe(4);
        expect(getShortcutsMapped(store.getState() as RootState).navToHome).toEqual(["G"]);
    });

    it("addKeymapBinding adds a binding via keymap:edit", async () => {
        const store = makeStore();
        await store.dispatch(hydrateKeymap());
        await store.dispatch(addKeymapBinding({ commandId: "navToHome", trigger: keyG }));
        expect(getShortcutsMapped(store.getState() as RootState).navToHome).toEqual(["H", "G"]);
        expect(store.getState().shortcuts.document.revision).toBe(1);
        expect(store.getState().shortcuts.saveState).toBe("idle");
    });

    it("records stale when keymap:edit rejects the command", async () => {
        onInvoke("keymap:edit", () => ({
            ok: false,
            code: "stale",
            snapshot: {
                status: "ready",
                document: emptyKeymapDocument(),
                platform: "win32",
            },
        }));
        const store = makeStore();
        await store.dispatch(addKeymapBinding({ commandId: "navToHome", trigger: keyG }));
        expect(store.getState().shortcuts.saveState).toBe("stale");
        expect(store.getState().shortcuts.staleCommandId).toBe("navToHome");
    });

    it("ignores an external snapshot with a lower revision", async () => {
        const store = makeStore();
        await store.dispatch(hydrateKeymap());
        await store.dispatch(addKeymapBinding({ commandId: "navToHome", trigger: keyG }));
        expect(store.getState().shortcuts.document.revision).toBe(1);
        await store.dispatch(
            applyExternalKeymapSnapshot({
                status: "ready",
                document: emptyKeymapDocument(),
                platform: "win32",
            }),
        );
        expect(store.getState().shortcuts.document.revision).toBe(1);
        expect(getShortcutsMapped(store.getState() as RootState).navToHome).toEqual(["H", "G"]);
    });
});

describe("shouldApplyRemoteKeymapChange", () => {
    it("skips the origin window even when Sync Settings is on", () => {
        expect(shouldApplyRemoteKeymapChange(1, 1, true)).toBe(false);
    });

    it("applies another window's edit only when Sync Settings is on", () => {
        expect(shouldApplyRemoteKeymapChange(2, 1, true)).toBe(true);
        expect(shouldApplyRemoteKeymapChange(2, 1, false)).toBe(false);
        expect(shouldApplyRemoteKeymapChange(null, 1, true)).toBe(true);
    });
});
