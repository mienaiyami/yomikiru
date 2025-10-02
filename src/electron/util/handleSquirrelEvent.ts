import { spawn, spawnSync } from "child_process";
import { app } from "electron";
import fs from "fs";
import { homedir, tmpdir } from "os";
import path from "path";
import { IS_PORTABLE } from ".";
import { deleteOptionInExplorerMenu, deleteOptionInExplorerMenu_epub } from "./shelloptions";

const handleSquirrelEvent = () => {
    if (process.argv.length === 1 || process.platform !== "win32") {
        return false;
    }
    const appFolder = path.resolve(process.execPath, "..");
    const rootFolder = path.resolve(appFolder, "..");
    // const updateDotExe = path.resolve(path.join(rootFolder, "Update.exe"));
    const appPath = IS_PORTABLE
        ? app.getPath("exe").replace(/\\/g, "\\\\")
        : path.join(app.getPath("exe").replace(/\\/g, "\\\\"), `../../${app.name}.exe`);
    // const spawnUpdate = (args: any) => spawn(updateDotExe, args);
    const squirrelEvent = process.argv[1];
    switch (squirrelEvent) {
        case "--squirrel-install":
        case "--squirrel-updated": {
            // const createShortcutArgs = [
            //     `--createShortcut="${app.getName()}.exe"`,
            //     "--shortcut-locations=Desktop,StartMenu",
            // ];
            // spawn(path.join(appPath, "../Update.exe"), createShortcutArgs, { detached: true });
            const vbsScript = `
            Set WshShell = CreateObject("Wscript.shell")
            strDesktop = WshShell.SpecialFolders("Desktop")
            Set oMyShortcut = WshShell.CreateShortcut(strDesktop + "\\Yomikiru.lnk")
            oMyShortcut.WindowStyle = "1"
            oMyShortcut.IconLocation = "${path.resolve(rootFolder, "app.ico")}"
            OMyShortcut.TargetPath = "${appPath}"
            oMyShortCut.Save
            strStartMenu = WshShell.SpecialFolders("StartMenu")
            Set oMyShortcut2 = WshShell.CreateShortcut(strStartMenu + "\\programs\\Yomikiru.lnk")
            oMyShortcut2.WindowStyle = "1"
            oMyShortcut2.IconLocation = "${path.resolve(rootFolder, "app.ico")}"
            OMyShortcut2.TargetPath = "${appPath}"
            oMyShortCut2.Save
            `;
            fs.writeFileSync(path.resolve(rootFolder, "shortcut.vbs"), vbsScript);
            spawnSync("cscript.exe", [path.resolve(rootFolder, "shortcut.vbs")]);

            // fs.unlinkSync(path.resolve(rootFolder, "shortcut.vbs"));
            app.quit();
            break;
        }

        case "--squirrel-uninstall": {
            if (
                fs.existsSync(
                    path.resolve(homedir(), "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Yomikiru.lnk"),
                )
            )
                fs.unlinkSync(
                    path.resolve(homedir(), "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Yomikiru.lnk"),
                );
            deleteOptionInExplorerMenu();
            deleteOptionInExplorerMenu_epub();
            if (fs.existsSync(path.resolve(homedir(), "Desktop/Yomikiru.lnk")))
                fs.unlinkSync(path.resolve(homedir(), "Desktop/Yomikiru.lnk"));
            const uninstallFull = `
            set WshShell = CreateObject("Wscript.shell")
            WScript.Sleep 30000
            Dim FSO
            set FSO=CreateObject("Scripting.FileSystemObject")
            FSO.DeleteFolder("${app.getPath("userData")}")
            FSO.DeleteFolder("${rootFolder}\\*")
            `;
            const temp = fs.mkdtempSync(path.join(tmpdir(), "foo-"));
            fs.writeFileSync(path.join(temp, "uninstall.vbs"), uninstallFull);
            spawn("cscript.exe", [path.resolve(temp, "uninstall.vbs")], {
                detached: true,
            });
            app.quit();
            break;
        }
        case "--squirrel-obsolete":
            app.quit();
            break;
    }
};

export default handleSquirrelEvent;
