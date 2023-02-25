import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { defaultSettings, makeSettingsJson, isSettingsValid, settingsPath, saveJSONfile } from "../MainImports";

// const bookmarkDataInit: ChapterItem[] = [];
// const historyDataInit: HistoryItem[] = [];
// const themesMain: ThemeData[] = [];
// const shortcutsInit: ShortcutSchema[] = [];

const isValidRes = isSettingsValid();
if (!isValidRes.isValid) {
    if (isValidRes.location.length === 0) {
        window.dialog.customError({
            message: "Unable to parse settings file, making new.",
        });
        makeSettingsJson();
    } else {
        window.dialog.customError({
            message: `Some settings are invalid or new settings added. Re-writing settings.`,
        });
        window.logger.log(isSettingsValid());
        makeSettingsJson(isSettingsValid().location);
    }
}

const settings: appsettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));

export const appSettings = createSlice({
    name: "appSettings",
    initialState: settings,
    reducers: {
        setAppSettings: (state, action: PayloadAction<(state: appsettings) => appsettings>) => {
            //! remove "return from this"
            // todo: maybe dont need `state =`
            state = action.payload(state);
            saveJSONfile(settingsPath, state);
            return state;
        },
        makeNewSettings: (state) => {
            makeSettingsJson();
            state = defaultSettings;
            return state;
        },
    },
});

export const { setAppSettings, makeNewSettings } = appSettings.actions;
export default appSettings.reducer;
