import * as semver from "semver";
import { z } from "zod";

/** Quiet period after remind-later before an automatic check may offer that release again. */
export const UPDATE_REMIND_LATER_MS = 24 * 60 * 60 * 1000;

/**
 * Button order for the new-version dialog.
 * Escape and the window close control use remind-later.
 */
export const UPDATE_AVAILABLE_ACTIONS = [
    "download",
    "download-and-changelog",
    "changelog",
    "remind-later",
    "skip-version",
] as const;

export type UpdateAvailableAction = (typeof UPDATE_AVAILABLE_ACTIONS)[number];

/** {@link UPDATE_AVAILABLE_ACTIONS} index used as the dialog cancel id. */
export const UPDATE_AVAILABLE_CANCEL_ID = UPDATE_AVAILABLE_ACTIONS.indexOf("remind-later");

/**
 * Per-channel memory for the new-version prompt.
 * `skippedVersion` hides that release until a newer one exists.
 * `remindVersion` and `remindAfter` postpone automatic prompts for one release.
 */
export const updatePromptChannelSchema = z
    .object({
        skippedVersion: z.string().default(""),
        remindVersion: z.string().default(""),
        /** Unix ms when the remind-later quiet period ends. */
        remindAfter: z.number().int().nonnegative().default(0),
    })
    .default({});

export type UpdatePromptChannel = z.infer<typeof updatePromptChannelSchema>;

/** Stable and beta channels keep separate skip and remind-later choices. */
export const updatePromptSchema = z
    .object({
        stable: updatePromptChannelSchema,
        beta: updatePromptChannelSchema,
    })
    .default({});

export type UpdatePromptState = z.infer<typeof updatePromptSchema>;

/** Why an automatic check did or did not open the new-version prompt. */
export type UpdateOffer = "show" | "skipped-version" | "remind-later";

/**
 * Maps a dialog response index to a {@link UpdateAvailableAction}.
 * @returns `null` when the index is outside {@link UPDATE_AVAILABLE_ACTIONS}
 */
export const updateAvailableAction = (responseIndex: number): UpdateAvailableAction | null =>
    UPDATE_AVAILABLE_ACTIONS[responseIndex] ?? null;

/**
 * Decides whether a check should open the new-version prompt.
 * A manual check always shows. An automatic check stays quiet for a skipped release
 * until a newer one exists, and during the remind-later quiet period for that same release.
 */
export const classifyUpdateOffer = (
    latestVersion: string,
    channelState: UpdatePromptChannel,
    nowMs: number,
    isManualCheck: boolean,
): UpdateOffer => {
    if (isManualCheck) return "show";
    if (!semver.valid(latestVersion)) return "show";

    const skippedVersion = channelState.skippedVersion;
    if (semver.valid(skippedVersion) && !semver.gt(latestVersion, skippedVersion)) {
        return "skipped-version";
    }

    if (channelState.remindVersion === latestVersion && channelState.remindAfter > nowMs) {
        return "remind-later";
    }

    return "show";
};

/**
 * Postpones automatic prompts for `latestVersion` until the quiet period ends.
 * A skipped release on the same channel is left in place.
 */
export const withRemindLater = (
    channelState: UpdatePromptChannel,
    latestVersion: string,
    nowMs: number,
): UpdatePromptChannel => ({
    ...channelState,
    remindVersion: latestVersion,
    remindAfter: nowMs + UPDATE_REMIND_LATER_MS,
});

/**
 * Ignores `latestVersion` until a newer release exists.
 * Clears any remind-later quiet period on that channel.
 */
export const withSkippedVersion = (
    channelState: UpdatePromptChannel,
    latestVersion: string,
): UpdatePromptChannel => ({
    ...channelState,
    skippedVersion: latestVersion,
    remindVersion: "",
    remindAfter: 0,
});
