import "./MainImports";
import { createContext, createRef, ReactElement, useEffect, useState } from "react";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";
import useTheme from "./hooks/useTheme";
import { settingValidatorData } from "./MainImports";
import themesRaw from "./themeInit.json";

// window.logger.log("New window opening...");

const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const bookmarkDataInit: ListItem[] = [];
const historyPath = window.path.join(userDataURL, "history.json");
const historyDataInit: ListItem[] = [];
const themesPath = window.path.join(userDataURL, "themes.json");
const themesMain: ThemeData[] = [];
const shortcutsPath = window.path.join(userDataURL, "shortcuts.json");
const shortcutsInit: ShortcutSchema[] = [];

const makeSettingsJson = (locations?: string[]) => {
    const settingsDataNew: appsettings = {
        theme: "theme2",
        bookmarksPath,
        historyPath,
        baseDir: window.electron.app.getPath("home"),
        historyLimit: 60,
        locationListSortType: "normal",
        updateCheckerEnabled: true,
        askBeforeClosing: false,
        readerSettings: {
            readerWidth: 60,
            variableImageSize: true,
            readerTypeSelected: 0,
            pagesPerRowSelected: 0,
            gapBetweenRows: true,
            sideListWidth: 450,
            widthClamped: true,
            gapSize: 10,
            showPageNumberInZenMode: true,
            scrollSpeed: 5,
            largeScrollMultiplier: 15,
            readingSide: 1,
        },
    };
    if (locations) {
        const settingsDataSaved: appsettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
        locations.forEach((e) => {
            window.logger.log(`"SETTINGS: ${e}" missing/corrupted in app settings, adding new...`);
            const l: string[] = e.split(".");
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (l.length === 1) settingsDataSaved[l[0]] = settingsDataNew[l[0]];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (l.length === 2) settingsDataSaved[l[0]][l[1]] = settingsDataNew[l[0]][l[1]];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (l.length === 3) settingsDataSaved[l[0]][l[1]][l[2]] = settingsDataNew[l[0]][l[1]][l[2]];
        });
        window.fs.writeFileSync(settingsPath, JSON.stringify(settingsDataSaved));
    } else window.fs.writeFileSync(settingsPath, JSON.stringify(settingsDataNew));
};

