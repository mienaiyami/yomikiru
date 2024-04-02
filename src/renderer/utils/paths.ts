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
