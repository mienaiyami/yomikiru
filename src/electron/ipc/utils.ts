import { MainToRendererChannels, RendererToMainChannels } from "@common/types/ipc";
import { ipcMain } from "electron";

const registerHandler = <T extends keyof RendererToMainChannels>(
    channel: T,
    handler: (
        event: Electron.IpcMainInvokeEvent,
        request: RendererToMainChannels[T]["request"]
    ) => Promise<RendererToMainChannels[T]["response"]> | RendererToMainChannels[T]["response"]
) => {
    ipcMain.handle(channel, async (event, request) => {
        return handler(event, request);
    });
};

const sendToRenderer = <T extends keyof MainToRendererChannels>(
    webContents: Electron.WebContents,
    channel: T,
    ...args: MainToRendererChannels[T]["request"] extends void ? [] : [MainToRendererChannels[T]["request"]]
) => {
    webContents.send(channel, ...args);
};

/**
 * ! never use handle and send directly from ipcMain, always use these functions for type safety
 */
export const ipc = {
    handle: registerHandler,
    send: sendToRenderer,
};
