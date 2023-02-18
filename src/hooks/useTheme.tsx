import { useLayoutEffect, useState } from "react";
export default function useTheme(
    newTheme: string,
    themes: ThemeData[]
): [string, React.Dispatch<React.SetStateAction<string>>] {
    const [theme, setTheme] = useState(newTheme);
    useLayoutEffect(() => {
        if (themes.map((e) => e.name).includes(theme)) {
            let themeStr = "";
            if (themes.find((e) => e.name)) {
                const themeData: { [key: string]: string } = themes.find((e) => e.name === theme)!.main;
                for (const key in themeData) {
                    themeStr += `${key}:${themeData[key]};`;
                }
                document.body.style.cssText = themeStr || "";
                document.body.setAttribute("data-theme", theme);
                window.electron.getCurrentWindow().setTitleBarOverlay({
                    color: window.getComputedStyle(document.querySelector("body #topBar")!).backgroundColor,
                    symbolColor: window.getComputedStyle(document.querySelector("body #topBar .homeBtns button")!)
                        .color,
                });
            } else {
                window.dialog.customError({
                    title: "Error",
                    message: '"' + theme + '" Theme does not exist or is corrupted.\nRewriting theme',
                });
                window.fs.unlinkSync(window.path.join(window.electron.app.getPath("userData"), "themes.json"));
                window.location.reload();
            }
        } else {
            window.dialog.customError({
                title: "Error",
                message: `Theme "${theme}" does not exist. Try fixing or deleting theme.json and settings.json in "userdata" folder.(at "%appdata%/Yomikiru/" or in main folder on Portable version)`,
            });
        }
    }, [theme]);
    return [theme, setTheme];
}
