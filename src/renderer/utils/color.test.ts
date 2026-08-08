import { describe, expect, it } from "vitest";
import { colorUtils } from "./color";

const themeMain = {
    "--btn-color": "#111111",
    "--btn-color-hover": "var(--btn-color)",
} as ThemeData["main"];

describe("colorUtils", () => {
    it("cleanVariable strips var(...)", () => {
        expect(colorUtils.cleanVariable("var(--btn-color)")).toBe("--btn-color");
        expect(colorUtils.cleanVariable("#fff")).toBeUndefined();
    });

    it("varToColor resolves nested CSS variable chains", () => {
        const color = colorUtils.varToColor("var(--btn-color-hover)", themeMain);
        expect(color?.hex().toLowerCase()).toBe("#111111");
    });

    it("realColor accepts raw color strings", () => {
        expect(colorUtils.realColor("#ff0000", themeMain).hex().toLowerCase()).toBe("#ff0000");
    });
});
