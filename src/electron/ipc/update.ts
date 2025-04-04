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

    ipc.on("update:check:response", (e, args) => {
        if (args.enabled) {
            const windowId = getWindowFromWebContents(e.sender).id;
            const channel = args.channel || "stable";
            checkForUpdate(windowId, args.skipMinor, false, args.autoDownload, channel);
            setInterval(
                () => {
                    checkForUpdate(windowId, args.skipMinor, false, args.autoDownload, channel);
                },
                1000 * 60 * 60 * 1,
            );
        }
        clearTimeout(errorCheckTimeout);
    });
    ipc.on("update:check:manual", (e, { promptAfterCheck = true, channel = "stable" }) => {
        const windowId = getWindowFromWebContents(e.sender).id;
        checkForUpdate(windowId, false, promptAfterCheck, false, channel);
    });
};
