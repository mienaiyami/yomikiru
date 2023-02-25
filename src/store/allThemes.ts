import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import themeInit from "../themeInit.json";
import { saveJSONfile, themesPath } from "../MainImports";

const initialState: ThemeData[] = [];

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
            initialState.push(...data);
        } catch (err) {
            window.dialog.customError({
                message: "Unable to parse " + themesPath + "\nMaking new themes.json..." + "\n" + err,
            });
            window.logger.error(err);
            initialState.push(...themeInit);
            // window.fs.writeFileSync(themesPath, JSON.stringify(themeInit));
        }
        // if (JSON.parse(raw).length < 3) {
        //     window.fs.writeFileSync(themesPath, JSON.stringify(themes));
        //     initialState.push(...themes);
        // }else
    }
} else {
    initialState.push(...themeInit);
    window.fs.writeFileSync(themesPath, JSON.stringify(themeInit, null, "\t"));
}

// todoL replace with real theme state;
if (!initialState.map((e) => e.name).includes("theme2")) {
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

const allThemes = createSlice({
    name: "allThemes",
    initialState,
    reducers: {
        newTheme: (state, action: PayloadAction<ThemeData>) => {
            state.push(action.payload);
            saveJSONfile(themesPath, state);
        },
        updateTheme: (
            state,
            action: PayloadAction<{ themeName: string; newThemeData: typeof window.themeProps }>
        ) => {
            state[state.findIndex((e) => e.name === action.payload.themeName)].main = action.payload.newThemeData;
            saveJSONfile(themesPath, state);
        },
        deleteTheme: (state, action: PayloadAction<number>) => {
            state.splice(action.payload, 1);
            saveJSONfile(themesPath, state);
        },
    },
});

export const { newTheme, updateTheme, deleteTheme } = allThemes.actions;

export default allThemes.reducer;
