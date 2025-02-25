import Colorjs from "color";

export const colorUtils: typeof window.color = {
    new: (args) => Colorjs(args),
    realColor(var_or_color, themeDataMain) {
        if (this.cleanVariable(var_or_color)) {
            return this.varToColor(var_or_color, themeDataMain) as Colorjs;
        }
        return this.new(var_or_color);
    },
    cleanVariable(variableStr) {
        if (/var\(.*\)/gi.test(variableStr)) {
            return variableStr.replace("var(", "").replace(")", "") as ThemeDataMain;
        }
    },
    varToColor(variableStr, themeDataMain) {
        if (/var\(.*\)/gi.test(variableStr)) {
            let base = this.cleanVariable(variableStr);
            let clr = "";
            // getting real color value from a css variable (var(--btn-color-hover) -> #62636e)
            while (base && themeDataMain[base]) {
                clr = themeDataMain[base];
                // repeating in case variable is linked to another variable (var(--btn-color-hover) -> var(--btn-color))
                if (clr.includes("var(")) {
                    base = this.cleanVariable(clr);
                    continue;
                }
                break;
            }
            if (clr === "") window.logger.error("THEME::varToColor: color not found.");
            return this.new(clr);
        }
    },
};
