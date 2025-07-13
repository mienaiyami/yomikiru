import { dialog } from "electron";
import { getWindowFromWebContents } from "@electron/util";
import { ipc } from "./utils";

export const registerDialogHandlers = () => {
    ipc.handle("dialog:nodeError", (event, args) => {
        return dialog.showMessageBox(getWindowFromWebContents(event.sender), {
            type: "error",
            title: args.name,
            message: "Error no.: " + args.errno,
            detail: args.message,
        });
    });

    ipc.handle("dialog:error", (event, args) => {
        return dialog.showMessageBox(getWindowFromWebContents(event.sender), {
            type: "error",
            title: args.title,
            message: args.message,
            detail: args.detail,
        });
    });

    ipc.handle("dialog:warn", (event, args) => {
        return dialog.showMessageBox(getWindowFromWebContents(event.sender), {
            type: "warning",
            title: args.title,
            message: args.message,
            detail: args.detail,
            buttons: args.noOption && args.buttons?.length === 0 ? [] : args.buttons,
            defaultId: args.defaultId,
        });
    });

    ipc.handle("dialog:confirm", (event, args) => {
        return dialog.showMessageBox(getWindowFromWebContents(event.sender), {
            ...args,
            buttons: args.noOption && args.buttons?.length === 0 ? [] : args.buttons,
        });
    });
    ipc.handle("dialog:showOpenDialog", (event, args) => {
        return dialog.showOpenDialog(getWindowFromWebContents(event.sender), {
            ...args,
        });
    });
    ipc.handle("dialog:showSaveDialog", (event, args) => {
        return dialog.showSaveDialog(getWindowFromWebContents(event.sender), {
            ...args,
        });
    });
};
