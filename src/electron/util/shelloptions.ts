import sudo from "@vscode/sudo-prompt";
import { app } from "electron";
import fs from "fs";
import path from "path";
import { IS_PORTABLE } from ".";

// registry, add option "open in reader" in  explorer context menu
export const addOptionToExplorerMenu = () => {
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
    fs.writeFileSync(path.join(tempPath, "createOpenWithYomikiru.reg"), regInit);

    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec("regedit.exe /S " + path.join(tempPath, "createOpenWithYomikiru.reg"), op, function (error) {
        if (error) log.error(error);
    });
};
export const addOptionToExplorerMenu_epub = () => {
    app;
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
    fs.writeFileSync(path.join(tempPath, "createOpenWithYomikiru-epub.reg"), regInit);

    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec("regedit.exe /S " + path.join(tempPath, "createOpenWithYomikiru-epub.reg"), op, function (error) {
        if (error) log.error(error);
    });
};
export const deleteOptionInExplorerMenu = () => {
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
    fs.writeFileSync(path.join(app.getPath("temp"), "deleteOpenWithYomikiru.reg"), regDelete);
    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec(
        "regedit.exe /S " + path.join(app.getPath("temp"), "deleteOpenWithYomikiru.reg"),
        op,
        function (error) {
            if (error) log.error(error);
        }
    );
};
export const deleteOptionInExplorerMenu_epub = () => {
    const regDelete = `Windows Registry Editor Version 5.00
    
    [-HKEY_CLASSES_ROOT\\.epub\\shell\\Yomikiru]

    `;
    fs.writeFileSync(path.join(app.getPath("temp"), "deleteOpenWithYomikiru-epub.reg"), regDelete);
    const op = {
        name: "Yomikiru",
        icns: app.getPath("exe"),
    };
    sudo.exec(
        "regedit.exe /S " + path.join(app.getPath("temp"), "deleteOpenWithYomikiru-epub.reg"),
        op,
        function (error) {
            if (error) log.error(error);
        }
    );
};
