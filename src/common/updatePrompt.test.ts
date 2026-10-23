import { describe, expect, it } from "vitest";
import {
    classifyUpdateOffer,
    UPDATE_AVAILABLE_ACTIONS,
    UPDATE_AVAILABLE_CANCEL_ID,
    UPDATE_REMIND_LATER_MS,
    updateAvailableAction,
    updatePromptChannelSchema,
    withRemindLater,
    withSkippedVersion,
} from "./updatePrompt";

const openChannel = updatePromptChannelSchema.parse({});

describe("classifyUpdateOffer", () => {
    it("shows when nothing was skipped or postponed", () => {
        expect(classifyUpdateOffer("2.0.0", openChannel, 1_000, false)).toBe("show");
    });

    it("shows a manual check even when that release was skipped or postponed", () => {
        const skipped = withSkippedVersion(openChannel, "2.0.0");
        const postponed = withRemindLater(openChannel, "2.0.0", 1_000);
        expect(classifyUpdateOffer("2.0.0", skipped, 1_000, true)).toBe("show");
        expect(classifyUpdateOffer("2.0.0", postponed, 1_000, true)).toBe("show");
    });

    it("hides a skipped release until a newer one exists", () => {
        const skipped = withSkippedVersion(openChannel, "2.0.0");
        expect(classifyUpdateOffer("2.0.0", skipped, 1_000, false)).toBe("skipped-version");
        expect(classifyUpdateOffer("1.9.0", skipped, 1_000, false)).toBe("skipped-version");
        expect(classifyUpdateOffer("2.0.1", skipped, 1_000, false)).toBe("show");
        expect(classifyUpdateOffer("2.1.0-beta.1", skipped, 1_000, false)).toBe("show");
    });

    it("ignores a skipped value that is not a version", () => {
        const skipped = { ...openChannel, skippedVersion: "later" };
        expect(classifyUpdateOffer("2.0.0", skipped, 1_000, false)).toBe("show");
    });

    it("hides the postponed release until the quiet period ends", () => {
        const nowMs = 5_000;
        const postponed = withRemindLater(openChannel, "2.0.0", nowMs);
        expect(classifyUpdateOffer("2.0.0", postponed, nowMs + 1, false)).toBe("remind-later");
        expect(classifyUpdateOffer("2.0.0", postponed, postponed.remindAfter, false)).toBe("show");
        expect(classifyUpdateOffer("2.0.1", postponed, nowMs + 1, false)).toBe("show");
    });

    it("keeps a skip when remind-later is recorded", () => {
        const skipped = withSkippedVersion(openChannel, "2.0.0");
        const postponed = withRemindLater(skipped, "2.0.0", 1_000);
        expect(postponed.skippedVersion).toBe("2.0.0");
        expect(classifyUpdateOffer("2.0.0", postponed, 1_000, false)).toBe("skipped-version");
    });
});

describe("prompt choice records", () => {
    it("sets the remind-later quiet period from the choice time", () => {
        const nowMs = 10_000;
        const postponed = withRemindLater(openChannel, "3.1.0", nowMs);
        expect(postponed.remindVersion).toBe("3.1.0");
        expect(postponed.remindAfter).toBe(nowMs + UPDATE_REMIND_LATER_MS);
    });

    it("clears remind-later when a release is skipped", () => {
        const postponed = withRemindLater(openChannel, "3.1.0", 10_000);
        const skipped = withSkippedVersion(postponed, "3.1.0");
        expect(skipped).toEqual({
            skippedVersion: "3.1.0",
            remindVersion: "",
            remindAfter: 0,
        });
    });
});

describe("update available actions", () => {
    it("keeps remind-later as the cancel action and skip-version last", () => {
        expect(UPDATE_AVAILABLE_ACTIONS).toEqual([
            "download",
            "download-and-changelog",
            "changelog",
            "remind-later",
            "skip-version",
        ]);
        expect(UPDATE_AVAILABLE_CANCEL_ID).toBe(3);
        expect(updateAvailableAction(3)).toBe("remind-later");
        expect(updateAvailableAction(4)).toBe("skip-version");
        expect(updateAvailableAction(5)).toBeNull();
    });
});
