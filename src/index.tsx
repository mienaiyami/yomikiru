import ReactDOM from "react-dom";
import App from "./App";
import * as path from "path";
import * as fs from "fs";
import { clipboard, ipcRenderer, remote, shell } from "electron";
import { app, dialog, BrowserWindow } from "@electron/remote";
import "./styles/index.scss";
declare global {
    interface Window {
        electron: {
            app: typeof app;
            dialog: typeof dialog;
            shell: typeof shell;
            ipcRenderer: typeof ipcRenderer;
            BrowserWindow: typeof BrowserWindow;
        };
        path: typeof path;
        fs: typeof fs;
    }
    interface appsettings {
        theme: "dark" | "light";
        bookmarksPath: string;
        historyPath: string;
        baseDir: string;
        historyLimit: number;
        locationListSortType: "normal" | "inverse";
        readerWidth: number;
    }
    interface ListItem {
        mangaName: string;
        chapterName: string;
        date?: string;
        pages: number;
        link: string;
    }
}
console.log(app.getAppPath());
ReactDOM.render(<App />, document.getElementById("root"));
