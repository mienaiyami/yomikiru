import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import themeInit from "../themeInit.json";
import { saveJSONfile, themesPath } from "../MainImports";
import { useAppDispatch } from "./hooks";
import { setAppSettings } from "./appSettings";

type Themes = { name: string; allData: ThemeData[] };

const initialState: Themes = {
    name: "theme2",
    allData: [],
};

if (window.fs.existsSync(themesPath)) {
    const raw = window.fs.readFileSync(themesPath, "utf8");
    if (raw) {
        try {
            const data: ThemeData[] = JSON.parse(raw);
            // validate theme data
            let changed = false;
            if (typeof data[0].main === "string" || !Array.isArray(data))
                throw { message: "Theme variable does not exist on theme.main" };
            for (const prop in window.themeProps) {
                let rewriteNeeded = false;
                data.forEach((e) => {
                    if (!e.main[prop as ThemeDataMain]) {
                        if (themeInit.map((t) => t.name).includes(e.name)) {
                            window.logger.log(
                                `"${prop}" does not exist on default theme - "${e.name}", rewriting it whole.`
                            );
                            e.main = themeInit.find((t) => t.name === e.name)!.main;
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
            if (changed)
                window.dialog.warn({
                    message:
                        'Some properties were missing in themes. Added new as "Red" color, change accordingly or re-edit default themes.\nCheck log file for exact names.',
                });
            initialState.allData.push(...data);
        } catch (err) {
            window.dialog.customError({
                message: "Unable to parse " + themesPath + "\nMaking new themes.json..." + "\n" + err,
            });
            window.logger.error(err);
            initialState.allData.push(...themeInit);
            // window.fs.writeFileSync(themesPath, JSON.stringify(themeInit));
        }
        // if (JSON.parse(raw).length < 3) {
        //     window.fs.writeFileSync(themesPath, JSON.stringify(themes));
        //     initialState.push(...themes);
        // }else
    }
} else {
    initialState.allData.push(...themeInit);
    window.fs.writeFileSync(themesPath, JSON.stringify(themeInit, null, "\t"));
}

// todoL replace with real theme state;
if (!initialState.allData.map((e) => e.name).includes("theme2")) {
    window.dialog
        .warn({
            title: "Error",
            message: `Theme "${"theme2"}" does not exist. Try fixing or deleting theme.json and settings.json in "userdata" folder.(at "%appdata%/Yomikiru/" or in main folder on Portable version)`,
            noOption: false,
            defaultId: 0,
            buttons: ["Ok", "Temporary fix", "Open Location"],
        })
        .then((res) => {
            // todo:
            // if (res.response === 1) {
            //     settings.theme = initialState[0].name;
            //     window.fs.writeFileSync(settingsPath, JSON.stringify(settings));
            //     window.location.reload();
            // }
            // if (res.response === 2) {
            //     window.electron.shell.showItemInFolder(themesPath);
            // }
        });
}

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
            // window.electron.getCurrentWindow().setTitleBarOverlay({
            //     color: window.getComputedStyle(document.querySelector("body #topBar")!).backgroundColor,
            //     symbolColor: window.getComputedStyle(document.querySelector("body #topBar .homeBtns button")!)
            //         .color,
            // });
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

// const dispatch = useAppDispatch();

const themes = createSlice({
    name: "allThemes",
    initialState,
    reducers: {
        setTheme: (state, action: PayloadAction<string>) => {
            const newStore: Themes = { ...state, name: action.payload };
            // dispatch(setAppSettings({ theme: action.payload }));
            setBodyTheme(newStore);
            saveJSONfile(themesPath, newStore.allData);
            return newStore;
        },
        newTheme: (state, action: PayloadAction<ThemeData>) => {
            state.allData.push(action.payload);
            console.log("new theme added", action.payload);
            saveJSONfile(themesPath, state.allData);
        },
        updateTheme: (
            state,
            action: PayloadAction<{ themeName: string; newThemeData: typeof window.themeProps }>
        ) => {
            state.allData[state.allData.findIndex((e) => e.name === action.payload.themeName)].main =
                action.payload.newThemeData;
            saveJSONfile(themesPath, state.allData);
        },
        deleteTheme: (state, action: PayloadAction<number>) => {
            state.allData.splice(action.payload, 1);
            saveJSONfile(themesPath, state.allData);
        },
    },
});

export const { newTheme, updateTheme, deleteTheme, setTheme } = themes.actions;

export default themes.reducer;
