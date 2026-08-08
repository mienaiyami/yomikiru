import { beforeEach, describe, expect, it } from "vitest";
import { getStorageItem, STORAGE_KEYS, setStorageItem } from "./localStorage";

describe("localStorage helpers", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("round-trips values under STORAGE_KEYS", () => {
        setStorageItem("ANILIST_TOKEN", "tok");
        expect(getStorageItem("ANILIST_TOKEN")).toBe("tok");
        expect(localStorage.getItem(STORAGE_KEYS.ANILIST_TOKEN)).toBe("tok");
        expect(getStorageItem("ANILIST_TRACKING")).toBeNull();
    });
});
