import {
    createContext,
    createRef,
    ReactElement,
    useEffect,
    useState,
} from "react";
import Main from "./Components/Main";
import TopBar from "./Components/TopBar";

const userDataURL = window.electron.app.getPath("userData");
const settingsPath = window.path.join(userDataURL, "settings.json");
const bookmarksPath = window.path.join(userDataURL, "bookmarks.json");
const bookmarkDataInit: string[] = [];
const historyPath = window.path.join(userDataURL, "history.json");
const historyDataInit: string[] = [];

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
const settings: appsettings = JSON.parse(
    window.fs.readFileSync(settingsPath, "utf-8")
);

const getBookmarkAndHistory = () => {
    if (window.fs.existsSync(bookmarksPath)) {
        const rawdata = window.fs.readFileSync(bookmarksPath, "utf8");
        if (JSON.parse(rawdata)) {
            bookmarkDataInit.push(...JSON.parse(rawdata));
        }
    } else {
        window.fs.writeFile(bookmarksPath, "[]", (err) => {
            if (err) console.error(err);
        });
    }
    if (window.fs.existsSync(historyPath)) {
        const rawdata = window.fs.readFileSync(historyPath, "utf8");
        if (JSON.parse(rawdata)) {
            historyDataInit.push(...JSON.parse(rawdata));
        }
    } else {
        window.fs.writeFile(historyPath, "[]", (err) => {
            if (err) console.error(err);
        });
    }
};
getBookmarkAndHistory();

// settings.baseDir = "";
interface IAppContext {
    bookmarks: string[];
    setBookmarks: React.Dispatch<React.SetStateAction<string[]>>;
    history: string[];
    setHistory: React.Dispatch<React.SetStateAction<string[]>>;
    pageNumberInputRef: React.RefObject<HTMLInputElement>;
    isSettingOpen: boolean;
    setSettingOpen: React.Dispatch<React.SetStateAction<boolean>>;
    appSettings: appsettings;
    setAppSettings: React.Dispatch<React.SetStateAction<appsettings>>;
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const AppContext = createContext<IAppContext>();
const App = (): ReactElement => {
    const [firstRendered, setFirstRendered] = useState(false);
    const [appSettings, setAppSettings] = useState(settings);
    const [isSettingOpen, setSettingOpen] = useState(false);
    const pageNumberInputRef: React.RefObject<HTMLInputElement> = createRef();
    const [bookmarks, setBookmarks] = useState<string[]>(bookmarkDataInit);
    const [history, setHistory] = useState<string[]>(historyDataInit);
    const promptSetDefaultLocation = (): void => {
        console.log(window.electron.ipcRenderer.send("currentWindow"));
        const result = window.electron.dialog.showOpenDialogSync(
            window.electron.remote.getCurrentWindow(),
            {
                properties: ["openFile", "openDirectory"],
            }
        );
        if (!result) return;
        let path = "";
        if (result) path = window.path.normalize(result[0] + "\\");
        console.log("path", path);
        setAppSettings((init) => {
            init.baseDir = path;
            return { ...init };
        });
    };
    useEffect(() => {
        setFirstRendered(true);
        window.electron.ipcRenderer.on("log", () =>
            console.log("aaaaaaaaaaaaaaaaaa")
        );
    }, []);
    useEffect(() => {
        if (firstRendered) {
            if (settings.baseDir === "") {
                promptSetDefaultLocation();
            }
        }
    }, [firstRendered]);
    useEffect(() => {
        // console.log(bookmarks);
        if (firstRendered) {
            console.log("fffff");
            window.fs.writeFile(
                bookmarksPath,
                JSON.stringify(bookmarks),
                (err) => {
                    if (err) console.error(err);
                }
            );
        }
    }, [bookmarks]);
    useEffect(() => {
        // console.log(history);
        if (firstRendered) {
            console.log("fffff");
            window.fs.writeFile(historyPath, JSON.stringify(history), (err) => {
                if (err) console.error(err);
            });
        }
    }, [history]);
    useEffect(() => {
        // console.log(appSettings);
        if (firstRendered) {
            console.log("fffff");
            window.fs.writeFile(
                settingsPath,
                JSON.stringify(appSettings),
                (err) => {
                    if (err) console.error(err);
                }
            );
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
            }}
        >
            <TopBar ref={pageNumberInputRef} />
            <Main promptSetDefaultLocation={promptSetDefaultLocation} />
        </AppContext.Provider>
    );
};
export default App;
