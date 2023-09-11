import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { defaultSettings, makeSettingsJson, isSettingsValid, settingsPath, saveJSONfile } from "../MainImports";

//todo try using zod or something else
const validate = () => {
    const isValidRes = isSettingsValid();
    if (!isValidRes.isValid) {
        if (isValidRes.location.length === 0) {
            window.dialog.customError({
                message: "Unable to parse settings file, making new.",
            });
            makeSettingsJson();
        } else {
            window.dialog.warn({
                message: `Some settings are invalid or new settings added. Re-writing settings.`,
            });
            window.logger.log(isSettingsValid());
            makeSettingsJson(isSettingsValid().location);
        }
    }
};

validate();

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
            validate();
            return JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
        },
        makeNewSettings: (state) => {
            makeSettingsJson();
            state = defaultSettings;
            return state;
        },
    },
});

export const { setAppSettings, makeNewSettings, setReaderSettings, setEpubReaderSettings, refreshAppSettings } =
    appSettings.actions;
export default appSettings.reducer;
