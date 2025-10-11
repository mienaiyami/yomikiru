import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { log, saveFile } from "@electron/util";
import * as crossZip from "cross-zip";
import { dialog } from "electron";
import { ipc } from "./utils";

// manual merge from https://github.com/mienaiyami/yomikiru/commit/b1b6acbf18ff4eac5d352d91fafd511223cc8ad0
/**
 * Flatten directories. Recursively flattens directory structure by renaming directories and files
 * to use underscores instead of path separators.
 *
 * Before and after example:
 * ```
 * before:
 * - folder1
 *   - file1.txt
 *   - file2.txt
 *   - folder2
 *     - file3.txt
 * after:
 * - folder1_file1.txt
 * - folder1_file2.txt
 * - folder1_folder2_file3.txt
 * ```
 */
const flattenDirectories = async (root: string, relativePath = "."): Promise<void> => {
    const absolutePath = path.resolve(root, relativePath);
    if ((await fs.stat(absolutePath)).isDirectory()) {
        const entries = await fs.readdir(absolutePath);
        for (const entry of entries) {
            await flattenDirectories(root, path.join(relativePath, entry));
        }
    }
    // skip root directory
    if (relativePath !== ".") {
        const flattenedName = relativePath.split(path.sep).join("_");
        await fs.rename(absolutePath, path.resolve(root, flattenedName));
    }
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
            if ([".rar", ".cbr"].includes(path.extname(source).toLowerCase())) {
                await fs.mkdir(destination);
                await new Promise((resolve, reject) => {
                    const unrar = exec(`unrar x "${source}" "${destination}"`);
                    const onError = (err: Error) => {
                        if (["ENOENT", "not recognized"].some((message) => err.message.includes(message)))
                            reject(
                                new Error(
                                    "WinRAR not found. Try adding it to system PATHS. Make sure 'unrar' is in the path.",
                                ),
                            );
                        else reject(err);
                    };
                    unrar.on("error", onError);

                    unrar.stderr?.on("data", (data) => {
                        onError(new Error(data));
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
