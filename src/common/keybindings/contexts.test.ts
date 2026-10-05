import { describe, expect, it } from "vitest";
import { getCommand } from "./catalog";
import {
    classifyBindingOverlap,
    contextSetsCanOverlap,
    contextsCanCoexist,
    representativeActiveSets,
} from "./contexts";

describe("context overlap", () => {
    it("treats manga and book readers as disjoint, and readers as disjoint from home", () => {
        expect(contextsCanCoexist("mangaReader", "bookReader")).toBe(false);
        expect(contextsCanCoexist("mangaReader", "home")).toBe(false);
        expect(contextsCanCoexist("bookReader", "galleryDetails")).toBe(false);
        expect(contextSetsCanOverlap(["mangaReader"], ["bookReader"])).toBe(false);
    });

    it("allows reader overlays and app chrome to coexist with a reader", () => {
        expect(contextsCanCoexist("mangaReader", "app")).toBe(true);
        expect(contextsCanCoexist("mangaReader", "readerPanel")).toBe(true);
        expect(contextsCanCoexist("settings", "mangaReader")).toBe(true);
        expect(contextsCanCoexist("home", "galleryDetails")).toBe(true);
        expect(contextSetsCanOverlap(["mangaReader", "bookReader"], ["app"])).toBe(true);
    });

    it("builds location stacks with ambient app and claimed overlays", () => {
        const sets = representativeActiveSets(["mangaReader"], ["settings"]);
        expect(sets).toEqual(
            expect.arrayContaining([
                ["app", "home"],
                ["app", "home", "settings"],
                ["app", "mangaReader"],
                ["app", "mangaReader", "settings"],
                ["app", "bookReader"],
                ["app", "bookReader", "settings"],
            ]),
        );
    });
});

describe("classifyBindingOverlap", () => {
    it("treats reader vs app as harmless when each still wins a stack", () => {
        const largeScroll = getCommand("largeScroll");
        const navToHome = getCommand("navToHome");
        expect(largeScroll && navToHome && classifyBindingOverlap(largeScroll, navToHome)).toBe("harmless");
    });

    it("treats a more-specific home/reader claim as a conflict against app-only", () => {
        const navToHome = getCommand("navToHome");
        const focusPageSearch = getCommand("focusPageSearch");
        expect(navToHome && focusPageSearch && classifyBindingOverlap(navToHome, focusPageSearch)).toBe(
            "conflict",
        );
    });

    it("treats two reader commands that share a location as a conflict", () => {
        const nextPage = getCommand("nextPage");
        const prevPage = getCommand("prevPage");
        expect(nextPage && prevPage && classifyBindingOverlap(nextPage, prevPage)).toBe("conflict");
    });
});
