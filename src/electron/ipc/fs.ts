import { exec } from "node:child_process";
import fs from "node:fs/promises";
import { mainT } from "@electron/i18n/mainI18n";
import { saveFile } from "@electron/util";
import { extractContentArchive } from "@electron/util/contentSource";
import { createMainLogger } from "@electron/util/logger";
import { WindowManager } from "@electron/util/window";
import { BrowserWindow, dialog } from "electron";
import { ipc } from "./utils";

const logger = createMainLogger("ipc/fs");

/** Registers main-process filesystem handlers used by renderer bridges. */
export const registerFSHandlers = (): void => {
    // todo: check if its still needed in linux
    ipc.handle("fs:showInExplorer", async (_event, filePath) => {
        try {
            if (process.platform === "linux") {
                await fs.access(filePath);
                exec(`xdg-open "${filePath}"`, (err) => {
                    if (err) throw err;
                });
            }
        } catch (err) {
            if (err instanceof Error) dialog.showErrorBox(mainT("titles.error", { ns: "dialogs" }), err.message);
        }
    });
    ipc.handle("fs:saveFile", async (_event, { filePath, data }) => {
        try {
            saveFile(filePath, data);
            const sourceWindowId = BrowserWindow.fromWebContents(_event.sender)?.id;
            /* skip the saving window - it already has in-memory state; notifying it caused
             * refresh <-> normalize <-> re-save loops (reader presets parse spam / open jank)
             */
            WindowManager.getAllWindows().forEach((window) => {
                if (sourceWindowId !== undefined && window.id === sourceWindowId) return;
                ipc.send(window.webContents, "fs:fileChanged", {
                    filePath,
                    sourceWindowId,
                    ts: Date.now(),
                });
            });
        } catch (error) {
            logger.error(`"fs:saveFile" failed for "${filePath}"`, error);
        }
    });
    ipc.handle("fs:unzip", async (_event, { source, destination }) => {
        try {
            await extractContentArchive(source, destination);
            return { source, destination, ok: true };
        } catch (error) {
            logger.error(`"fs:unzip" failed (source "${source}", dest "${destination}")`, error);
            return { ok: false, message: String(error) };
        }
    });
};
