import fs from "node:fs/promises";
import path from "node:path";
import * as sudo from "@vscode/sudo-prompt";
import { app } from "electron";
import { IS_PORTABLE, log } from ".";

const op = {
    name: "Yomikiru",
    icns: app.getPath("exe"),
};

// registry, add option "open in reader" in  explorer context menu
export const addOptionToExplorerMenu = async (): Promise<boolean> => {
    try {
        const appPath = IS_PORTABLE
            ? app.getPath("exe").replace(/\\/g, "\\\\")
            : path.join(app.getPath("exe"), `../../${app.name}.exe`).replace(/\\/g, "\\\\");
        const regInit = `Windows Registry Editor Version 5.00
        
        ; setup context menu item for click on folders tree item
        [HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\Yomikiru\\command]
        @="\\"${appPath}\\" \\"%V\\""
        
        ; specify an icon for the item
        [HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\Yomikiru]
        @="Open in Yomikiru "
        "icon"="${appPath}"

        
        [HKEY_CLASSES_ROOT\\.cbz\\shell\\Yomikiru]
        @="Open in Yomikiru"
        "Icon"="${appPath}"

        [HKEY_CLASSES_ROOT\\.cbz\\shell\\Yomikiru\\command]
        @="\\"${appPath}\\" \\"%V\\""


        [HKEY_CLASSES_ROOT\\Yomikiru]
        @="Yomikiru"

        [HKEY_CLASSES_ROOT\\Yomikiru\\DefaultIcon]
        @="${appPath}"

        [HKEY_CLASSES_ROOT\\Yomikiru\\shell\\open]
        "Icon"="${appPath}"

        [HKEY_CLASSES_ROOT\\Yomikiru\\shell\\open\\command]
        @="\\"${appPath}\\" \\"%V\\""

        [HKEY_CLASSES_ROOT\\.zip\\OpenWithProgids]
        "Yomikiru"=""
        [HKEY_CLASSES_ROOT\\.cbz\\OpenWithProgids]
        "Yomikiru"=""
        [HKEY_CLASSES_ROOT\\.cbr\\OpenWithProgids]
        "Yomikiru"=""
        [HKEY_CLASSES_ROOT\\.cb7\\OpenWithProgids]
        "Yomikiru"=""

        [HKEY_CLASSES_ROOT\\.rar\\OpenWithProgids]
        "Yomikiru"=""

        [HKEY_CLASSES_ROOT\\.pdf\\OpenWithProgids]
        "Yomikiru"=""

        [HKEY_CLASSES_ROOT\\.7z\\OpenWithProgids]
        "Yomikiru"=""
        `;

        const tempPath = app.getPath("temp");
        const regFilePath = path.join(tempPath, "createOpenWithYomikiru.reg");

        await fs.writeFile(regFilePath, regInit);

        return await new Promise<boolean>((resolve, reject) => {
            sudo.exec(`regedit.exe /S ${regFilePath}`, op, (error) => {
                if (error) {
                    log.error("Failed to add explorer menu option:", error);
                    reject(new Error(`Failed to add explorer menu option: ${error.message}`));
                    return;
                }
                resolve(true);
            });
        });
    } catch (error) {
        log.error("Error in addOptionToExplorerMenu:", error);
        throw error;
    }
};

export const addOptionToExplorerMenu_epub = async (): Promise<boolean> => {
    try {
        const appPath = IS_PORTABLE
            ? app.getPath("exe").replace(/\\/g, "\\\\")
            : path.join(app.getPath("exe"), `../../${app.name}.exe`).replace(/\\/g, "\\\\");
        const regInit = `Windows Registry Editor Version 5.00
        
        [HKEY_CLASSES_ROOT\\.epub\\shell\\Yomikiru]
        @="Open in Yomikiru"
        "Icon"="${appPath}"

        [HKEY_CLASSES_ROOT\\.epub\\shell\\Yomikiru\\command]
        @="\\"${appPath}\\" \\"%V\\""

        [HKEY_CLASSES_ROOT\\.epub\\OpenWithProgids]
        "Yomikiru"=""
        
        [HKEY_CLASSES_ROOT\\.txt\\OpenWithProgids]
        "Yomikiru"=""
        
        [HKEY_CLASSES_ROOT\\.xhtml\\OpenWithProgids]
        "Yomikiru"=""
        
        [HKEY_CLASSES_ROOT\\.html\\OpenWithProgids]
        "Yomikiru"=""
        `;

        const tempPath = app.getPath("temp");
        const regFilePath = path.join(tempPath, "createOpenWithYomikiru-epub.reg");

        await fs.writeFile(regFilePath, regInit);

        return await new Promise<boolean>((resolve, reject) => {
            sudo.exec(`regedit.exe /S ${regFilePath}`, op, (error) => {
                if (error) {
                    log.error("Failed to add epub explorer menu option:", error);
                    reject(new Error(`Failed to add epub explorer menu option: ${error.message}`));
                    return;
                }
                resolve(true);
            });
        });
    } catch (error) {
        log.error("Error in addOptionToExplorerMenu_epub:", error);
        throw error;
    }
};

export const deleteOptionInExplorerMenu = async (): Promise<boolean> => {
    try {
        const regDelete = `Windows Registry Editor Version 5.00
        
        [-HKEY_CURRENT_USER\\Software\\Classes\\directory\\shell\\Yomikiru]
        
        [-HKEY_CLASSES_ROOT\\.cbz\\shell\\Yomikiru]

        [-HKEY_CLASSES_ROOT\\Yomikiru]

        [HKEY_CLASSES_ROOT\\.zip\\OpenWithProgids]
        "Yomikiru"=-

        [HKEY_CLASSES_ROOT\\.pdf\\OpenWithProgids]
        "Yomikiru"=-

        [HKEY_CLASSES_ROOT\\.7z\\OpenWithProgids]
        "Yomikiru"=-
        `;

        const tempPath = app.getPath("temp");
        const regFilePath = path.join(tempPath, "deleteOpenWithYomikiru.reg");

        await fs.writeFile(regFilePath, regDelete);

        return await new Promise<boolean>((resolve, reject) => {
            sudo.exec(`regedit.exe /S ${regFilePath}`, op, (error) => {
                if (error) {
                    log.error("Failed to delete explorer menu option:", error);
                    reject(new Error(`Failed to delete explorer menu option: ${error.message}`));
                    return;
                }
                resolve(true);
            });
        });
    } catch (error) {
        log.error("Error in deleteOptionInExplorerMenu:", error);
        throw error;
    }
};

export const deleteOptionInExplorerMenu_epub = async (): Promise<boolean> => {
    try {
        const regDelete = `Windows Registry Editor Version 5.00
        
        [-HKEY_CLASSES_ROOT\\.epub\\shell\\Yomikiru]

        `;

        const tempPath = app.getPath("temp");
        const regFilePath = path.join(tempPath, "deleteOpenWithYomikiru-epub.reg");

        await fs.writeFile(regFilePath, regDelete);

        return await new Promise<boolean>((resolve, reject) => {
            sudo.exec(`regedit.exe /S ${regFilePath}`, op, (error) => {
                if (error) {
                    log.error("Failed to delete epub explorer menu option:", error);
                    reject(new Error(`Failed to delete epub explorer menu option: ${error.message}`));
                    return;
                }
                resolve(true);
            });
        });
    } catch (error) {
        log.error("Error in deleteOptionInExplorerMenu_epub:", error);
        throw error;
    }
};
