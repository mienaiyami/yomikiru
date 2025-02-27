type DialogUtils = {
    nodeError: (err: NodeJS.ErrnoException) => Promise<Electron.MessageBoxReturnValue>;
    customError: ({
        title,
        message,
        detail,
        log,
    }: {
        title?: string;
        message: string;
        detail?: string;
        log?: boolean;
    }) => Promise<Electron.MessageBoxReturnValue>;
    /**
     *
     * by default only show "Ok" button. `onOption=false` for buttons.
     * if `onOption=false`, default buttons "Yes","No". while default return id is 1(No)
     *
     */
    warn: ({
        title,
        message,
        detail,
        noOption,
        buttons,
        defaultId,
    }: {
        title?: string;
        message: string;
        detail?: string;
        noOption?: boolean;
        buttons?: string[];
        defaultId?: number;
    }) => Promise<Electron.MessageBoxReturnValue>;

    /**
     *
     * by default only show "Ok" button. `onOption=false` for buttons.
     * if `onOption=false`, default buttons "Yes","No". while default return id is 1(No)
     *
     */
    confirm: ({
        title,
        message,
        detail,
        noOption,
        buttons,
        defaultId,
        cancelId,
        checkboxLabel,
        noLink,
        type,
    }: {
        title?: string;
        message: string;
        detail?: string;
        noOption?: boolean;
        buttons?: string[];
        defaultId?: number;
        cancelId?: number;
        checkboxLabel?: string;
        type?: "info" | "warning" | "error" | "question";
        noLink?: boolean;
    }) => Promise<Electron.MessageBoxReturnValue>;

    showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
    showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
};

export const dialogUtils: DialogUtils = {
    nodeError: (err: NodeJS.ErrnoException) => {
        window.logger.error(err);
        return window.electron.invoke("dialog:nodeError", {
            name: err.name,
            errno: err.errno,
            message: err.message,
        });
    },
    customError: ({ title = "Error", message, detail, log = true }) => {
        if (log) window.logger.error("Error:", message, detail || "");
        return window.electron.invoke("dialog:error", {
            title,
            message,
            detail,
            log,
        });
    },
    warn: ({ title = "Warning", message, detail, noOption = true, buttons = ["Yes", "No"], defaultId = 1 }) => {
        return window.electron.invoke("dialog:warn", {
            title,
            message,
            detail,
            noOption,
            buttons,
            defaultId,
        });
    },
    confirm: ({
        title = "Confirm",
        message,
        detail,
        noOption = true,
        buttons = ["Yes", "No"],
        defaultId = 1,
        noLink,
        cancelId,
        checkboxLabel,
        type = "info",
    }) => {
        return window.electron.invoke("dialog:confirm", {
            title,
            message,
            detail,
            noOption,
            buttons,
            defaultId,
            noLink,
            cancelId,
            checkboxLabel,
            type,
        });
    },
    showOpenDialog: (options) => {
        return window.electron.invoke("dialog:showOpenDialog", options);
    },
    showSaveDialog: (options) => {
        return window.electron.invoke("dialog:showSaveDialog", options);
    },
};
