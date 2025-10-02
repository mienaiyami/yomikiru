import { createSlice, current, type PayloadAction } from "@reduxjs/toolkit";
import { colorUtils } from "@utils/color";
import { dialogUtils } from "@utils/dialog";
import { saveJSONfile, themesPath } from "../utils/file";
import { initThemeData, themeProps } from "../utils/theme";

export const setSysBtnColor = (blurred = false) => {
    const topbarElem = document.querySelector<HTMLDivElement>("body #topBar");
    if (topbarElem) {
        let color = colorUtils.new(
            window.getComputedStyle(document.body).getPropertyValue("--icon-color") || "#ffffff",
        );
        if (blurred) {
            color = color.alpha(0.3);
        }
        topbarElem.style.color = color.hexa();
        process.platform === "win32" &&
            window.electron.currentWindow.setTitleBarOverlay()({
                color: window.getComputedStyle(topbarElem).backgroundColor,
                symbolColor: color.hexa(),
                height: Math.floor(window.app.titleBarHeight * window.electron.webFrame.getZoomFactor()),
            });
    }
};

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
                    setSysBtnColor(!window.electron.currentWindow.isFocused());
                    const elem = document.querySelector(".windowBtnCont") as HTMLDivElement;
                    if (elem) elem.style.right = `${140 * (1 / window.electron.webFrame.getZoomFactor())}px`;
                }, 1000);
            }
        } else {
            dialogUtils.customError({
                title: "Error",
                message: `"${name}" Theme does not exist or is corrupted.\nRewriting theme`,
            });
            window.fs.rm(window.path.join(window.electron.app.getPath("userData"), "themes.json"));
            window.location.reload();
        }
    } else {
        dialogUtils.customError({
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
            if (Array.isArray(data) || !Object.hasOwn(data, "name")) {
                data = {
                    name: "theme2",
                    allData: data,
                };
                window.logger.log("Old theme version detected. Converting to new.");
                saveJSONfile(themesPath, data);
            }

            // validate theme data
            if (typeof data.allData[0].main === "string" || !Array.isArray(data.allData))
                throw { message: "Theme variable does not exist on theme.main" };
            const addedProp = new Set<string>();
            for (const prop in themeProps) {
                let rewriteNeeded = false;
                (data as Themes).allData.forEach((e) => {
                    if (!e.main[prop as ThemeDataMain]) {
                        if (initThemeData.allData.map((t) => t.name).includes(e.name)) {
                            window.logger.log(
                                `"${prop}" does not exist on default theme - "${e.name}", rewriting it whole.`,
                            );
                            e.main = initThemeData.allData.find((t) => t.name === e.name)!.main;
                            rewriteNeeded = true;
                        } else {
                            window.logger.log(
                                `"${prop}" does not exist on theme - "${e.name}", adding it with value "#ff0000".`,
                            );
                            addedProp.add(`\t"${themeProps[prop as ThemeDataMain]}"`);
                            rewriteNeeded = true;
                            changed = true;
                            e.main[prop as ThemeDataMain] = "#ff0000";
                        }
                    }
                    /**check and fix change in theme value */
                    initThemeData.allData.forEach((e) => {
                        const dataTheme = (data as Themes).allData.find((a) => a.name === e.name);
                        if (dataTheme)
                            Object.entries(e.main).forEach(([key, value]) => {
                                dataTheme.main[key as keyof ThemeData["main"]] = value;
                            });
                    });
                });
                if (rewriteNeeded) saveJSONfile(themesPath, data);
            }
            // check if default theme exist
            // todo: remove in later versions, today 15/07/2023
            let changed2 = false;
            [...initThemeData.allData].reverse().forEach((e) => {
                if (!data.allData.map((e: any) => e.name).includes(e.name)) {
                    window.logger.log(`Added default theme "${e.name}".`);
                    data.allData.unshift(e);
                    changed2 = true;
                }
            });
            if (changed2) {
                dialogUtils.warn({
                    message: "Changes in Default Themes. Old themes still exist but can be deleted.",
                });
                saveJSONfile(themesPath, data);
            }
            if (changed) {
                dialogUtils.warn({
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
                dialogUtils.customError({
                    message: "Theme system changed, old themes will be deleted. Sorry for your inconvenience.",
                });
            else
                dialogUtils.customError({
                    message: `Unable to parse ${themesPath}\nMaking new themes.json...\n${err}`,
                });
            window.logger.error(err);
            initialState.name = initThemeData.name;
            initialState.allData = initThemeData.allData;
            // window.fs.writeFileSync(themesPath, JSON.stringify(initThemeData));
            saveJSONfile(themesPath, initThemeData);
        }
        // if (JSON.parse(raw).length < 3) {
        //     window.fs.writeFileSync(themesPath, JSON.stringify(themes));
        //     initialState.push(...themes);
        // }else
    }
} else {
    initialState.name = initThemeData.name;
    initialState.allData = initThemeData.allData;
    saveJSONfile(themesPath, initThemeData);
}

if (!initialState.allData.map((e) => e.name).includes(initialState.name)) {
    dialogUtils.customError({
        title: "Error",
        message: `Theme "${initialState.name}" does not exist. Switching to default theme.`,
    });
    initialState.name = "theme2";
    saveJSONfile(themesPath, initialState);
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
                    action.payload.name,
                );
            } else state.allData.push(action.payload);
        },
        refreshThemes: () => {
            try {
                return JSON.parse(window.fs.readFileSync(themesPath, "utf8"));
            } catch {
                dialogUtils.customError({
                    title: "Error",
                    message: `Unable to parse ${themesPath}\nMaking new themes.json...`,
                });
            }
        },
        addThemes: (state, action: PayloadAction<ThemeData[]>) => {
            if (Array.isArray(action.payload)) {
                action.payload.forEach((theme) => {
                    if ("name" in theme) {
                        if (state.allData.map((e) => e.name).includes(theme.name)) {
                            window.logger.error(
                                "Tried to add new theme but theme name already exist. Name:",
                                theme.name,
                            );
                        } else state.allData.push(theme);
                    }
                });
            }
        },
        updateTheme: (state, action: PayloadAction<{ themeName: string; newThemeData: typeof themeProps }>) => {
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
            saveJSONandApply(initThemeData);
            return initThemeData;
        },
    },
});

export const { newTheme, updateTheme, deleteTheme, setTheme, resetAllTheme, addThemes, refreshThemes } =
    themes.actions;

export default themes.reducer;
