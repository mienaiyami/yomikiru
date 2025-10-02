import checkForUpdate from "@electron/updater";
import { getWindowFromWebContents } from "@electron/util";
import { MainSettings } from "@electron/util/mainSettings";
import { WindowManager } from "../util/window";
import { ipc } from "./utils";

export const registerUpdateHandlers = (): void => {
    if (MainSettings.getSettings().checkForUpdates) {
        const mainWindow = WindowManager.getAllWindows()[0];
        if (mainWindow) {
            const check = () => {
                const settings = MainSettings.getSettings();
                checkForUpdate(mainWindow.id, settings.channel, settings.skipPatch, false, settings.autoDownload);
            };
            check();
            setInterval(check, 1000 * 60 * 60 * 1);
        }
    }

    ipc.on("update:check:manual", (e, { promptAfterCheck = true }) => {
        const windowId = getWindowFromWebContents(e.sender).id;
        checkForUpdate(windowId, MainSettings.getSettings().channel, false, promptAfterCheck, false);
    });
};
