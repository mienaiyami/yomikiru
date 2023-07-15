import { createSlice, current, PayloadAction } from "@reduxjs/toolkit";
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
            if (process.platform === "win32") {
                setTimeout(() => {
                    window.electron.getCurrentWindow().setTitleBarOverlay({
                        color: window.getComputedStyle(document.querySelector("body #topBar")!).backgroundColor,
                        symbolColor: window.getComputedStyle(
                            document.querySelector("body #topBar .homeBtns button")!
                        ).color,
                        height: Math.floor(40 * window.electron.webFrame.getZoomFactor()),
                    });

                    (document.querySelector(".windowBtnCont") as HTMLDivElement).style.right = `${
                        140 * (1 / window.electron.webFrame.getZoomFactor())
                    }px`;
                }, 1000);
            }
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

const initialState: Themes = {
    name: "theme2",
    allData: [],
};

if (window.fs.existsSync(themesPath)) {
    const raw = window.fs.readFileSync(themesPath, "utf8");
    if (raw) {
        try {
            let data = JSON.parse(raw);
            // todo remove in later version
            if (data.allData[0].main["--body-bg"]) {
                throw new Error("newTheme");
            }
            // validate theme data
            let changed = false;
            // todo remove in later version
            if (data instanceof Array || !Object.prototype.hasOwnProperty.call(data, "name")) {
                data = {
                    name: "theme2",
                    allData: data,
                };
                window.logger.log("Old theme version detected. Converting to new.");
                window.fs.writeFileSync(themesPath, JSON.stringify(data, null, "\t"));
            }

            // validate theme data
            if (typeof data.allData[0].main === "string" || !Array.isArray(data.allData))
                throw { message: "Theme variable does not exist on theme.main" };
            const addedProp = new Set<string>();
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
                            addedProp.add('\t"' + window.themeProps[prop as ThemeDataMain] + '"');
                            rewriteNeeded = true;
                            changed = true;
                            e.main[prop as ThemeDataMain] = "#ff0000";
                        }
                    }
                    /**check and fix change in theme value */
                    themeInit.allData.forEach((e) => {
                        const dataTheme = (data as Themes).allData.find((a) => a.name === e.name);
                        if (dataTheme)
                            Object.entries(e.main).forEach(([key, value]) => {
                                dataTheme.main[key as keyof ThemeData["main"]] = value;
                            });
                    });
                });
                if (rewriteNeeded) window.fs.writeFileSync(themesPath, JSON.stringify(data, null, "\t"));
            }
            // check if default theme exist
            // todo: remove in later versions, today 15/07/2023
            let changed2 = false;
            [...themeInit.allData].reverse().forEach((e) => {
                if (!data.allData.map((e: any) => e.name).includes(e.name)) {
                    window.logger.log(`Added default theme "${e.name}".`);
                    data.allData.unshift(e);
                    changed2 = true;
                }
            });
            if (changed2) {
                window.dialog.warn({
                    message: "Changes in Default Themes. Old themes still exist but can be deleted.",
                });
                window.fs.writeFileSync(themesPath, JSON.stringify(data, null, "\t"));
            }
            if (changed) {
                window.dialog.warn({
                    message:
                        'Some properties were missing in themes. Added new as "Red" color, change accordingly or re-edit default themes.' +
                        "\nNew Properties:\n" +
                        [...addedProp.values()].join("\n"),
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
    window.dialog.customError({
        title: "Error",
        message: `Theme "${initialState.name}" does not exist. Switching to default theme.`,
    });
    initialState.name = "theme2";
    window.fs.writeFileSync(themesPath, JSON.stringify(initialState, null, "\t"));
    window.location.reload();
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
            saveJSONandApply({ name: newStore.name, allData: current(newStore.allData) });
            return newStore;
        },
        newTheme: (state, action: PayloadAction<ThemeData>) => {
            if (state.allData.map((e) => e.name).includes(action.payload.name)) {
                window.logger.error(
                    "Tried to add new theme but theme name already exist. Name:",
                    action.payload.name
                );
            } else state.allData.push(action.payload);
        },
        addThemes: (state, action: PayloadAction<ThemeData[]>) => {
            if (action.payload instanceof Array) {
                action.payload.forEach((theme) => {
                    if (("main" && "name") in theme) {
                        if (state.allData.map((e) => e.name).includes(theme.name)) {
                            window.logger.error(
                                "Tried to add new theme but theme name already exist. Name:",
                                theme.name
                            );
                        } else state.allData.push(theme);
                    }
                });
            }
        },
        updateTheme: (
            state,
            action: PayloadAction<{ themeName: string; newThemeData: typeof window.themeProps }>
        ) => {
            state.allData[state.allData.findIndex((e) => e.name === action.payload.themeName)].main =
                action.payload.newThemeData;
            saveJSONandApply(current(state));
        },
        deleteTheme: (state, action: PayloadAction<number | string>) => {
            let index = -1;

            if (typeof action.payload === "number") index = action.payload;
            if (typeof action.payload === "string")
                index = state.allData.findIndex((e) => e.name === action.payload);
            state.allData.splice(index, 1);

            saveJSONfile(themesPath, current(state));
        },
        resetAllTheme: () => {
            saveJSONandApply(themeInit);
            return themeInit;
        },
    },
});

export const { newTheme, updateTheme, deleteTheme, setTheme, resetAllTheme, addThemes } = themes.actions;

export default themes.reducer;
