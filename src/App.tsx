import "./MainImports";
import { createContext, createRef, ReactElement, useEffect, useState } from "react";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";
import useTheme from "./hooks/useTheme";
import checkforupdate from "./checkforupdate";
const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const themesPath = window.path.join(userDataURL, "themes.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const bookmarkDataInit: ListItem[] = [];
const historyPath = window.path.join(userDataURL, "history.json");
const historyDataInit: ListItem[] = [];
const themesMain: { name: string; main: string }[] = [];

if (!window.fs.existsSync(settingsPath)) {
    const settingsData: appsettings = {
        theme: "theme2",
        bookmarksPath,
        historyPath,
        baseDir: window.electron.app.getPath("home"),
        historyLimit: 60,
        locationListSortType: "normal",
        readerWidth: 60,
    };
    window.fs.writeFileSync(settingsPath, JSON.stringify(settingsData));
}
const settings: appsettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));
const getDataFiles = () => {
    if (window.fs.existsSync(bookmarksPath)) {
        const rawdata = window.fs.readFileSync(bookmarksPath, "utf8");
        if (rawdata) {
            try {
                JSON.parse(rawdata);
            } catch (err) {
                console.log("Unable to parse " + bookmarksPath);
                console.error(err);
            }
            bookmarkDataInit.push(...JSON.parse(rawdata));
        }
    } else {
        window.fs.writeFileSync(bookmarksPath, "[]");
    }
    if (window.fs.existsSync(historyPath)) {
        const rawdata = window.fs.readFileSync(historyPath, "utf8");
        if (rawdata) {
            try {
                JSON.parse(rawdata);
            } catch (err) {
                console.log("Unable to parse " + historyPath);
                console.error(err);
            }
            const data = JSON.parse(rawdata) || [];
            if (data.length >= settings.historyLimit) data.length = settings.historyLimit;
            historyDataInit.push(...data);
        }
    } else {
        window.fs.writeFileSync(historyPath, "[]");
    }
    const themes = [
        {
            name: "theme1",
            main: "--body-bg: #262626;--icon-color: #fff8f0;--font-color: #fff8f0;--font-select-color: #fff8f0;--font-select-bg: #000;--color-primary: #262626;--color-secondary: #8f8f8f;--color-tertiary: #1f1f1f;--topBar-color: #1f1f1f;--topBar-hover-color: #5c5c5c;--input-bg: #383838;--btn-color1: #363636;--btn-color2: #6b6b6b;--listItem-bg-color: #00000000;--listItem-hover-color: #5c5c5c;--listItem-alreadyRead-color: #494c5a;--listItem-current: #30425a;--toolbar-btn-bg: #1f1f1f;--toolbar-btn-hover: #6b6b6b;--scrollbar-track-color: #00000000;--scrollbar-thumb-color: #545454;--scrollbar-thumb-color-hover: #878787;--divider-color: #6b6b6b;--context-menu-text: var(--font-color);--context-menu-bg: var(--color-tertiary);",
        },
        {
            name: "theme2",
            main: "--body-bg: #1e1e24;--icon-color: #fff8f0;--font-color: #fff8f0;--font-select-color: #fff8f0;--font-select-bg: #000;--color-primary: #111e4b;--color-secondary: #8f8f8f;--color-tertiary: #000000;--topBar-color: #17171c;--topBar-hover-color: #62636e;--input-bg: #3b3a3e;--btn-color1: #3b3a3e;--btn-color2: #62636e;--listItem-bg-color: #00000000;--listItem-hover-color: #55535b;--listItem-alreadyRead-color: #37343f;--listItem-current: #585a70;--toolbar-btn-bg: var(--topBar-color);--toolbar-btn-hover: var(--topBar-hover-color);--scrollbar-track-color: #00000000;--scrollbar-thumb-color: #545454;--scrollbar-thumb-color-hover: #878787;--divider-color: #3b3a3e;--context-menu-text: var(--font-color);--context-menu-bg: var(--color-tertiary);",
        },
        {
            name: "theme3",
            main: "--body-bg: #ffffff;--icon-color: #000c29;--font-color: #000c29;--font-select-color: #000c29;--font-select-bg: #fff8f0;--color-primary: #487fff;--color-secondary: #1f62ff;--color-tertiary: #93b4ff;--topBar-color: #e0e0e0;--topBar-hover-color: #b6ccfe;--input-bg: #b6ccfe;--btn-color1: #b6ccfe;--btn-color2: #709bff;--listItem-bg-color: #00000000;--listItem-hover-color: #b6ccfe;--listItem-alreadyRead-color: #d0dcff;--listItem-current: #709bff;--toolbar-btn-bg: var(--topBar-color);--toolbar-btn-hover: var(--topBar-hover-color);--scrollbar-track-color: #b6ccfe00;--scrollbar-thumb-color: #b6ccfe;--scrollbar-thumb-color-hover: #709bff;--divider-color: #b6ccfe;--context-menu-text: var(--font-color);--context-menu-bg: var(--color-tertiary);",
        },
    ];
    if (window.fs.existsSync(themesPath)) {
        const rawdata = window.fs.readFileSync(themesPath, "utf8");
        if (rawdata) {
            try {
                JSON.parse(rawdata);
            } catch (err) {
                console.log("Unable to parse " + themesPath);
                console.error(err);
            }
            if (JSON.parse(rawdata).length < 3) {
                window.fs.writeFileSync(themesPath, JSON.stringify(themes));
                return themesMain.push(...themes);
            }
            themesMain.push(...JSON.parse(rawdata));
        }
    } else {
        themesMain.push(...themes);
        window.fs.writeFileSync(themesPath, JSON.stringify(themes));
    }
};
getDataFiles();
export { themesMain };

