export default async () => {
    const downloadLink = "https://github.com/mienaiyami/react-ts-offline-manga-reader/releases/";
    const rawdata = await fetch(
        "https://raw.githubusercontent.com/mienaiyami/react-ts-offline-manga-reader/master/package.json"
    ).then((data) => data.json());
    const latestVersion = await rawdata.version.split(".");
    console.log("checking for update.....");
    const currentAppVersion = window.electron.app.getVersion().split(".");
    console.log(latestVersion, currentAppVersion);
    if (
        latestVersion[0] > currentAppVersion[0] ||
        (latestVersion[0] === currentAppVersion[0] && latestVersion[1] > currentAppVersion[1])
    ) {
        window.electron.dialog
            .showMessageBox(window.electron.getCurrentWindow(), {
                title: "New Major Version Available",
                type: "info",
                message: "New Major Version Available.\nGo to download page?",
                buttons: ["Yes", "No"],
            })
            .then((response) => {
                if (response.response === 0) window.electron.shell.openExternal(downloadLink);
            });
        return;
    }
    if (
        latestVersion[0] === currentAppVersion[0] &&
        latestVersion[1] === currentAppVersion[1] &&
        latestVersion[2] > currentAppVersion[2]
    ) {
        window.electron.dialog
            .showMessageBox(window.electron.getCurrentWindow(), {
                title: "New Version Available",
                type: "info",
                message: "Minor Update(you can skip).\nGo to download page?",
                buttons: ["Yes", "No"],
            })
            .then((response) => {
                if (response.response === 0) window.electron.shell.openExternal(downloadLink);
            });
        return;
    }
    console.log("Running latest version.");
};
