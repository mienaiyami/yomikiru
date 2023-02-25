import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { saveJSONfile, shortcutsPath } from "../MainImports";

const initialState: ShortcutSchema[] = [];

if (window.fs.existsSync(shortcutsPath)) {
    const raw = window.fs.readFileSync(shortcutsPath, "utf8");
    if (raw) {
        try {
            let data: ShortcutSchema[] = JSON.parse(raw);
            // check if shortcut key is missing in shortcuts.json, if so then add
            const shortcutKeyEntries = data.map((e) => e.command);
            const shortcutKeyOriginal = window.shortcutsFunctions.map((e) => e.command);
            data = data.filter((e) => shortcutKeyOriginal.includes(e.command));
            window.shortcutsFunctions.forEach((e) => {
                if (!shortcutKeyEntries.includes(e.command)) {
                    window.logger.log(`Function ${e} does not exist in shortcuts.json. Adding it.`);
                    data.push(e);
                }
            });
            data.forEach((e) => {
                e.name = window.shortcutsFunctions.find((a) => a.command === e.command)?.name as string;
            });
            window.fs.writeFileSync(shortcutsPath, JSON.stringify(data, null, "\t"));
            initialState.push(...data);
        } catch (err) {
            window.dialog.customError({
                message: "Unable to parse " + shortcutsPath + "\nMaking new shortcuts.json...",
            });
            window.logger.error(err);
            window.fs.writeFileSync(shortcutsPath, JSON.stringify(window.shortcutsFunctions, null, "\t"));
            initialState.push(...window.shortcutsFunctions);
        }
    }
} else {
    window.fs.writeFileSync(shortcutsPath, JSON.stringify(window.shortcutsFunctions, null, "\t"));
    initialState.push(...window.shortcutsFunctions);
}

const shortcuts = createSlice({
    name: "shortcuts",
    initialState,
    reducers: {
        setShortcuts: (
            state,
            action: PayloadAction<((state: ShortcutSchema[]) => ShortcutSchema[]) | ShortcutSchema[]>
        ) => {
            if (action.payload instanceof Array) state = action.payload;
            else state = action.payload(state);
            saveJSONfile(shortcutsPath, state);
            return state;
        },
    },
});

export const { setShortcuts } = shortcuts.actions;

export default shortcuts.reducer;
