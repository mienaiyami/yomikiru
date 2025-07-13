const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const historyPath = window.path.join(userDataURL, "history.json");
const themesPath = window.path.join(userDataURL, "themes.json");
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
            console.error("ERROR::saveJSONfile:renderer:", err);
        }
};

export { userDataURL, settingsPath, bookmarksPath, historyPath, themesPath, shortcutsPath, saveJSONfile };

export const formatUtils = {
    image: {
        list: [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", ".avif"],
        test: (str: string): boolean => {
            return !!str && formatUtils.image.list.includes(window.path.extname(str).toLowerCase());
        },
    },
    files: {
        list: [".zip", ".cbz", ".7z", ".cb7", ".rar", ".cbr", ".pdf", ".epub", ".xhtml", ".html", ".txt"],
        test: (str: string): boolean => {
            return !!str && formatUtils.files.list.includes(window.path.extname(str).toLowerCase());
        },
        getName: (str: string): string => {
            const ext = window.path.extname(str);
            if (!formatUtils.files.list.includes(ext)) return str;
            return window.path.basename(str, ext);
        },
        getExt: (str: string): string => {
            const ext = window.path.extname(str);
            if (!formatUtils.files.list.includes(ext)) return "";
            return ext.replace(".", "").toUpperCase();
        },
    },
    packedManga: {
        list: [".zip", ".cbz", ".7z", ".cb7", ".rar", ".cbr"],
        test: (str: string): boolean => {
            return !!str && formatUtils.packedManga.list.includes(window.path.extname(str).toLowerCase());
        },
    },
    book: {
        list: [".epub", ".xhtml", ".html", ".txt"],
        test: (str: string): boolean => {
            return !!str && formatUtils.book.list.includes(window.path.extname(str).toLowerCase());
        },
    },
};

/**
 * take string and make it safe for file system
 */
export const makeFileSafe = (string: string): string => {
    return string.replace(/(:|\\|\/|\||<|>|\*|\?)/g, "");
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
    cb && cb(path);
};

export const unzip = (source: string, destination: string) => {
    return window.electron.invoke("fs:unzip", {
        destination,
        source,
    });
};
