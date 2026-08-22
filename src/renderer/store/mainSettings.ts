import { defaultMainSettings, type MainSettingsType } from "@common/mainSettings";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState: MainSettingsType = defaultMainSettings(window.electron.app.getPath("temp"));

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
        setMainSettings: (_state, action) => {
            return action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(getMainSettings.fulfilled, (_state, action) => {
            return action.payload;
        });
    },
});

export const { setMainSettings } = mainSettings.actions;
export default mainSettings.reducer;
