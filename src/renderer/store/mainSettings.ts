import type { MainSettingsType } from "@electron/util/mainSettings";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

/**
 * @see src/electron/util/mainSettings.ts
 */
const initialState: MainSettingsType = {
    hardwareAcceleration: true,
    tempPath: window.electron.app.getPath("temp"),
    openInExistingWindow: false,
    askBeforeClosing: false,
    checkForUpdates: true,
    skipPatch: false,
    autoDownload: false,
    channel: "stable",
};

export const updateMainSettings = createAsyncThunk(
    "mainSettings/update",
    async (settings: Partial<MainSettingsType>) => {
        await window.electron.invoke("mainSettings:update", settings);
    },
);
export const getMainSettings = createAsyncThunk("mainSettings/get", async () => {
    return await window.electron.invoke("mainSettings:get");
});

/**
 * ! it is automatically synced from ipc in all windows
 */

const mainSettings = createSlice({
    name: "mainSettings",
    initialState,
    reducers: {
        setMainSettings: (state, action) => {
            return action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(getMainSettings.fulfilled, (state, action) => {
            return action.payload;
        });
    },
});

export const { setMainSettings } = mainSettings.actions;
export default mainSettings.reducer;