if (!window.fs.existsSync(settingsPath)) {
    window.dialog.warn({ message: "No settings found, Select manga folder to make default in settings" });
    makeSettingsJson();
}
try {
    JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
} catch (err) {
    window.dialog.customError({ message: "Unable to parse " + settingsPath + "\n" + "Writing new settings.json" });
    window.logger.error(err);
    makeSettingsJson();
}
//! fix : this function have a lot of @ts-ignore
function isSettingsValid(): { isValid: boolean; location: string[] } {
    const settings: appsettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
    const output: { isValid: boolean; location: string[] } = {
        isValid: true,
        location: [],
    };
    for (const key in settingValidatorData) {
        if (!Object.prototype.hasOwnProperty.call(settings, key)) {
            output.isValid = false;
            output.location.push(key);
            continue;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof settingValidatorData[key] === "string" && typeof settings[key] !== settingValidatorData[key]) {
            output.isValid = false;
            output.location.push(key);
            continue;
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (settingValidatorData[key] instanceof Array) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (!settingValidatorData[key].includes(settings[key])) {
                output.isValid = false;
                output.location.push(key);
            }
            continue;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (settingValidatorData[key] instanceof Object) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            for (const key2 in settingValidatorData[key]) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (!Object.prototype.hasOwnProperty.call(settings[key], key2)) {
                    output.isValid = false;
                    output.location.push(`${key}.${key2}`);
                    continue;
                }
                if (
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    typeof settingValidatorData[key][key2] === "string" &&
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    typeof settings[key][key2] !== settingValidatorData[key][key2]
                ) {
                    output.isValid = false;
                    output.location.push(`${key}.${key2}`);
                    continue;
                }
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (settingValidatorData[key][key2] instanceof Array) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    if (!settingValidatorData[key][key2].includes(settings[key][key2])) {
                        output.isValid = false;
                        output.location.push(`${key}.${key2}`);
                    }
                    continue;
                }
            }
        }
    }
    return output;
}
if (!isSettingsValid().isValid) {
    window.dialog.customError({ message: `Some Settings in ${settingsPath} invalid. Re-writing some settings.` });
    window.logger.warn(`Some Settings in ${settingsPath} invalid. Re-writing some settings.`);
    window.logger.log(isSettingsValid());
    makeSettingsJson(isSettingsValid().location);
}
const settings: appsettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
const getDataFiles = () => {
    if (window.fs.existsSync(bookmarksPath)) {
        const rawdata = window.fs.readFileSync(bookmarksPath, "utf8");
        if (rawdata) {
            try {
                const data = JSON.parse(rawdata);
                bookmarkDataInit.push(...data);
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + bookmarksPath + "\nMaking new bookmarks.json...",
                });
                window.logger.error(err);
                window.fs.writeFileSync(bookmarksPath, "[]");
            }
        }
    } else {
        window.fs.writeFileSync(bookmarksPath, "[]");
    }
    if (window.fs.existsSync(historyPath)) {
        const rawdata = window.fs.readFileSync(historyPath, "utf8");
        if (rawdata) {
            try {
                const data = JSON.parse(rawdata);
                if (data.length >= settings.historyLimit) data.length = settings.historyLimit;
                historyDataInit.push(...data);
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + historyPath + "\nMaking new history.json...",
                });
                window.logger.error(err);
                window.fs.writeFileSync(historyPath, "[]");
            }
        }
    } else {
        window.fs.writeFileSync(historyPath, "[]");
    }

    // shortcuts
    if (window.fs.existsSync(shortcutsPath)) {
        const rawdata = window.fs.readFileSync(shortcutsPath, "utf8");
        if (rawdata) {
            try {
                const data: ShortcutSchema[] = JSON.parse(rawdata);
                // check if shortcut key is missing in shortcuts.json, if so then add
                const shortcutKeyEntries = data.map((e) => e.command);
                const shortcutKeyOriginal = window.shortcutsFunctions.map((e) => e.command);
                let rewriteNeeded = false;
                shortcutKeyOriginal.forEach((e) => {
                    if (!shortcutKeyEntries.includes(e)) {
                        window.logger.log(`Function ${e} does not exist in shortcuts.json. Adding it.`);
                        rewriteNeeded = true;
                        data.push(window.shortcutsFunctions.find((a) => a.command === e)!);
                    }
                });
                if (rewriteNeeded) window.fs.writeFileSync(shortcutsPath, JSON.stringify(data));
                shortcutsInit.push(...data);
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + shortcutsPath + "\nMaking new shortcuts.json...",
                });
                window.logger.error(err);
                window.fs.writeFileSync(shortcutsPath, JSON.stringify(window.shortcutsFunctions));
                shortcutsInit.push(...window.shortcutsFunctions);
            }
        }
    } else {
        window.fs.writeFileSync(shortcutsPath, JSON.stringify(window.shortcutsFunctions));
        shortcutsInit.push(...window.shortcutsFunctions);
    }
    // theme
    if (window.fs.existsSync(themesPath)) {
        const rawdata = window.fs.readFileSync(themesPath, "utf8");
        if (rawdata) {
            try {
                const data: ThemeData[] = JSON.parse(rawdata);
                // validate theme data
                if (typeof data[0].main === "string" || !Array.isArray(data))
                    throw "Theme variable does not exist on theme.main";
                for (const prop in window.themeProps) {
                    let rewriteNeeded = false;
                    data.forEach((e) => {
                        if (!e.main[prop as ThemeDataMain]) {
                            window.logger.log(`${prop} does not exist on ${e.name} theme. Adding it.`);
                            rewriteNeeded = true;
                            e.main[prop as ThemeDataMain] = "#000000";
                        }
                    });
                    if (rewriteNeeded) window.fs.writeFileSync(themesPath, JSON.stringify(data));
                }
                themesMain.push(...data);
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + themesPath + "\nMaking new themes.json..." + "\n" + err,
                });
                window.logger.error(err);
                themesMain.push(...themesRaw);
                // window.fs.writeFileSync(themesPath, JSON.stringify(themesRaw));
            }
            // if (JSON.parse(rawdata).length < 3) {
            //     window.fs.writeFileSync(themesPath, JSON.stringify(themes));
            //     themesMain.push(...themes);
            // }else
        }
    } else {
        themesMain.push(...themesRaw);
        window.fs.writeFileSync(themesPath, JSON.stringify(themesRaw));
    }
};
getDataFiles();
export { themesMain };
if (!themesMain.map((e) => e.name).includes(settings.theme)) {
    window.electron.dialog
        .showMessageBox(window.electron.getCurrentWindow(), {
            type: "error",
            title: "Error",
            message: `Theme "${settings.theme}" does not exist. Try fixing or deleting theme.json and settings.json in "userdata" folder.(at "%appdata%/Manga Reader/" or in main folder on Portable version)`,
            buttons: ["Ok", "Temporary fix", "Open Location"],
        })
        .then((res) => {
            if (res.response === 1) {
                settings.theme = themesMain[0].name;
                window.fs.writeFileSync(settingsPath, JSON.stringify(settings));
                window.location.reload();
            }
            if (res.response === 2) {
                window.electron.shell.showItemInFolder(themesPath);
            }
        });
}

