// declare global {
//     interface Window {
//         electron: {
//             app: Electron.App;
//             dialog: Electron.Dialog;
//             shell: Electron.Shell;
//             ipcRenderer: Electron.IpcRenderer;
//             BrowserWindow: typeof Electron.BrowserWindow;
//         };
//         path: typeof path;
//         fs: typeof fs;
//     }
//     interface appsettings {
//         theme: "dark" | "light";
//         bookmarksPath: string;
//         historyPath: string;
//         baseDir: string;
//         historyLimit: number;
//         locationListSortType: "normal" | "inverse";
//         readerWidth: number;
//     }
//     interface ListItem {
//         mangaName: string;
//         chapterName: string;
//         date?: string;
//         pages: number;
//         link: string;
//     }
// }
// window.electron = {
//     app,
//     dialog,
//     shell,
//     ipcRenderer,
//     BrowserWindow,
// };
import ReactDOM from "react-dom";
import App from "./App";
import "./styles/index.scss";

ReactDOM.render(<App />, document.getElementById("root"));