interface IAppContext {
    bookmarks: ListItem[];
    setBookmarks: React.Dispatch<React.SetStateAction<ListItem[]>>;
    history: ListItem[];
    setHistory: React.Dispatch<React.SetStateAction<ListItem[]>>;
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
    scrollToPage: (pageNumber: number, callback?: () => any) => void;
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
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const AppContext = createContext<IAppContext>();
const App = (): ReactElement => {
    const [firstRendered, setFirstRendered] = useState(false);
    const [appSettings, setAppSettings] = useState(settings);
    const [theme, setTheme] = useTheme(appSettings.theme || "theme2", themesMain);
    const [isSettingOpen, setSettingOpen] = useState(false);
    const [isReaderOpen, setReaderOpen] = useState(false);
    const [isLoadingManga, setLoadingManga] = useState(false);
    const [currentPageNumber, setCurrentPageNumber] = useState(1);
    const [pageNumChangeDisabled, setPageNumChangeDisabled] = useState(false);
    const [loadingMangaPercent, setLoadingMangaPercent] = useState(100);
    const [linkInReader, setLinkInReader] = useState<string>(window.loadManga || "");
    const [prevNextChapter, setPrevNextChapter] = useState({ prev: "", next: "" });
    const [mangaInReader, setMangaInReader] = useState<ListItem | null>(null);
    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const [bookmarks, setBookmarks] = useState<ListItem[]>(bookmarkDataInit);
    const [history, setHistory] = useState<ListItem[]>(historyDataInit);
    useEffect(() => {
        if (firstRendered) {
            if (settings.baseDir === "") {
                window.electron.dialog.showMessageBoxSync(window.electron.getCurrentWindow(), {
                    type: "error",
                    title: "Error",
                    message: "No settings found, Select manga folder",
                });
                promptSetDefaultLocation();
            }
        }
    }, [firstRendered]);
    const openInReader = (link: string) => {
        link = window.path.normalize(link);
        if (window.fs.existsSync(link) && window.fs.lstatSync(link).isDirectory()) {
            setLinkInReader(link);
        }
    };

    const closeReader = () => {
        setReaderOpen(false);
        setLinkInReader("");
        setLoadingManga(false);
        setLoadingMangaPercent(0);
        setMangaInReader(null);
    };
    useEffect(() => {
        window.app.isReaderOpen = isReaderOpen;
    }, [isReaderOpen]);
    const addNewBookmark = (newBk: ListItem) => {
        if (newBk) {
            if (bookmarks.map((e) => e.link).includes(newBk.link)) {
                return window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    title: "Bookmark Already Exist",
                    type: "warning",
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
        window.fs.readdir(link, (err, files) => {
            if (err) {
                console.error(err);
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    type: "error",
                    title: err.name,
                    message: "Error no.: " + err.errno,
                    detail: err.message,
                });
                return;
            }
            if (files.length <= 0) {
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    type: "error",
                    title: "No images found",
                    message: "Folder is empty.",
                    detail: link,
                });
                return;
            }
            const supportedFormat = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", "avif"];
            const imgs = files.filter((e) => supportedFormat.includes(window.path.extname(e)));
            if (imgs.length <= 0) {
                window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                    type: "error",
                    title: "No images found",
                    message: "Folder doesn't contain any supported image format.",
                });
                return;
            }
            window.electron.ipcRenderer.send("openLinkInNewWindow", link);
        });
    };
    useEffect(() => {
        setFirstRendered(true);
        window.electron.ipcRenderer.on("loadMangaFromLink", (e, data) => {
            if (data && typeof data.link === "string" && data.link !== "") openInReader(data.link);
        });
        window.electron.ipcRenderer.on("checkforupdate", () => {
            checkforupdate();
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
    const scrollToPage = (pageNumber: number, callback?: () => any) => {
        const reader = document.querySelector("#reader");
        if (reader) {
            const imgElem = document.querySelector("#reader .imgCont img[data-pagenumber='" + pageNumber + "']");
            if (imgElem) {
                imgElem.scrollIntoView({ behavior: "smooth", block: "start" });
                if (callback) setTimeout(callback, 1500);
            }
        }
    };

    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(bookmarksPath, JSON.stringify(bookmarks), (err) => {
                if (err) {
                    console.error(err);
                    window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                        type: "error",
                        title: err.name,
                        message: "Error no.: " + err.errno,
                        detail: err.message,
                    });
                }
            });
        }
    }, [bookmarks]);
    useEffect(() => {
        if (firstRendered) {
            window.fs.writeFile(historyPath, JSON.stringify(history), (err) => {
                if (err) {
                    console.error(err);
                    window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                        type: "error",
                        title: err.name,
                        message: "Error no.: " + err.errno,
                        detail: err.message,
                    });
                }
            });
        }
    }, [history]);
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
            window.fs.writeFile(settingsPath, JSON.stringify(appSettings), (err) => {
                if (err) {
                    console.error(err);
                    window.electron.dialog.showMessageBox(window.electron.getCurrentWindow(), {
                        type: "error",
                        title: err.name,
                        message: "Error no.: " + err.errno,
                        detail: err.message,
                    });
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
                scrollToPage,
                pageNumChangeDisabled,
                setPageNumChangeDisabled,
                prevNextChapter,
                setPrevNextChapter,
                closeReader,
                openInNewWindow,
                theme,
                setTheme,
            }}
        >
            <TopBar ref={pageNumberInputRef} />
            <Main promptSetDefaultLocation={promptSetDefaultLocation} />
        </AppContext.Provider>
    );
};
export default App;
