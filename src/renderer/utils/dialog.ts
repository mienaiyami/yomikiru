import { dialog, getCurrentWindow } from "@electron/remote";

export const dialogUtils: typeof window.dialog = {
    nodeError: (err: NodeJS.ErrnoException) => {
        window.logger.error(err);
        return dialog.showMessageBox(getCurrentWindow(), {
            type: "error",
            title: err.name,
            message: "Error no.: " + err.errno,
            detail: err.message,
        });
    },
    customError: ({ title = "Error", message, detail, log = true }) => {
        if (log) window.logger.error("Error:", message, detail || "");
        return dialog.showMessageBox(getCurrentWindow(), {
            type: "error",
            title: title,
            message: message,
            detail: detail,
        });
    },
    warn: ({ title = "Warning", message, detail, noOption = true, buttons = ["Yes", "No"], defaultId = 1 }) => {
        // window.logger.warn(message, detail || "");
        return dialog.showMessageBox(getCurrentWindow(), {
            type: "warning",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : buttons,

            defaultId,
        });
    },
    confirm: (
        { title = "Confirm", message, detail, noOption = true, buttons = ["Yes", "No"], noLink },
        defaultId = 1
    ) =>
        dialog.showMessageBox(getCurrentWindow(), {
            type: "info",
            title: title,
            message: message,
            detail: detail,
            buttons: noOption ? [] : buttons,
            defaultId,
            noLink,
        }),
};
