import i18n from "@renderer/i18n";
import { createRendererLogger } from "./logger";

const dialogLog = createRendererLogger("dialogUtils");

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
        cancelId,
    }: {
        title?: string;
        message: string;
        detail?: string;
        noOption?: boolean;
        buttons?: string[];
        defaultId?: number;
        cancelId?: number;
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
        /**
         * @default true
         */
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

/**
 * Default dialog titles/buttons from the `dialogs` / `common` catalogs (exact English preserved).
 */
const dialogDefaults = {
    errorTitle: () => i18n.t("titles.error", { ns: "dialogs" }),
    warningTitle: () => i18n.t("titles.warning", { ns: "dialogs" }),
    confirmTitle: () => i18n.t("titles.confirm", { ns: "dialogs" }),
    yesNo: () => [i18n.t("buttons.yes", { ns: "dialogs" }), i18n.t("buttons.no", { ns: "dialogs" })] as string[],
};

export const dialogUtils: DialogUtils = {
    nodeError: (err: NodeJS.ErrnoException) => {
        dialogLog.error("nodeError dialog: forwarding OS error to main", err);
        return window.electron.invoke("dialog:nodeError", {
            name: err.name,
            errno: err.errno,
            message: err.message,
        });
    },
    customError: ({ title, message, detail, log = true }) => {
        if (log) dialogLog.error(`customError: ${message}`, detail || "");
        return window.electron.invoke("dialog:error", {
            title: title ?? dialogDefaults.errorTitle(),
            message,
            detail,
            log,
        });
    },
    warn: ({ title, message, detail, noOption = true, buttons, defaultId, cancelId }) => {
        if (!noOption && !buttons) {
            buttons = dialogDefaults.yesNo();
            // Esc/close must hit No; Electron only auto-maps English "No"/"Cancel" labels.
            if (typeof defaultId !== "number") defaultId = 1;
            if (typeof cancelId !== "number") cancelId = 1;
        }
        return window.electron.invoke("dialog:warn", {
            title: title ?? dialogDefaults.warningTitle(),
            message,
            detail,
            noOption,
            buttons,
            defaultId,
            cancelId,
        });
    },
    confirm: ({
        title,
        message,
        detail,
        noOption = true,
        buttons,
        defaultId,
        noLink,
        cancelId,
        checkboxLabel,
        type = "info",
    }) => {
        if (!noOption && !buttons) {
            buttons = dialogDefaults.yesNo();
            // Esc/close must hit No; Electron only auto-maps English "No"/"Cancel" labels.
            if (typeof defaultId !== "number") defaultId = 1;
            if (typeof cancelId !== "number") cancelId = 1;
        }
        return window.electron.invoke("dialog:confirm", {
            title: title ?? dialogDefaults.confirmTitle(),
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
