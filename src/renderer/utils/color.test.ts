import { describe, expect, it } from "vitest";
import { colorUtils, hexToSvgDataUri } from "./color";

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

describe("hexToSvgDataUri", () => {
    it("wraps a hex color in an SVG data URI with an encoded fill", () => {
        const uri = hexToSvgDataUri("#ff0000");
        expect(uri).toMatch(/^data:image\/svg\+xml,/);
        expect(uri).toContain("%23ff0000");
        const svg = decodeURIComponent(uri!.slice("data:image/svg+xml,".length));
        expect(svg).toContain("xmlns='http://www.w3.org/2000/svg'");
        expect(svg).toContain("<rect width='100%' height='100%' fill='#ff0000'/>");
    });

    it("accepts 3-digit hex and rejects non-hex colors", () => {
        expect(hexToSvgDataUri("#abc")).toContain("%23abc");
        expect(hexToSvgDataUri("red")).toBeNull();
        expect(hexToSvgDataUri("#gggggg")).toBeNull();
        expect(hexToSvgDataUri("")).toBeNull();
    });
});
