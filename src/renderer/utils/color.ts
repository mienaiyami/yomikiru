import Colorjs from "color";
import { createRendererLogger } from "./logger";

const log = createRendererLogger("utils/color");

/** CSS hex (#RGB or #RRGGBB) accepted as a solid-fill SVG source. */
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Prefix for an inline SVG used as an `img` / CSS `url()` source. */
const SVG_DATA_URI_PREFIX = "data:image/svg+xml,";

/**
 * Wraps a hex color in a 100% rect SVG data URI for use as an image source.
 * `#` in the fill is percent-encoded so it is not treated as a URL fragment.
 *
 * @returns Data URI, or `null` when `hex` is not a 3- or 6-digit CSS hex color
 */
export const hexToSvgDataUri = (hex: string): string | null => {
    const trimmed = hex.trim();
    if (!HEX_COLOR_RE.test(trimmed)) return null;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' fill='${trimmed}'/></svg>`;
    return `${SVG_DATA_URI_PREFIX}${encodeURIComponent(svg)}`;
};

type ColorUtils = {
    new: (...args: Parameters<typeof Colorjs>) => Colorjs;
    /**
     * returns `Color` from css variable or color string
     */
    realColor: (var_or_color: string, themeDataMain: ThemeData["main"]) => Colorjs;
    /**
     *
     * @param variableStr css variable name, e.g. `var(--btn-color-hover)`
     * @returns `--btn-color-hover`, `undefined` if not valid
     */
    cleanVariable: (variableStr: string) => ThemeDataMain | undefined;
    /**
     *
     * @param variableStr css variable name, e.g. `var(--btn-color-hover)` or `--btn-color-hover`
     */
    varToColor: (variableStr: string, themeDataMain: ThemeData["main"]) => Colorjs | undefined;
};

export const colorUtils: ColorUtils = {
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
            if (clr === "") log.error(`varToColor: unresolved CSS variable chain for "${variableStr}"`);
            return this.new(clr);
        }
    },
};
