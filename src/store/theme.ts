import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { useAppSelector } from "./hooks";

// todo: import from settings;
const initialState = "theme2";

// todo: uses allThemes and "../hooks/useTheme.tsx"

const setBodyTheme = (state: string, themes: ThemeData[]) => {
    if (themes.map((e) => e.name).includes(state)) {
        let themeStr = "";
        if (themes.find((e) => e.name)) {
            const themeData: { [key: string]: string } = themes.find((e) => e.name === state)!.main;
            for (const key in themeData) {
                themeStr += `${key}:${themeData[key]};`;
            }
            document.body.style.cssText = themeStr || "";
            document.body.setAttribute("data-theme", state);
            // window.electron.getCurrentWindow().setTitleBarOverlay({
            //     color: window.getComputedStyle(document.querySelector("body #topBar")!).backgroundColor,
            //     symbolColor: window.getComputedStyle(document.querySelector("body #topBar .homeBtns button")!)
            //         .color,
            // });
        } else {
            window.dialog.customError({
                title: "Error",
                message: '"' + state + '" Theme does not exist or is corrupted.\nRewriting theme',
            });
            window.fs.unlinkSync(window.path.join(window.electron.app.getPath("userData"), "themes.json"));
            window.location.reload();
        }
    } else {
        window.dialog.customError({
            title: "Error",
            message: `Theme "${state}" does not exist. Try fixing or deleting theme.json and settings.json in "userdata" folder.(at "%appdata%/Yomikiru/" or in main folder on Portable version)`,
        });
    }
};

const theme = createSlice({
    name: "theme",
    initialState,
    reducers: {
        setTheme: (state, action: PayloadAction<{ theme: string; allThemes: ThemeData[] }>) => {
            const { allThemes, theme } = action.payload;
            state = theme;
            setBodyTheme(state, allThemes);
            return state;
        },
    },
});

export const { setTheme } = theme.actions;

export default theme.reducer;
