// import { app, dialog, BrowserWindow, clipboard, nativeImage } from "@electron/remote";
// import { ipcRenderer, shell } from "electron";
// import path from "path";
// import fs from "fs";
// declare global {
//     interface Window {
//         electron: {
//             app: Electron.App;
//             dialog: Electron.Dialog;
//             shell: Electron.Shell;
//             ipcRenderer: Electron.IpcRenderer;
//             BrowserWindow: typeof Electron.BrowserWindow;
//             clipboard: Electron.Clipboard;
//             nativeImage: Electron.NativeImage;
//         };
//         path: typeof path;
//         fs: typeof fs;
//         app: {
//             betterSortOrder: (x: string, y: string) => number;
//             titleBarHeight: number;
//             isReaderOpen: boolean;
//             clickDelay: number;
//             lastClick: number;
//         };
//         loadManga: string;
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
//         link: string;
//         pages: number;
//     }
//     interface ListItemE extends ListItem {
//         index: number;
//         isBookmark: boolean;
//         isHistory: boolean;
//     }
//     interface IContextMenuData {
//         isBookmark?: boolean;
//         isHistory?: boolean;
//         isFile?: boolean;
//         isImg?: boolean;
//         link: string;
//         e: MouseEvent;
//         item?: ListItemE;
//     }
// }
