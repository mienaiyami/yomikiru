import path from "path";

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
            // window.logger.log("Sent file to save:", path);
            if (JSON.parse(str)) window.electron.ipcRenderer.send("saveFile", path, str);
        } catch (err) {
            console.error("ERROR::saveJSONfile:renderer:", err);
        }
};

export { userDataURL, settingsPath, bookmarksPath, historyPath, themesPath, shortcutsPath, saveJSONfile };

export const formatUtils = {
    image: {
        list: [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", ".avif"],
        test: (str: string) => {
            return !!str && formatUtils.image.list.includes(path.extname(str).toLowerCase());
        },
    },
    files: {
        list: [".zip", ".cbz", ".7z", ".cb7", ".rar", ".cbr", ".pdf", ".epub", ".xhtml", ".html", ".txt"],
        test: (str: string) => {
            return !!str && formatUtils.files.list.includes(path.extname(str).toLowerCase());
        },
        getName: (str: string) => {
            const ext = path.extname(str);
            if (!formatUtils.files.list.includes(ext)) return str;
            return path.basename(str, ext);
        },
        getExt: (str: string) => {
            const ext = path.extname(str);
            if (!formatUtils.files.list.includes(ext)) return "";
            return ext.replace(".", "").toUpperCase();
        },
    },
    packedManga: {
        list: [".zip", ".cbz", ".7z", ".cb7", ".rar", ".cbr"],
        test: (str: string) => {
            return str && formatUtils.packedManga.list.includes(path.extname(str).toLowerCase());
        },
    },
    book: {
        list: [".epub", ".xhtml", ".html", ".txt"],
        test: (str: string) => {
            return str && formatUtils.book.list.includes(path.extname(str).toLowerCase());
        },
    },
};

export const makeFileSafe = (string: string): string => {
    return string.replace(/(:|\\|\/|\||<|>|\*|\?)/g, "");
};

export const promptSelectDir = (
    cb: (path: string | string[]) => void,
    asFile = false,
    filters?: Electron.FileFilter[],
    multi = false
): void => {
    const result = window.electron.dialog.showOpenDialogSync(window.electron.getCurrentWindow(), {
        properties: asFile
            ? multi
                ? ["openFile", "multiSelections"]
                : ["openFile"]
            : ["openDirectory", "openFile"],
        filters,
    });

    if (!result) return;
    const path = asFile ? (multi ? result : result[0]) : window.path.normalize(result[0]);
    cb && cb(path);
};

export const unzip = (link: string, extractPath: string) => {
    return window.electron.ipcRenderer.invoke("unzip", link, extractPath);
};
