import { app, shell } from "electron";
import { ipc } from "./utils";
import path from "path";
import fs from "fs/promises";
import { log, saveFile } from "@electron/util";
import { exec } from "child_process";
import * as crossZip from "cross-zip";
import { promisify } from "util";
import { dialogUtils } from "@utils/dialog";

export const registerFSHandlers = () => {
    ipc.handle("fs:changeTempPath", async (event, newPath) => {
        app.setPath("temp", newPath);
        const lockFile = path.join(app.getPath("userData"), "TEMP_PATH");
        // todo : test
        if (newPath === process.env.TEMP) {
            await fs.rm(lockFile, {
                // no error if file doesn't exist
                force: true,
            });
            return;
        }
        await fs.writeFile(lockFile, newPath);
    });
    // todo: check if its still needed in linux
    ipc.handle("fs:showInExplorer", async (event, filePath) => {
        try {
            if (process.platform === "linux") {
                await fs.access(filePath);
                exec(`xdg-open "${filePath}"`, (err) => {
                    if (err) throw err;
                });
            }
        } catch (err) {
            if (err instanceof Error) dialogUtils.nodeError(err);
        }
    });
    ipc.handle("fs:saveFile", async (event, { filePath, data }) => {
        try {
            saveFile(filePath, data);
        } catch (error) {
            log.error("electron:fs:saveFile:", error);
        }
    });
    ipc.handle("fs:unzip", async (event, { source, destination }) => {
        try {
            await fs.access(source);
            await fs.rm(destination, {
                recursive: true,
                force: true,
            });
            if (path.extname(source) === ".rar") {
                await fs.mkdir(destination);
                await new Promise((resolve, reject) => {
                    const unrar = exec(`unrar x "${source}" "${destination}"`);

                    unrar.on("error", (err) => {
                        if (err.message.includes("ENOENT"))
                            reject(new Error("WinRAR not found. Try adding it to system PATHS."));
                        else reject(err);
                    });

                    unrar.stderr?.on("data", (data) => {
                        reject(new Error(data));
                    });

                    unrar.on("close", (code) => {
                        if (code === 0) {
                            resolve(code);
                        } else {
                            reject(new Error("WinRAR exited with code " + code));
                        }
                    });
                });

                await fs.writeFile(path.join(destination, "SOURCE"), source);
                return { source, destination, ok: true };
            } else {
                //todo test;
                await promisify(crossZip.unzip)(source, destination);
                await fs.writeFile(path.join(destination, "SOURCE"), source);
                return { source, destination, ok: true };
            }
        } catch (error) {
            log.error("electron:fs:unzip:", error);
            return { ok: false, message: String(error) };
        }
    });
};
