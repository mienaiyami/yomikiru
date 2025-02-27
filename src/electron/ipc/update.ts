import { app, dialog, shell } from "electron";
import { ipc } from "./utils";
import checkForUpdate from "@electron/updater";
import { getWindowFromWebContents } from "@electron/util";

export const registerUpdateHandlers = () => {
    const errorCheckTimeout = setTimeout(() => {
        app.isPackaged &&
            dialog
                .showMessageBox({
                    type: "info",
                    message:
                        "If you are seeing blank window then check the github page for new version or create an issue if no new version is available.",
                    buttons: ["Ok", "Home Page"],
                })
                .then((e) => {
                    if (e.response === 1) shell.openExternal("https://github.com/mienaiyami/yomikiru");
                });
    }, 1000 * 30);

    ipc.handle("update:check:response", async (event, args) => {
        if (args.enabled) {
            const windowId = getWindowFromWebContents(event.sender).id;
            checkForUpdate(windowId, args.skipMinor, false, args.autoDownload);
            setInterval(() => {
                checkForUpdate(windowId, args.skipMinor, false, args.autoDownload);
            }, 1000 * 60 * 60 * 1);
        }
        clearTimeout(errorCheckTimeout);
    });
    ipc.handle("update:check:manual", async (e, { promptAfterCheck = true }) => {
        const windowId = getWindowFromWebContents(e.sender).id;
        checkForUpdate(windowId, false, promptAfterCheck);
    });
};
