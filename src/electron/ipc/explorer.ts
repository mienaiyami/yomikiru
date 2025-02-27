import {
    addOptionToExplorerMenu,
    addOptionToExplorerMenu_epub,
    deleteOptionInExplorerMenu,
    deleteOptionInExplorerMenu_epub,
} from "@electron/util/shelloptions";
import { ipc } from "./utils";

export const registerExplorerHandlers = () => {
    if (process.platform === "win32") {
        ipc.handle("explorer:addOption", () => {
            addOptionToExplorerMenu();
        });
        ipc.handle("explorer:removeOption", () => {
            deleteOptionInExplorerMenu();
        });
        ipc.handle("explorer:addOption:epub", () => {
            addOptionToExplorerMenu_epub();
        });
        ipc.handle("explorer:removeOption:epub", () => {
            deleteOptionInExplorerMenu_epub();
        });
    }
};
