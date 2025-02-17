import { DatabaseChannels, IpcChannel } from "@common/types/ipc";

export const ipc = {
    invoke: async <T extends IpcChannel>(
        channel: T,
        ...args: DatabaseChannels[T]["request"] extends void ? [] : [DatabaseChannels[T]["request"]]
    ): Promise<DatabaseChannels[T]["response"]> => {
        return window.electron.ipcRenderer.invoke(channel, ...args);
    },
};
