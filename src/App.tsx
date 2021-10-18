import "./MainImports";
import { createContext, createRef, ReactElement, useEffect, useState } from "react";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";
const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const bookmarkDataInit: ListItem[] = [];
const historyPath = window.path.join(userDataURL, "history.json");
const historyDataInit: ListItem[] = [];

if (!window.fs.existsSync(settingsPath)) {
    const settingsData: appsettings = {
        theme: "dark",
        bookmarksPath,
        historyPath,
        baseDir: "",
        historyLimit: 60,
        locationListSortType: "normal",
        readerWidth: 60,
    };
    window.fs.writeFileSync(settingsPath, JSON.stringify(settingsData));
}
const settings: appsettings = JSON.parse(window.fs.readFileSync(settingsPath, "utf-8"));

const getBookmarkAndHistory = () => {
    if (window.fs.existsSync(bookmarksPath)) {
        const rawdata = window.fs.readFileSync(bookmarksPath, "utf8");
        if (JSON.parse(rawdata)) {
            bookmarkDataInit.push(...JSON.parse(rawdata));
        }
    } else {
        window.fs.writeFile(bookmarksPath, "[]", err => {
            if (err) console.error(err);
        });
    }
    if (window.fs.existsSync(historyPath)) {
        const rawdata = window.fs.readFileSync(historyPath, "utf8");
        if (JSON.parse(rawdata)) {
            historyDataInit.push(...JSON.parse(rawdata));
        }
    } else {
        window.fs.writeFile(historyPath, "[]", err => {
            if (err) console.error(err);
        });
    }
};
getBookmarkAndHistory();

// settings.baseDir = "";
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
    loadingScreenRef: React.RefObject<HTMLDivElement>;
    linkInReader: string;
    setLinkInReader: React.Dispatch<React.SetStateAction<string>>;
    mangaInReader: ListItem | null;
    setMangaInReader: React.Dispatch<React.SetStateAction<ListItem | null>>;
    // loadingMangaPercent: number;
    // setLoadingMangaPercent: React.Dispatch<React.SetStateAction<number>>;
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const AppContext = createContext<IAppContext>();
const App = (): ReactElement => {
    const [firstRendered, setFirstRendered] = useState(false);
    const [appSettings, setAppSettings] = useState(settings);
    const [isSettingOpen, setSettingOpen] = useState(false);
    const [isReaderOpen, setReaderOpen] = useState(false);
    const [isLoadingManga, setLoadingManga] = useState(false);
    //todo : remove loading screen
    // const [loadingMangaPercent, setLoadingMangaPercent] = useState(0);
    const [linkInReader, setLinkInReader] = useState<string>("");
    const [mangaInReader, setMangaInReader] = useState<ListItem | null>(null);
    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const loadingScreenRef: React.RefObject<HTMLDivElement> = createRef();
    const [bookmarks, setBookmarks] = useState<ListItem[]>(bookmarkDataInit);
    const [history, setHistory] = useState<ListItem[]>(historyDataInit);
    const openInReader = async (link: string) => {
        link = window.path.normalize(link);
        if (window.fs.existsSync(link) && window.fs.lstatSync(link).isDirectory) {
            setLinkInReader(link);
        }
    };
    const promptSetDefaultLocation = (): void => {
        const result = window.electron.dialog.showOpenDialogSync(
            window.electron.BrowserWindow.getFocusedWindow() || window.electron.BrowserWindow.getAllWindows()[0],
            {
                properties: ["openFile", "openDirectory"],
            }
        );
        if (!result) return;
        let path = "";
        if (result) path = window.path.normalize(result[0] + "\\");
        console.log("path", path);
        setAppSettings(init => {
            init.baseDir = path;
            return { ...init };
        });
    };
    useEffect(() => {
        setFirstRendered(true);
    }, []);
    useEffect(() => {
        if (firstRendered) {
            if (settings.baseDir === "") {
                window.electron.dialog.showMessageBoxSync(
                    window.electron.BrowserWindow.getFocusedWindow() ||
                        window.electron.BrowserWindow.getAllWindows()[0],
                    {
                        type: "error",
                        title: "Error",
                        message: "No settings found. Select manga folder",
                    }
                );
                promptSetDefaultLocation();
            }
        }
    }, [firstRendered]);
    useEffect(() => {
        // console.log(bookmarks);
        if (firstRendered) {
            console.log("fffff");
            window.fs.writeFile(bookmarksPath, JSON.stringify(bookmarks), err => {
                if (err) console.error(err);
            });
        }
    }, [bookmarks]);
    useEffect(() => {
        // console.log(history);
        if (firstRendered) {
            console.log("fffff");
            window.fs.writeFile(historyPath, JSON.stringify(history), err => {
                if (err) console.error(err);
            });
        }
    }, [history]);
    useEffect(() => {
        // console.log(appSettings);
        if (firstRendered) {
            console.log("fffff");
            window.fs.writeFile(settingsPath, JSON.stringify(appSettings), err => {
                if (err) console.error(err);
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
                loadingScreenRef,
                linkInReader,
                setLinkInReader,
                mangaInReader,
                setMangaInReader,
                // loadingMangaPercent,
                // setLoadingMangaPercent,
            }}>
            <TopBar ref={pageNumberInputRef} />
            <Main promptSetDefaultLocation={promptSetDefaultLocation} />
        </AppContext.Provider>
    );
};
export default App;
