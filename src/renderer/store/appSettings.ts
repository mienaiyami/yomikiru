import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { settingSchema, makeSettingsJson, settingsPath, saveJSONfile, parseAppSettings } from "../MainImports";

const settings = parseAppSettings();

type AppSettingsOptional = {
    [K in keyof AppSettings]?: AppSettings[K];
};
type ReaderSettingsOptional = {
    [K in keyof AppSettings["readerSettings"]]?: AppSettings["readerSettings"][K];
};
type EPUBReaderSettingsOptional = {
    [K in keyof AppSettings["epubReaderSettings"]]?: AppSettings["epubReaderSettings"][K];
};

const appSettings = createSlice({
    name: "appSettings",
    initialState: settings,
    reducers: {
        setAppSettings: (state, action: PayloadAction<AppSettingsOptional>) => {
            const newSettings: AppSettings = { ...state, ...action.payload };
            saveJSONfile(settingsPath, JSON.parse(JSON.stringify(newSettings)));
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
            saveJSONfile(settingsPath, JSON.parse(JSON.stringify(newSettings)));
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
            saveJSONfile(settingsPath, JSON.parse(JSON.stringify(newSettings)));
            return newSettings;
        },
        refreshAppSettings: () => {
            return parseAppSettings();
        },
        makeNewSettings: () => {
            makeSettingsJson();
            //todo check if it reloads automatically
            // return settingSchema.parse(undefined);
        },
    },
});

export const { setAppSettings, makeNewSettings, setReaderSettings, setEpubReaderSettings, refreshAppSettings } =
    appSettings.actions;
export default appSettings.reducer;
