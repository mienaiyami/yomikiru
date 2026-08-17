import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { dialogUtils } from "@utils/dialog";
import { healShortcutEntries } from "@utils/keybindings";
import { saveJSONfile, shortcutsPath } from "../utils/file";
import { createRendererLogger } from "../utils/logger";
import { readJsonFileWithRetrySync } from "../utils/readJsonFileWithRetry";

const log = createRendererLogger("store/shortcuts");

import type { RootState } from ".";

const initialState: ShortcutSchema[] = [];

/** Mutable default keymap; copies keys so Redux does not share frozen map tuples. */
const defaultShortcuts: ShortcutSchema[] = healShortcutEntries([]);

//todo make function readJSONfile
if (window.fs.existsSync(shortcutsPath)) {
    try {
        let data = readJsonFileWithRetrySync<ShortcutSchema[]>(shortcutsPath, {
            maxAttempts: 10,
            onRetry: (attempt, error) => {
                log.log(`shortcuts.json read retry ${attempt}/10`, error);
            },
        });
        // check if shortcut.json is pre version 2.18.5
        if (Object.keys(data[0] ?? {}).includes("key1")) {
            throw Error("old shortcuts.json detected");
        }

        const beforeCommands = new Set(data.map((e) => e.command as string));
        data = healShortcutEntries(data);
        for (const command of beforeCommands) {
            if (!data.some((e) => e.command === command)) {
                log.log(`shortcuts.json: dropped unknown command "${command}"`);
            }
        }
        for (const e of data) {
            if (!beforeCommands.has(e.command)) {
                log.log(`shortcuts.json: added missing command "${e.command}" with defaults`);
            }
        }
        saveJSONfile(shortcutsPath, data);
        initialState.push(...data);
    } catch (err) {
        if (err instanceof Error && err.message.includes("old shortcuts")) {
            dialogUtils.warn({
                message:
                    "Shortcut system is updating to support advanced key combinations. This will replace the old shortcut system and result in the loss of your current shortcuts. Sorry for the inconvenience.",
            });
        } else
            dialogUtils.customError({
                message: `Unable to parse ${shortcutsPath}\nMaking new shortcuts.json...`,
            });
        log.error("shortcuts.json parse failed; restored default keymap", err);
        saveJSONfile(shortcutsPath, defaultShortcuts);
        initialState.push(...defaultShortcuts);
    }
} else {
    saveJSONfile(shortcutsPath, defaultShortcuts);
    initialState.push(...defaultShortcuts);
}

const shortcuts = createSlice({
    name: "shortcuts",
    initialState,
    reducers: {
        setShortcuts: (state, action: PayloadAction<{ command: ShortcutCommands; key: string }>) => {
            const { command, key } = action.payload;
            const index = state.findIndex((e) => e.command === command);
            if (index > -1) {
                if (!state[index].keys.includes(key)) state[index].keys.push(key);
                log.log(`Keybinding add: ${command} <- ${key}`);
            }
            saveJSONfile(shortcutsPath, JSON.parse(JSON.stringify(state)));
        },
        removeShortcuts: (state, action: PayloadAction<{ command: ShortcutCommands; key: string }>) => {
            const { command, key } = action.payload;
            const index = state.findIndex((e) => e.command === command);
            if (index > -1) {
                state[index].keys = state[index].keys.filter((e) => e !== key);
                log.log(`Keybinding remove: ${command} <- ${key}`);
            }
            saveJSONfile(shortcutsPath, JSON.parse(JSON.stringify(state)));
        },
        resetShortcuts: () => {
            saveJSONfile(shortcutsPath, defaultShortcuts);
            return defaultShortcuts;
        },
        refreshShortcuts: (state) => {
            try {
                const data = readJsonFileWithRetrySync<ShortcutSchema[]>(shortcutsPath, {
                    maxAttempts: 8,
                    onRetry: (attempt, error) => {
                        log.log(`shortcuts.json refresh retry ${attempt}/8`, error);
                    },
                });
                return data;
            } catch (error) {
                log.error("refreshShortcuts: could not read shortcuts.json; keeping in-memory state", error);
                return state;
            }
        },
    },
});

export const { setShortcuts, resetShortcuts, removeShortcuts, refreshShortcuts } = shortcuts.actions;

/**
 * Command -> keys map for keybinding UI. Memoized so callers do not re-render when
 * unrelated store slices change (avoids unstable `Object.fromEntries` identity).
 */
export const getShortcutsMapped = createSelector([(state: RootState) => state.shortcuts], (shortcutsList) => {
    return Object.fromEntries(shortcutsList.map((e) => [e.command, e.keys])) as Record<ShortcutCommands, string[]>;
});

export default shortcuts.reducer;
