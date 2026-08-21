import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import uiReducer, { UI_BLOCK_ID_LIBRARY, blockUi, setLibraryScanBusy, unblockUi } from "./ui";

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

describe("ui libraryScanBusy", () => {
    it("starts false and toggles the title-bar scan flag", () => {
        const store = createUiStore();
        expect(store.getState().ui.libraryScanBusy).toBe(false);
        store.dispatch(setLibraryScanBusy(true));
        expect(store.getState().ui.libraryScanBusy).toBe(true);
        store.dispatch(setLibraryScanBusy(false));
        expect(store.getState().ui.libraryScanBusy).toBe(false);
    });
});
