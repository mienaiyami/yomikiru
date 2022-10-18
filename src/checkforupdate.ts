export default async (promtAfterCheck = false) => {
    const downloadLink = "https://github.com/mienaiyami/react-ts-offline-manga-reader/releases/";
    const rawdata = await fetch(
        "https://raw.githubusercontent.com/mienaiyami/react-ts-offline-manga-reader/master/package.json"
    ).then((data) => data.json());
    const latestVersion = await rawdata.version.split(".");
    console.log("checking for update.....");
    const currentAppVersion = window.electron.app.getVersion().split(".");
    if (
        latestVersion[0] > currentAppVersion[0] ||
        (latestVersion[0] === currentAppVersion[0] && latestVersion[1] > currentAppVersion[1])
    ) {
        window.dialog
            .confirm({
                title: "New Version Available",
                message: "New Major Update Available.\nGo to download page?",
                noOption: false,
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
        window.dialog
            .confirm({
                title: "New Version Available",
                message: "Minor Update(you can skip).\nGo to download page?",
                noOption: false,
            })
            .then((response) => {
                if (response.response === 0) window.electron.shell.openExternal(downloadLink);
            });
        return;
    }
    console.log("Running latest version.");
    if (promtAfterCheck) {
        window.dialog.confirm({ message: "Running latest version" });
    }
};
