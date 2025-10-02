import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { log, saveFile } from "@electron/util";
import * as crossZip from "cross-zip";
import { dialog } from "electron";
import { ipc } from "./utils";

// manual merge from https://github.com/mienaiyami/yomikiru/commit/b1b6acbf18ff4eac5d352d91fafd511223cc8ad0
const flattenDirectories = async (root: string, relativePath = "."): Promise<void> => {
    const absolutePath = path.resolve(root, relativePath);
    if ((await fs.stat(absolutePath)).isDirectory()) {
        (await fs.readdir(absolutePath)).forEach((entry) => {
            flattenDirectories(root, path.join(relativePath, entry));
        });
    }
    await fs.rename(absolutePath, path.resolve(root, relativePath.replace(path.sep, "_")));
};

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
            if (err instanceof Error) dialog.showErrorBox("Error", err.message);
        }
    });
    ipc.handle("fs:saveFile", async (_event, { filePath, data }) => {
        try {
            saveFile(filePath, data);
        } catch (error) {
            log.error("electron:fs:saveFile:", error);
        }
    });
    ipc.handle("fs:unzip", async (_event, { source, destination }) => {
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
                            reject(new Error(`WinRAR exited with code ${code}`));
                        }
                    });
                });
                try {
                    await flattenDirectories(destination);
                } catch (e) {
                    log.error("electron:fs:unzip:", e);
                }
                await fs.writeFile(path.join(destination, "SOURCE"), source);
                return { source, destination, ok: true };
            } else {
                await promisify(crossZip.unzip)(source, destination);
                try {
                    if (path.extname(source).toLowerCase() !== ".epub") await flattenDirectories(destination);
                } catch (e) {
                    log.error("electron:fs:unzip:", e);
                }
                await fs.writeFile(path.join(destination, "SOURCE"), source);
                return { source, destination, ok: true };
            }
        } catch (error) {
            log.error("electron:fs:unzip:", error);
            return { ok: false, message: String(error) };
        }
    });
};
