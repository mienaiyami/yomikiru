import { setLibraryIo } from "@common/library/io";
import { createRendererLogger } from "./logger";

export { formatUtils, toDialogExtensions } from "@common/library/formats";

/*
 * Factory, not a snapshot: unit tests replace window.fs / window.path (stubFs, reinstall).
 * Same shape as rendererLibraryIo in mangaChapters.ts — file.ts must not import that module
 * (it pulls classify into every file.ts consumer).
 */
setLibraryIo(() => ({
    fs: window.fs,
    path: window.path,
}));

const log = createRendererLogger("utils/file");

const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const themesPath = window.path.join(userDataURL, "themes.json");
const readerPresetsPath = window.path.join(userDataURL, "reader-presets.json");
const shortcutsPath = window.path.join(userDataURL, "shortcuts.json");

const saveJSONfile = (path: string, data: any) => {
    // console.log("Saving file ", window.fileSaveTimeOut, path);
    //todo: replace with better json parser/stringifier
    const str = JSON.stringify(data, null, "  ");
    // const str = JSON.stringify(data);
    if (str)
        try {
            if (JSON.parse(str))
                window.electron.invoke("fs:saveFile", {
                    filePath: path,
                    data: str,
                });
        } catch (err) {
            log.error(`saveJSONfile: stringify/parse failed before IPC write (${path})`, err);
        }
};

export { userDataURL, settingsPath, themesPath, readerPresetsPath, shortcutsPath, saveJSONfile };

/**
 * take string and make it safe for file system
 */
export const makeFileSafe = (string: string): string => {
    return string.replace(/(:|\\|\/|\||<|>|\*|\?)/g, "");
};

/**
 * Formats a byte count for UI labels.
 * Pass translated unit strings from the caller.
 */
export const formatByteSize = (
    bytes: number,
    units: { bytes: string; kb: string; mb: string },
): string => {
    if (bytes < 1024) return `${bytes} ${units.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${units.kb}`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${units.mb}`;
};

export const promptSelectDir = async (
    cb: (path: string | string[]) => void,
    asFile = false,
    filters?: Electron.FileFilter[],
    multi = false,
): Promise<void> => {
    const result = await window.electron.invoke("dialog:showOpenDialog", {
        properties: asFile
            ? multi
                ? ["openFile", "multiSelections"]
                : ["openFile"]
            : ["openDirectory", "openFile"],
        filters,
    });

    if (result.canceled || result.filePaths.length === 0) return;
    const path = asFile
        ? multi
            ? result.filePaths[0]
            : result.filePaths[0]
        : window.path.normalize(result.filePaths[0]);
    cb?.(path);
};

export const unzip = (source: string, destination: string) => {
    return window.electron.invoke("fs:unzip", {
        destination,
        source,
    });
};

/**
 * Converts an `<img src="file://...">` value (or similar) to a local filesystem path (Windows-safe).
 */
export const fileSrcToImagePath = (src: string): string => {
    let p = src.replace(/^file:\/\//i, "");
    p = p.replaceAll("%23", "#");
    if (p.startsWith("/") && /^\/[A-Za-z]:/.test(p)) p = p.slice(1);
    return p;
};