interface IAppContext {
    bookmarks: ListItem[];
    setBookmarks: React.Dispatch<React.SetStateAction<ListItem[]>>;
    history: ListItem[];
    setHistory: React.Dispatch<React.SetStateAction<ListItem[]>>;
    shortcuts: ShortcutSchema[];
    setShortcuts: React.Dispatch<React.SetStateAction<ShortcutSchema[]>>;
    allThemes: ThemeData[];
    setAllThemes: React.Dispatch<React.SetStateAction<ThemeData[]>>;
    pageNumberInputRef: React.RefObject<HTMLInputElement>;
    isSettingOpen: boolean;
    setSettingOpen: React.Dispatch<React.SetStateAction<boolean>>;
    appSettings: appsettings;
    setAppSettings: React.Dispatch<React.SetStateAction<appsettings>>;
    isReaderOpen: boolean;
    setReaderOpen: React.Dispatch<React.SetStateAction<boolean>>;
    openInReader: (link: string) => void;
    isLoadingManga: boolean;
    setLoadingManga: React.Dispatch<React.SetStateAction<boolean>>;
    linkInReader: string;
    setLinkInReader: React.Dispatch<React.SetStateAction<string>>;
    mangaInReader: ListItem | null;
    setMangaInReader: React.Dispatch<React.SetStateAction<ListItem | null>>;
    addNewBookmark: (newBk: ListItem) => Promise<Electron.MessageBoxReturnValue> | undefined;
    loadingMangaPercent: number;
    setLoadingMangaPercent: React.Dispatch<React.SetStateAction<number>>;
    pageNumChangeDisabled: boolean;
    setPageNumChangeDisabled: React.Dispatch<React.SetStateAction<boolean>>;
    prevNextChapter: {
        prev: string;
        next: string;
    };
    setPrevNextChapter: React.Dispatch<
        React.SetStateAction<{
            prev: string;
            next: string;
        }>
    >;
    closeReader: () => void;
    openInNewWindow: (link: string) => void;
    theme: string;
    setTheme: React.Dispatch<React.SetStateAction<string>>;
    checkValidFolder: (
        link: string,
        callback: (isValid?: boolean, imgs?: string[]) => void,
        sendImgs?: boolean
    ) => void;
    promptSetDefaultLocation: () => void;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const AppContext = createContext<IAppContext>();
const App = (): ReactElement => {
    const [firstRendered, setFirstRendered] = useState(false);
    const [appSettings, setAppSettings] = useState(settings);
    const [allThemes, setAllThemes] = useState(themesMain);
    const [theme, setTheme] = useTheme(appSettings.theme || "theme2", allThemes);
    const [isSettingOpen, setSettingOpen] = useState(false);
    const [isReaderOpen, setReaderOpen] = useState(false);
    const [isLoadingManga, setLoadingManga] = useState(false);
    const [pageNumChangeDisabled, setPageNumChangeDisabled] = useState(false);
    const [loadingMangaPercent, setLoadingMangaPercent] = useState(100);
    const [linkInReader, setLinkInReader] = useState<string>(window.loadManga || "");
    const [prevNextChapter, setPrevNextChapter] = useState({ prev: "", next: "" });
    const [mangaInReader, setMangaInReader] = useState<ListItem | null>(null);
    const [bookmarks, setBookmarks] = useState<ListItem[]>(bookmarkDataInit);
    const [history, setHistory] = useState<ListItem[]>(historyDataInit);
    const [shortcuts, setShortcuts] = useState<ShortcutSchema[]>(shortcutsInit);
    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();

    useEffect(() => {
        if (firstRendered) {
            if (settings.baseDir === "") {
                window.dialog.customError({ message: "No settings found, Select manga folder" });
                promptSetDefaultLocation();
            }
        }
    }, [firstRendered]);
    const checkValidFolder = (
        link: string,
        callback: (isValid?: boolean, imgs?: string[]) => void,
        sendImgs?: boolean
    ): void => {
        // ! changing imgs from name to link of image
        let linkMain = link;
        const linkSplitted = link.split(window.path.sep);
        if ([".zip", ".cbz"].includes(window.path.extname(link))) {
            let tempExtractPath = window.path.join(
                window.electron.app.getPath("temp"),
                `mangareader-tempImages-${linkSplitted[linkSplitted.length - 1]}-${window.app.randomString(10)}`
            );
            if (window.fs.existsSync(tempExtractPath)) {
                tempExtractPath += "-1";
            }
            // window.fs.mkdirSync(tempExtractPath);
            console.log(`Extracting "${link}" to "${tempExtractPath}"`);
            if (window.fs.existsSync(window.app.deleteDirOnClose))
                window.fs.rmSync(window.app.deleteDirOnClose, {
                    recursive: true,
                });
            window.app.deleteDirOnClose = tempExtractPath;
            window.crossZip.unzipSync(link, tempExtractPath);
            linkMain = tempExtractPath;
        }
        const tempFn = (link: string, last = false) =>
            window.fs.readdir(link, (err, files) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                    callback(false);
                    return;
                }
                if (files.length <= 0) {
                    window.dialog.customError({
                        title: "No images found",
                        message: "Folder is empty.",
                        detail: link,
                    });
                    callback(false);
                    return;
                }
                if (sendImgs) {
                    setLoadingManga(true);
                    setLoadingMangaPercent(0);
                }
                const binFiles: string[] = [];
                const imgs = files.filter((e) => {
                    if (window.path.extname(e) === ".bin") {
                        binFiles.push(e);
                        return true;
                    }
                    return window.supportedFormats.includes(window.path.extname(e));
                });
                if (imgs.length <= 0) {
                    if (
                        !last &&
                        files.length <= 1 &&
                        window.fs.lstatSync(window.path.join(linkMain, files[0])).isDirectory()
                    ) {
                        tempFn(
                            // linkSplitted[linkSplitted.length - 1].replace(/(\.zip|\.cbz)/gi, "")
                            window.path.join(linkMain, files[0]),
                            true
                        );
                        return;
                    }
                    window.dialog.customError({
                        title: "No images found",
                        message: "Folder doesn't contain any supported image format.",
                        log: false,
                    });
                    setLoadingManga(false);
                    callback(false);
                    return;
                }
                if (sendImgs) {
                    if (binFiles.length > 0) {
                        let errMsg = "";
                        binFiles.forEach((e) => {
                            errMsg += e + "\n";
                        });
                        window.dialog.warn({
                            title: "Warning",
                            message: "Unable to load following files. Possibly a download error.",
                            detail: errMsg + "from folder\n" + link,
                        });
                    }
                    callback(
                        true,
                        imgs.sort(window.app.betterSortOrder).map((e) => window.path.join(link, e))
                    );
                    return;
                }
                callback(true);
            });
        tempFn(linkMain);
    };
    const openInReader = (link: string) => {
        link = window.path.normalize(link);
        if (link === linkInReader) return;
        checkValidFolder(
            link,
            (isValid, imgs) => {
                if (isValid && imgs) {
                    window.cachedImageList = {
                        link,
                        images: imgs,
                    };
                    setLinkInReader(link);
                }
            },
            true
        );
    };

    const closeReader = () => {
        setReaderOpen(false);
        setLinkInReader("");
        setLoadingManga(false);
        setLoadingMangaPercent(0);
        setMangaInReader(null);

        document.body.classList.remove("zenMode");
        if (document.fullscreenElement) document.exitFullscreen();
    };
    useEffect(() => {
        window.app.isReaderOpen = isReaderOpen;
    }, [isReaderOpen]);
    const addNewBookmark = (newBk: ListItem) => {
        if (newBk) {
            if (bookmarks.map((e) => e.link).includes(newBk.link)) {
                return window.dialog.warn({
                    title: "Bookmark Already Exist",
                    message: "Bookmark Already Exist",
                });
            }
            setBookmarks((init) => [newBk, ...init]);
        }
    };
    const promptSetDefaultLocation = (): void => {
        const result = window.electron.dialog.showOpenDialogSync(window.electron.getCurrentWindow(), {
            properties: ["openFile", "openDirectory"],
        });
        if (!result) return;
        let path = "";
        if (result) path = window.path.normalize(result[0] + "\\");
        setAppSettings((init) => {
            init.baseDir = path;
            return { ...init };
        });
    };
    // todo : make sure it works for .zip and .cbz
    const openInNewWindow = (link: string) => {
        checkValidFolder(
            link,
            (isValid) => {
                if (isValid) window.electron.ipcRenderer.send("openLinkInNewWindow", link);
            },
            false
        );
    };
    useEffect(() => {
        setFirstRendered(true);
        window.electron.ipcRenderer.on("loadMangaFromLink", (e, data) => {
            if (data && typeof data.link === "string" && data.link !== "") openInReader(data.link);
        });
        window.electron.ipcRenderer.on("setWindowIndex", (e, data) => {
            window.electron.ipcRenderer.send(
                "askBeforeClose",
                window.electron.getCurrentWindow().id,
                appSettings.askBeforeClosing,
                data
            );
        });
        window.electron.ipcRenderer.on("canCheckForUpdate", () => {
            window.electron.ipcRenderer.send(
                "canCheckForUpdate_response",
                appSettings.updateCheckerEnabled,
                window.electron.getCurrentWindow().id
            );
        });
        window.app.titleBarHeight = parseFloat(
            window.getComputedStyle(document.body).getPropertyValue("--titleBar-height")
        );
        const eventsOnStart = (e: KeyboardEvent) => {
            if (e.key === "h") {
                if (window.app.isReaderOpen) return closeReader();
                window.location.reload();
            }
        };
        window.addEventListener("keydown", eventsOnStart);
        return () => {
            removeEventListener("keydown", eventsOnStart);
        };
    }, []);

    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(bookmarksPath, JSON.stringify(bookmarks), (err) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                }
            });
        }
    }, [bookmarks]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(historyPath, JSON.stringify(history), (err) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                }
            });
        }
    }, [history]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(shortcutsPath, JSON.stringify(shortcuts), (err) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                }
            });
        }
    }, [shortcuts]);
    useEffect(() => {
        if (firstRendered) {
            setAppSettings((init) => {
                init.theme = theme;
                return { ...init };
            });
        }
    }, [theme]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(themesPath, JSON.stringify(allThemes), (err) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                }
            });
        }
    }, [allThemes]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(settingsPath, JSON.stringify(appSettings), (err) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                }
            });
        }
    }, [appSettings]);
    return (
        <AppContext.Provider
            value={{
                bookmarks,
                setBookmarks,
                history,
                setHistory,
                shortcuts,
                setShortcuts,
                pageNumberInputRef,
                isSettingOpen,
                setSettingOpen,
                appSettings,
                setAppSettings,
                isReaderOpen,
                setReaderOpen,
                openInReader,
                isLoadingManga,
                setLoadingManga,
                linkInReader,
                setLinkInReader,
                mangaInReader,
                setMangaInReader,
                addNewBookmark,
                loadingMangaPercent,
                setLoadingMangaPercent,
                pageNumChangeDisabled,
                setPageNumChangeDisabled,
                prevNextChapter,
                setPrevNextChapter,
                closeReader,
                openInNewWindow,
                theme,
                setTheme,
                allThemes,
                setAllThemes,
                checkValidFolder,
                promptSetDefaultLocation,
            }}
        >
            <TopBar />
            <Main />
        </AppContext.Provider>
    );
};
export default App;
