import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { saveJSONfile, shortcutsPath } from "../utils/paths";

const initialState: ShortcutSchema[] = [];

const defaultShortcuts: ShortcutSchema[] = window.SHORTCUT_COMMANDS.map((e) => ({
    command: e.command,
    keys: e.defaultKeys,
}));

//todo make function readJSONfile
if (window.fs.existsSync(shortcutsPath)) {
    const raw = window.fs.readFileSync(shortcutsPath, "utf8");
    if (raw) {
        try {
            let data: ShortcutSchema[] = JSON.parse(raw);

            // check if shortcut.json is pre version 2.18.5
            if (Object.keys(data[0]).includes("key1")) {
                throw Error("old shortcuts.json detected");
            }

            // check if shortcut key is missing in shortcuts.json, if so then add
            const shortcutKeyEntries = data.map((e) => e.command);
            const shortcutKeyOriginal = window.SHORTCUT_COMMANDS.map((e) => e.command);
            data = data.filter((e) => shortcutKeyOriginal.includes(e.command));
            window.SHORTCUT_COMMANDS.forEach((e) => {
                if (!shortcutKeyEntries.includes(e.command)) {
                    window.logger.log(`Function ${e} does not exist in shortcuts.json. Adding it.`);
                    data.push({
                        command: e.command,
                        keys: e.defaultKeys,
                    });
                }
            });
            // ! take name from window.shortcutsFunctions instead
            // data.forEach((e) => {
            //     e.name = window.shortcutsFunctions.find((a) => a.command === e.command)?.name as string;
            // });
            window.fs.writeFileSync(shortcutsPath, JSON.stringify(data, null, "\t"));
            initialState.push(...data);
        } catch (err) {
            if (err instanceof Error && err.message.includes("old shortcuts")) {
                window.dialog.warn({
                    message:
                        "Shortcut system is updating to support advanced key combinations. This will replace the old shortcut system and result in the loss of your current shortcuts. Sorry for the inconvenience.",
                });
            } else
                window.dialog.customError({
                    message: "Unable to parse " + shortcutsPath + "\nMaking new shortcuts.json...",
                });
            window.logger.error(err);
            window.fs.writeFileSync(shortcutsPath, JSON.stringify(defaultShortcuts, null, "\t"));
            initialState.push(...defaultShortcuts);
        }
    }
} else {
    window.fs.writeFileSync(shortcutsPath, JSON.stringify(defaultShortcuts, null, "\t"));
    initialState.push(...defaultShortcuts);
}

const shortcuts = createSlice({
    name: "shortcuts",
    initialState,
    reducers: {
        setShortcuts: (state, action: PayloadAction<{ command: ShortcutCommands; key: string }>) => {
            // todo: why did i do this?
            // if (action.payload instanceof Array) state = action.payload;
            const { command, key } = action.payload;
            const index = state.findIndex((e) => e.command === command);
            if (index > -1) {
                if (!state[index].keys.includes(key)) state[index].keys.push(key);
                window.logger.log(`Adding keybinding: "${command}" <== "${key}"`);
            }
            saveJSONfile(shortcutsPath, JSON.parse(JSON.stringify(state)));
        },
        removeShortcuts: (state, action: PayloadAction<{ command: ShortcutCommands; key: string }>) => {
            const { command, key } = action.payload;
            const index = state.findIndex((e) => e.command === command);
            if (index > -1) {
                state[index].keys = state[index].keys.filter((e) => e !== key);
                window.logger.log(`Removing keybinding: "${command}" <== "${key}"`);
            }
            saveJSONfile(shortcutsPath, JSON.parse(JSON.stringify(state)));
        },
        resetShortcuts: () => {
            saveJSONfile(shortcutsPath, defaultShortcuts);
            return defaultShortcuts;
        },
    },
});

export const { setShortcuts, resetShortcuts, removeShortcuts } = shortcuts.actions;

export default shortcuts.reducer;
