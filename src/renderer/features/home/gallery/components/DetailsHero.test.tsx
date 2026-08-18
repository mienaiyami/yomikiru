import { describe, expect, it } from "vitest";
import {
    clampDetailsHeroHeight,
    DETAILS_HERO_HEIGHT_MAX_FRACTION,
    DETAILS_HERO_RESIZE_MIN_PX,
} from "./DetailsHero";

/** Splitter clamp only; the rem auto floor lives in CSS on `.details-meta.is-auto`. */

describe("clampDetailsHeroHeight", () => {
    it("uses the resize min when the panel is tall enough", () => {
        expect(clampDetailsHeroHeight(10, 2000)).toBe(DETAILS_HERO_RESIZE_MIN_PX);
    });

    it("lowers the floor to the panel fraction when the panel is shorter than the resize min", () => {
        expect(clampDetailsHeroHeight(10, 100)).toBe(Math.floor(100 * DETAILS_HERO_HEIGHT_MAX_FRACTION));
    });

    it("caps at the panel fraction when the candidate is larger", () => {
        const panel = 1000;
        expect(clampDetailsHeroHeight(9999, panel)).toBe(Math.floor(panel * DETAILS_HERO_HEIGHT_MAX_FRACTION));
    });

    it("passes through a value already inside the range", () => {
        expect(clampDetailsHeroHeight(400, 1000)).toBe(400);
    });
});
