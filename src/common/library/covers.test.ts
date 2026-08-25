import { describe, expect, it } from "vitest";
import { managedCoverFileName } from "./covers";

describe("managedCoverFileName", () => {
    it("names the library thumbnail by id and prefixes the tracker slot", () => {
        expect(managedCoverFileName(42)).toBe("42.webp");
        expect(managedCoverFileName(42, "library")).toBe("42.webp");
        expect(managedCoverFileName(42, "tracker")).toBe("tracker-42.webp");
    });
});
