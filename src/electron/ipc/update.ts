import { ipc } from "./utils";
import checkForUpdate from "@electron/updater";
import { getWindowFromWebContents } from "@electron/util";
import { MainSettings } from "@electron/util/mainSettings";
import { WindowManager } from "../util/window";

export const registerUpdateHandlers = (): void => {
    if (MainSettings.getSettings().checkForUpdates) {
        const mainWindow = WindowManager.getAllWindows()[0];
        if (mainWindow) {
            const check = () => {
                const settings = MainSettings.getSettings();
                checkForUpdate(mainWindow.id, settings.skipMinor, false, settings.autoDownload, settings.channel);
            };
            check();
            setInterval(check, 1000 * 60 * 60 * 1);
        }
    }

    ipc.on("update:check:manual", (e, { promptAfterCheck = true }) => {
        const windowId = getWindowFromWebContents(e.sender).id;
        checkForUpdate(windowId, false, promptAfterCheck, false, MainSettings.getSettings().channel);
    });
};
