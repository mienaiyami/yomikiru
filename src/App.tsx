import "./MainImports";
import { createContext, createRef, ReactElement, useEffect, useState } from "react";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";
import useTheme from "./hooks/useTheme";
import { settingValidatorData } from "./MainImports";
import themesRaw from "./themeInit.json";

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
        readerSettings: {
            readerWidth: 60,
            variableImageSize: true,
            readerTypeSelected: 0,
            pagesPerRowSelected: 0,
            gapBetweenRows: true,
            sideListWidth: 450,
            widthClamped: true,
            gapSize: 10,
        },
    };
    if (locations) {
        const settingsDataSaved: appsettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
        locations.forEach((e) => {
            if (!(e in settingsDataSaved)) {
                console.info(e, "missing from settings,adding new...");
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                // settingsDataSaved[e]=settingsDataNew[e]
                // return
            }
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            settingsDataSaved[e] = settingsDataNew[e];
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
    console.error(err);
    makeSettingsJson();
}
//! this function have a lot of @ts-ignore
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
                    output.location.push(key);
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
                    output.location.push(key);
                    continue;
                }
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (settingValidatorData[key][key2] instanceof Array) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    if (!settingValidatorData[key][key2].includes(settings[key][key2])) {
                        output.isValid = false;
                        output.location.push(key);
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
    console.warn(`Some Settings in ${settingsPath} invalid. Re-writing some settings.`);
    console.log(isSettingsValid());
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
                console.error(err);
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
                console.error(err);
                window.fs.writeFileSync(historyPath, "[]");
            }
        }
    } else {
        window.fs.writeFileSync(historyPath, "[]");
    }

    const shortcutSchema: ShortcutSchema[] = [
        {
            command: "navToPage",
            name: "Search Page Number",
            key1: "f",
            key2: "",
        },
        {
            command: "toggleZenMode",
            name: "Toggle Zen Mode",
            key1: "`",
            key2: "",
        },
        {
            command: "readerSettings",
            name: "Open/Close Reader Settings",
            key1: "q",
            key2: "",
        },
        {
            command: "nextChapter",
            name: "Next Chapter",
            key1: "]",
            key2: "",
        },
        {
            command: "prevChapter",
            name: "Previous Chapter",
            key1: "[",
            key2: "",
        },
        {
            command: "bookmark",
            name: "Bookmark",
            key1: "b",
            key2: "",
        },
        {
            command: "sizePlus",
            name: "Increase image size",
            key1: "=",
            key2: "+",
        },
        {
            command: "sizeMinus",
            name: "Decrease image size",
            key1: "-",
            key2: "",
        },
        {
            command: "largeScroll",
            name: "Bigger Scroll (Shift+key for reverse)",
            key1: " ",
            key2: "",
        },
        {
            command: "scrollUp",
            name: "Scroll Up",
            key1: "w",
            key2: "ArrowUp",
        },
        {
            command: "scrollDown",
            name: "Scroll Down",
            key1: "s",
            key2: "ArrowDown",
        },
        {
            command: "prevPage",
            name: "Previous Page",
            key1: "a",
            key2: "ArrowLeft",
        },
        {
            command: "nextPage",
            name: "Next Page",
            key1: "d",
            key2: "ArrowRight",
        },
    ];
    if (window.fs.existsSync(shortcutsPath)) {
        const rawdata = window.fs.readFileSync(shortcutsPath, "utf8");
        if (rawdata) {
            try {
                const data = JSON.parse(rawdata);
                shortcutsInit.push(...data);
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + shortcutsPath + "\nMaking new shortcuts.json...",
                });
                console.error(err);
                window.fs.writeFileSync(shortcutsPath, JSON.stringify(shortcutSchema));
                shortcutsInit.push(...shortcutSchema);
            }
        }
    } else {
        window.fs.writeFileSync(shortcutsPath, JSON.stringify(shortcutSchema));
        shortcutsInit.push(...shortcutSchema);
    }

    // const themes = [
    //     {
    //         name: "theme1",
    //         main: "--body-bg: #262626;--icon-color: #fff8f0;--font-color: #fff8f0;--font-select-color: #fff8f0;--font-select-bg: #000;--color-primary: #262626;--color-secondary: #8f8f8f;--color-tertiary: #1f1f1f;--topBar-color: #1f1f1f;--topBar-hover-color: #5c5c5c;--input-bg: #383838;--btn-color1: #363636;--btn-color2: #6b6b6b;--listItem-bg-color: #00000000;--listItem-hover-color: #5c5c5c;--listItem-alreadyRead-color: #494c5a;--listItem-current: #30425a;--toolbar-btn-bg: #1f1f1f;--toolbar-btn-hover: #6b6b6b;--scrollbar-track-color: #00000000;--scrollbar-thumb-color: #545454;--scrollbar-thumb-color-hover: #878787;--divider-color: #6b6b6b;--context-menu-text: var(--font-color);--context-menu-bg: var(--color-tertiary);",
    //     },
    //     {
    //         name: "theme2",
    //         main: "--body-bg: #1e1e24;--icon-color: #fff8f0;--font-color: #fff8f0;--font-select-color: #fff8f0;--font-select-bg: #000;--color-primary: #111e4b;--color-secondary: #8f8f8f;--color-tertiary: #000000;--topBar-color: #17171c;--topBar-hover-color: #62636e;--input-bg: #3b3a3e;--btn-color1: #3b3a3e;--btn-color2: #62636e;--listItem-bg-color: #00000000;--listItem-hover-color: #55535b;--listItem-alreadyRead-color: #37343f;--listItem-current: #585a70;--toolbar-btn-bg: var(--topBar-color);--toolbar-btn-hover: var(--topBar-hover-color);--scrollbar-track-color: #00000000;--scrollbar-thumb-color: #545454;--scrollbar-thumb-color-hover: #878787;--divider-color: #3b3a3e;--context-menu-text: var(--font-color);--context-menu-bg: var(--color-tertiary);",
    //     },
    //     {
    //         name: "theme3",
    //         main: "--body-bg: #ffffff;--icon-color: #000c29;--font-color: #000c29;--font-select-color: #000c29;--font-select-bg: #fff8f0;--color-primary: #487fff;--color-secondary: #1f62ff;--color-tertiary: #93b4ff;--topBar-color: #e0e0e0;--topBar-hover-color: #b6ccfe;--input-bg: #b6ccfe;--btn-color1: #b6ccfe;--btn-color2: #709bff;--listItem-bg-color: #00000000;--listItem-hover-color: #b6ccfe;--listItem-alreadyRead-color: #d0dcff;--listItem-current: #709bff;--toolbar-btn-bg: var(--topBar-color);--toolbar-btn-hover: var(--topBar-hover-color);--scrollbar-track-color: #b6ccfe00;--scrollbar-thumb-color: #b6ccfe;--scrollbar-thumb-color-hover: #709bff;--divider-color: #b6ccfe;--context-menu-text: var(--font-color);--context-menu-bg: var(--color-tertiary);",
    //     },
    // ];
    if (window.fs.existsSync(themesPath)) {
        const rawdata = window.fs.readFileSync(themesPath, "utf8");
        if (rawdata) {
            try {
                const data: ThemeData[] = JSON.parse(rawdata);
                if (!data[0].main["--body-bg"]) throw "Theme variable does not exist on theme.main";
                themesMain.push(...data);
            } catch (err) {
                window.dialog.customError({
                    message: "Unable to parse " + themesPath + "\nMaking new themes.json...",
                });
                console.error(err);
                themesMain.push(...themesRaw);
                window.fs.writeFileSync(themesPath, JSON.stringify(themesRaw));
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
    currentPageNumber: number;
    setCurrentPageNumber: React.Dispatch<React.SetStateAction<number>>;
    currentImageRow: number;
    setCurrentImageRow: React.Dispatch<React.SetStateAction<number>>;
    scrollToPage: (pageNumber: number, callback?: () => void) => void;
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
    const [theme, setTheme] = useTheme(appSettings.theme || "theme2", themesMain);
    const [allThemes, setAllThemes] = useState(themesMain);
    const [isSettingOpen, setSettingOpen] = useState(false);
    const [isReaderOpen, setReaderOpen] = useState(false);
    const [isLoadingManga, setLoadingManga] = useState(false);
    const [currentPageNumber, setCurrentPageNumber] = useState(1);
    const [currentImageRow, setCurrentImageRow] = useState(1);
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
        window.fs.readdir(link, (err, files) => {
            if (err) {
                console.error(err);
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
                window.dialog.customError({
                    title: "No images found",
                    message: "Folder doesn't contain any supported image format.",
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
                callback(true, imgs.sort(window.app.betterSortOrder));
                return;
            }
            callback(true);
        });
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
        const refreshOrCloseReader = (e: KeyboardEvent) => {
            if (e.key === "h") {
                if (window.app.isReaderOpen) return closeReader();
                window.location.reload();
            }
        };
        window.addEventListener("keydown", refreshOrCloseReader);
        return () => {
            removeEventListener("keydown", refreshOrCloseReader);
        };
    }, []);
    const scrollToPage = (pageNumber: number, callback?: () => void) => {
        const reader = document.querySelector("#reader");
        if (reader) {
            if (pageNumber >= 1 && pageNumber <= (mangaInReader?.pages || 1)) {
                //! pageNumber no longer in use
                const imgElem = document.querySelector(
                    "#reader .imgCont img[data-pagenumber='" + pageNumber + "']"
                );
                if (appSettings.readerSettings.readerTypeSelected === 1) {
                    const rowNumber = parseInt(imgElem?.parentElement?.getAttribute("data-imagerow") || "1");
                    setCurrentImageRow(rowNumber);
                    if (callback) setTimeout(callback, 1500);
                } else {
                    if (imgElem) {
                        imgElem.scrollIntoView({ behavior: "smooth", block: "start" });
                        if (callback) setTimeout(callback, 1500);
                    }
                }
            }
        }
    };

    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(bookmarksPath, JSON.stringify(bookmarks), (err) => {
                if (err) {
                    console.error(err);
                    window.dialog.nodeError(err);
                }
            });
        }
    }, [bookmarks]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(historyPath, JSON.stringify(history), (err) => {
                if (err) {
                    console.error(err);
                    window.dialog.nodeError(err);
                }
            });
        }
    }, [history]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(shortcutsPath, JSON.stringify(shortcuts), (err) => {
                if (err) {
                    console.error(err);
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
    // useEffect(() => {
    //     if (firstRendered) {
    //         console.log(allThemes);
    //         window.fs.writeFile(themesPath, JSON.stringify(shortcuts), (err) => {
    //             if (err) {
    //                 console.error(err);
    //                 window.dialog.nodeError(err);
    //             }
    //         });
    //     }
    // }, [allThemes]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(settingsPath, JSON.stringify(appSettings), (err) => {
                if (err) {
                    console.error(err);
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
                currentPageNumber,
                setCurrentPageNumber,
                currentImageRow,
                setCurrentImageRow,
                scrollToPage,
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
