import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { setLibraryIo, type LibraryIo } from "@common/library/io";

/**
 * `isDir` / `isFile` matching the preload bridge: lstat, then re-stat when the
 * path is a symlink so linked folders and files are scanned (D8).
 */
const followsLink = (
    filePath: string,
    acceptSymbolicLink: boolean,
    kind: "dir" | "file",
): boolean => {
    try {
        if (acceptSymbolicLink && fs.lstatSync(filePath).isSymbolicLink()) {
            const st = fs.statSync(filePath);
            return kind === "dir" ? st.isDirectory() : st.isFile();
        }
        const st = fs.lstatSync(filePath);
        return kind === "dir" ? st.isDirectory() : st.isFile();
    } catch {
        return false;
    }
};

/**
 * Preload-shaped fs/path for library classify and scan in main.
 * Do not use raw `lstat` at classify call sites — this adapter is the contract.
 */
export const createMainLibraryIo = (): LibraryIo => ({
    fs: {
        existsSync: fs.existsSync,
        isDir: (filePath, acceptSymbolicLink = true) => followsLink(filePath, acceptSymbolicLink, "dir"),
        isFile: (filePath, acceptSymbolicLink = true) => followsLink(filePath, acceptSymbolicLink, "file"),
        readdir: (filePath) => fsp.readdir(filePath),
        access: (filePath, mode) => fsp.access(filePath, mode),
        stat: async (filePath) => {
            const st = await fsp.stat(filePath);
            return { mtimeMs: st.mtimeMs };
        },
        constants: { R_OK: fs.constants.R_OK },
    },
    path,
});

/** Process-wide main adapter. Module load calls {@link setLibraryIo} so folder/format helpers work. */
export const mainLibraryIo: LibraryIo = createMainLibraryIo();
setLibraryIo(mainLibraryIo);
