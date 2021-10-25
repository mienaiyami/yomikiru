import { useLayoutEffect, useState } from "react";
export default function useTheme(
    newTheme: string,
    themes: {
        name: string;
        main: string;
    }[]
): [string, React.Dispatch<React.SetStateAction<string>>] {
    const [theme, setTheme] = useState(newTheme);
    useLayoutEffect(() => {
        if (themes.map((e) => e.name).includes(theme)) {
            document.body.style.cssText = themes.find((e) => e.name === theme)?.main || "";
            // document.body.setAttribute("data-theme", theme);
        }
    }, [theme]);
    return [theme, setTheme];
}
