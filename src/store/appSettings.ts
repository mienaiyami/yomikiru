import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UnionToIntersection } from "@reduxjs/toolkit/dist/tsHelpers";
import {
    defaultSettings,
    makeSettingsJson,
    isSettingsValid,
    settingsPath,
    saveJSONfile,
    settingValidatorData,
} from "../MainImports";

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

const settings: AppSettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));

type AppSettingsOptional = {
    [K in keyof AppSettings]?: AppSettings[K];
};
type ReaderSettingsOptional = {
    [K in keyof AppSettings["readerSettings"]]?: AppSettings["readerSettings"][K];
};
type EPUBReaderSettingsOptional = {
    [K in keyof AppSettings["epubReaderSettings"]]?: AppSettings["epubReaderSettings"][K];
};

// type AppSettingsToggleable = {
//     [K in keyof AppSettings as AppSettings[K] extends boolean | IsUnion<AppSettings[K]> ? K : never]?: boolean;
// };
// type AppSettingsToggleableKeys = keyof AppSettingsToggleable;
// type ReaderSettingsToggleable = {
//     [K in keyof AppSettings["readerSettings"] as AppSettings["readerSettings"][K] extends (boolean |string[] |number[])
//         ? K
//         : never]: boolean;
// };
// type ReaderSettingsToggleableKeys = keyof ReaderSettingsToggleable;

export const appSettings = createSlice({
    name: "appSettings",
    initialState: settings,
    reducers: {
        setAppSettings: (state, action: PayloadAction<AppSettingsOptional>) => {
            const newSettings: AppSettings = { ...state, ...action.payload };
            saveJSONfile(settingsPath, newSettings);
            return newSettings;
        },
        setReaderSettings: (state, action: PayloadAction<ReaderSettingsOptional>) => {
            const newSettings: AppSettings = {
                ...state,
                readerSettings: {
                    ...state.readerSettings,
                    ...action.payload,
                },
            };
            saveJSONfile(settingsPath, newSettings);
            return newSettings;
        },
        setEpubReaderSettings: (state, action: PayloadAction<EPUBReaderSettingsOptional>) => {
            const newSettings: AppSettings = {
                ...state,
                epubReaderSettings: {
                    ...state.epubReaderSettings,
                    ...action.payload,
                },
            };
            saveJSONfile(settingsPath, newSettings);
            return newSettings;
        },

        // toggleInMain: (state, action: PayloadAction<AppSettingsToggleableKeys[]>) => {
        //     const newSetting = { ...state };
        //     action.payload.forEach((e) => {
        //         if(typeof newSetting[e]==="boolean")
        //         newSetting[e] = !newSetting[e];
        //         else {
        //             const index = settingValidatorData[e]// as string[]|number[]).findIndex(newSetting[e]!);

        //         }
        //     });
        //     return newSetting;
        // },
        makeNewSettings: (state) => {
            makeSettingsJson();
            state = defaultSettings;
            return state;
        },
    },
});

export const { setAppSettings, makeNewSettings, setReaderSettings, setEpubReaderSettings } = appSettings.actions;
export default appSettings.reducer;
