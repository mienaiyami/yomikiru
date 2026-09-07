import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import uiReducer, {
    blockUi,
    selectModalOverlayOpen,
    setAnilistEditOpen,
    setAnilistLoginOpen,
    setAnilistSearchOpen,
    setLibraryScanStatus,
    setSettingsOpen,
    UI_BLOCK_ID_LIBRARY,
    unblockUi,
} from "./ui";

/**
 * Minimal store with only the ui slice for lock-stack tests.
 */
const createUiStore = () =>
    configureStore({
        reducer: { ui: uiReducer },
    });

describe("ui blocks", () => {
    it("starts empty and shows the last stacked lock", () => {
        const store = createUiStore();
        expect(store.getState().ui.blocks).toEqual([]);

        store.dispatch(blockUi({ id: "outer", message: "One" }));
        store.dispatch(blockUi({ id: UI_BLOCK_ID_LIBRARY, message: "Scan" }));
        expect(store.getState().ui.blocks.at(-1)).toEqual({
            id: UI_BLOCK_ID_LIBRARY,
            message: "Scan",
        });
    });

    it("replaces the message when the same id is blocked again", () => {
        const store = createUiStore();
        store.dispatch(blockUi({ id: UI_BLOCK_ID_LIBRARY, message: "Importing" }));
        store.dispatch(blockUi({ id: UI_BLOCK_ID_LIBRARY, message: "3 / 10" }));
        expect(store.getState().ui.blocks).toEqual([{ id: UI_BLOCK_ID_LIBRARY, message: "3 / 10" }]);
    });

    it("unblocks by id and leaves other locks in place", () => {
        const store = createUiStore();
        store.dispatch(blockUi({ id: "outer", message: "One" }));
        store.dispatch(blockUi({ id: "inner", message: "Two" }));
        store.dispatch(unblockUi("inner"));
        expect(store.getState().ui.blocks).toEqual([{ id: "outer", message: "One" }]);
        store.dispatch(unblockUi("missing"));
        expect(store.getState().ui.blocks).toHaveLength(1);
    });
});

describe("ui libraryScanStatus", () => {
    it("starts idle and stores live scan progress", () => {
        const store = createUiStore();
        expect(store.getState().ui.libraryScanStatus).toBeNull();
        store.dispatch(
            setLibraryScanStatus({
                phase: "walking",
                rootIndex: 1,
                rootCount: 2,
                rootPath: "lib",
                currentPath: "lib/a",
                added: 0,
                skipped: 0,
                failed: 0,
                addIndex: 0,
                addTotal: 0,
            }),
        );
        expect(store.getState().ui.libraryScanStatus?.phase).toBe("walking");
        store.dispatch(setLibraryScanStatus(null));
        expect(store.getState().ui.libraryScanStatus).toBeNull();
    });
});

describe("selectModalOverlayOpen", () => {
    it("reports any Settings or AniList modal as open", () => {
        const store = createUiStore();
        expect(selectModalOverlayOpen(store.getState())).toBe(false);

        for (const setOpen of [setSettingsOpen, setAnilistLoginOpen, setAnilistSearchOpen, setAnilistEditOpen]) {
            store.dispatch(setOpen(true));
            expect(selectModalOverlayOpen(store.getState())).toBe(true);
            store.dispatch(setOpen(false));
        }
    });
});
