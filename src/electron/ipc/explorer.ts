import {
    addOptionToExplorerMenu,
    addOptionToExplorerMenu_epub,
    deleteOptionInExplorerMenu,
    deleteOptionInExplorerMenu_epub,
} from "@electron/util/shelloptions";
import { ipc } from "./utils";

export const registerExplorerHandlers = () => {
    if (process.platform === "win32") {
        ipc.handle("explorer:addOption", async () => {
            return await addOptionToExplorerMenu();
        });
        ipc.handle("explorer:removeOption", async () => {
            return await deleteOptionInExplorerMenu();
        });
        ipc.handle("explorer:addOption:epub", async () => {
            return await addOptionToExplorerMenu_epub();
        });
        ipc.handle("explorer:removeOption:epub", async () => {
            return await deleteOptionInExplorerMenu_epub();
        });
    }
};
