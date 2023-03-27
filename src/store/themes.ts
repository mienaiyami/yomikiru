import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import themeInit from "../themeInit.json";
import { saveJSONfile, themesPath } from "../MainImports";

const setBodyTheme = ({ allData, name }: Themes) => {
    if (allData.map((e) => e.name).includes(name)) {
        let themeStr = "";
        if (allData.find((e) => e.name)) {
            const themeData: { [key: string]: string } = allData.find((e) => e.name === name)!.main;
            for (const key in themeData) {
                themeStr += `${key}:${themeData[key]};`;
            }
            document.body.style.cssText = themeStr || "";
            document.body.setAttribute("data-theme", name);
            if (process.platform === "win32")
                window.electron.getCurrentWindow().setTitleBarOverlay({
                    color: window.getComputedStyle(document.querySelector("body #topBar")!).backgroundColor,
                    symbolColor: window.getComputedStyle(document.querySelector("body #topBar .homeBtns button")!)
                        .color,
                    height: Math.floor(40 * window.devicePixelRatio),
                });
        } else {
            window.dialog.customError({
                title: "Error",
                message: '"' + name + '" Theme does not exist or is corrupted.\nRewriting theme',
            });
            window.fs.unlinkSync(window.path.join(window.electron.app.getPath("userData"), "themes.json"));
            window.location.reload();
        }
    } else {
        window.dialog.customError({
            title: "Error",
            message: `Theme "${name}" does not exist. Try fixing or deleting theme.json and settings.json in "userdata" folder.(at "%appdata%/Yomikiru/" or in main folder on Portable version)`,
        });
    }
};

type Themes = { name: string; allData: ThemeData[] };

const initialState: Themes = {
    name: "theme2",
    allData: [],
};

if (window.fs.existsSync(themesPath)) {
    const raw = window.fs.readFileSync(themesPath, "utf8");
    if (raw) {
        try {
            let data = JSON.parse(raw);
            if (data.allData[0].main["--body-bg"]) {
                throw new Error("newTheme");
            }
            // validate theme data
            let changed = false;
            if (data instanceof Array || !Object.prototype.hasOwnProperty.call(data, "name")) {
                data = {
                    name: "theme2",
                    allData: data,
                };
                window.logger.log("Old theme version detected. Converting to new.");
                window.fs.writeFileSync(themesPath, JSON.stringify(data, null, "\t"));
            }
            if (typeof data.allData[0].main === "string" || !Array.isArray(data.allData))
                throw { message: "Theme variable does not exist on theme.main" };
            for (const prop in window.themeProps) {
                let rewriteNeeded = false;
                (data as Themes).allData.forEach((e) => {
                    if (!e.main[prop as ThemeDataMain]) {
                        if (themeInit.allData.map((t) => t.name).includes(e.name)) {
                            window.logger.log(
                                `"${prop}" does not exist on default theme - "${e.name}", rewriting it whole.`
                            );
                            e.main = themeInit.allData.find((t) => t.name === e.name)!.main;
                            rewriteNeeded = true;
                        } else {
                            window.logger.log(
                                `"${prop}" does not exist on theme - "${e.name}", adding it with value "#ff0000".`
                            );
                            rewriteNeeded = true;
                            changed = true;
                            e.main[prop as ThemeDataMain] = "#ff0000";
                        }
                    }
                });
                if (rewriteNeeded) window.fs.writeFileSync(themesPath, JSON.stringify(data, null, "\t"));
            }
            if (changed) {
                window.dialog.warn({
                    message:
                        'Some properties were missing in themes. Added new as "Red" color, change accordingly or re-edit default themes.\nCheck log file for exact names.',
                });
            }
            initialState.name = data.name;
            initialState.allData = data.allData;
        } catch (err: any) {
            if (err.message === "newTheme")
                window.dialog.customError({
                    message: "Theme system changed, old themes will be deleted. Sorry for your inconvenience.",
                });
            else
                window.dialog.customError({
                    message: "Unable to parse " + themesPath + "\nMaking new themes.json..." + "\n" + err,
                });
            window.logger.error(err);
            initialState.name = themeInit.name;
            initialState.allData = themeInit.allData;
            // window.fs.writeFileSync(themesPath, JSON.stringify(themeInit));
            window.fs.writeFileSync(themesPath, JSON.stringify(themeInit, null, "\t"));
        }
        // if (JSON.parse(raw).length < 3) {
        //     window.fs.writeFileSync(themesPath, JSON.stringify(themes));
        //     initialState.push(...themes);
        // }else
    }
} else {
    initialState.name = themeInit.name;
    initialState.allData = themeInit.allData;
    window.fs.writeFileSync(themesPath, JSON.stringify(themeInit, null, "\t"));
}

if (!initialState.allData.map((e) => e.name).includes(initialState.name)) {
    window.dialog
        .warn({
            title: "Error",
            message: `Theme "${initialState.name}" does not exist. Try fixing or deleting theme.json and settings.json in "userdata" folder.(at "%appdata%/Yomikiru/" or in main folder on Portable version)`,
            noOption: false,
            defaultId: 0,
            buttons: ["Ok", "Temporary fix", "Open Location"],
        })
        .then((res) => {
            if (res.response === 1) {
                initialState.name = "theme2";
                window.fs.writeFileSync(themesPath, JSON.stringify(initialState, null, "\t"));
                window.location.reload();
            }
            if (res.response === 2) {
                if (process.platform === "win32") window.electron.shell.showItemInFolder(themesPath);
                else if (process.platform === "linux")
                    window.electron.ipcRenderer.send("showInExplorer", themesPath);
            }
        });
}

const saveJSONandApply = (state: Themes) => {
    setBodyTheme(state);
    saveJSONfile(themesPath, state);
};

const themes = createSlice({
    name: "allThemes",
    initialState,
    reducers: {
        setTheme: (state, action: PayloadAction<string>) => {
            const newStore: Themes = { ...state, name: action.payload };
            saveJSONandApply(newStore);
            return newStore;
        },
        newTheme: (state, action: PayloadAction<ThemeData>) => {
            state.allData.push(action.payload);
        },
        updateTheme: (
            state,
            action: PayloadAction<{ themeName: string; newThemeData: typeof window.themeProps }>
        ) => {
            state.allData[state.allData.findIndex((e) => e.name === action.payload.themeName)].main =
                action.payload.newThemeData;
            saveJSONandApply(state);
        },
        deleteTheme: (state, action: PayloadAction<number>) => {
            state.allData.splice(action.payload, 1);
            saveJSONfile(themesPath, state);
        },
        resetAllTheme: () => {
            saveJSONandApply(themeInit);
            return themeInit;
        },
    },
});

export const { newTheme, updateTheme, deleteTheme, setTheme, resetAllTheme } = themes.actions;

export default themes.reducer;
