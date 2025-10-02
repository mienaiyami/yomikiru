import type { MainToRendererChannels, RendererToMainChannels } from "@common/types/ipc";
import { ipcMain } from "electron";

const registerHandler = <T extends keyof RendererToMainChannels>(
    channel: T,
    handler: (
        event: Electron.IpcMainInvokeEvent,
        request: RendererToMainChannels[T]["request"],
    ) => Promise<RendererToMainChannels[T]["response"]> | RendererToMainChannels[T]["response"],
): void => {
    ipcMain.handle(channel, async (event, request) => {
        return handler(event, request);
    });
};

const sendToRenderer = <T extends keyof MainToRendererChannels>(
    webContents: Electron.WebContents,
    channel: T,
    ...args: MainToRendererChannels[T]["request"] extends void ? [] : [MainToRendererChannels[T]["request"]]
): void => {
    webContents.send(channel, ...args);
};

const handleOn = <T extends keyof RendererToMainChannels>(
    channel: T,
    handler: (event: Electron.IpcMainEvent, request: RendererToMainChannels[T]["request"]) => void,
): void => {
    ipcMain.on(channel, (event, request) => {
        handler(event, request);
    });
};
/**
 * ! never use handle and send directly from ipcMain, always use these functions for type safety
 *
 * ! take note that ipcRenderer.send is handled by ipcMain.on only
 */
export const ipc = {
    handle: registerHandler,
    send: sendToRenderer,
    on: handleOn,
};
